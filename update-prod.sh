#!/bin/bash
# Publish an OTA update to the production channel with clean credentials.
#
# Why this exists:
#   `eas update --branch preview` (without the right precautions) silently
#   ships staging credentials to production. Two compounding mechanisms:
#
#     1. EXPO_PUBLIC_* env var leak. update-staging.sh exports staging
#        EXPO_PUBLIC_* values for its own bundle. Those exports persist
#        across subsequent shell invocations within the same session
#        (and across Bash tool calls in Claude Code sessions). If they're
#        still set when `eas update --branch preview` runs, Metro inlines
#        them into the prod bundle — overriding the prod fallback in
#        app.json's `extra` block.
#
#     2. Metro transform cache. After update-staging.sh runs, Metro's
#        cache holds bundles built with the staging env values inlined
#        into transformed modules. Without --clear-cache, a subsequent
#        prod publish reuses those poisoned transforms.
#
#   This script:
#     1. Unsets EXPO_PUBLIC_* env vars (so the bundler reads app.json's
#        prod fallback, not stale staging values from the shell).
#     2. Runs `eas update --branch preview --clear-cache --message "$1"`
#        (clear-cache forces a clean Metro rebuild).
#     3. After publishing, greps the dist/ bundles for staging refs.
#     4. ABORTS LOUDLY if any staging ref is found — the bundle was just
#        published, so this is a fire-alarm condition that needs an
#        immediate rollback.
#
# Three sessions in early May 2026 silently shipped staging credentials
# to prod via raw `eas update --branch preview`. This wrapper makes that
# class of bug structurally impossible.
#
# Usage:
#   ./update-prod.sh "your update message"
#
# This script is the ONLY supported way to publish a prod OTA. NEVER run
# `eas update --branch preview` directly — see AGENTS.md "Mobile OTA
# wrappers — never raw eas update".

set -e

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 \"<update message>\""
  exit 1
fi

MESSAGE="$1"
PROD_SUPABASE_REF="piedqhsglgpzcdrvvihk"
STAGING_SUPABASE_REF="axfqrmjjqnklftpomaao"
PROD_BACKEND_HOST="kew-backend-production"
STAGING_BACKEND_HOST="kew-backend-staging"

echo "==> Unsetting EXPO_PUBLIC_* env vars (forces app.json prod fallback)"
unset EXPO_PUBLIC_API_BASE_URL
unset EXPO_PUBLIC_SUPABASE_URL
unset EXPO_PUBLIC_SUPABASE_ANON_KEY
unset EXPO_PUBLIC_REVENUECAT_IOS_KEY

echo "==> Running: eas update --branch preview --clear-cache"
echo ""

# Capture build duration. A cold Metro rebuild typically takes ~30s; if
# this step finishes in under 15s we suspect --clear-cache wasn't honored
# and Metro reused cached transforms. The bundle-grep below is still the
# authoritative check, but a fast build is a soft warning sign.
BUILD_START=$(date +%s)
eas update --branch preview --message "$MESSAGE" --clear-cache
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

echo ""
if [[ $BUILD_DURATION -lt 15 ]]; then
  echo "⚠️  WARNING: bundle step finished in ${BUILD_DURATION}s (expected ~30s for cold rebuild)."
  echo "    A fast build can indicate Metro reused cached transforms despite --clear-cache."
  echo "    The bundle-grep below is the authoritative check, but pay close attention."
  echo ""
fi

echo "==> Verifying published bundle has no staging credentials"

IOS_BUNDLE=$(ls -t dist/_expo/static/js/ios/index-*.hbc 2>/dev/null | head -1)
ANDROID_BUNDLE=$(ls -t dist/_expo/static/js/android/index-*.hbc 2>/dev/null | head -1)

if [[ -z "$IOS_BUNDLE" || -z "$ANDROID_BUNDLE" ]]; then
  echo "ERROR: dist/ did not contain bundles after eas update."
  echo "       Cannot verify credentials — assume the worst and roll back."
  echo "       Run: eas update:list --branch preview --limit 5"
  exit 1
fi

resolve_prior_group_id() {
  # Fetch the second-most-recent update group on preview branch — the one
  # before the poisoned bundle we just published. Returns empty string on
  # failure so the caller can print a fallback message.
  local list_output prior_group
  list_output=$(eas update:list --branch preview --limit 2 --non-interactive 2>/dev/null) || return 0
  # Each group is preceded by "Group ID                  <uuid>". Grab the
  # second occurrence (the one before our just-published poisoned group).
  prior_group=$(echo "$list_output" | grep -oE "Group ID[[:space:]]+[0-9a-f-]{36}" | sed -n '2s/.*[[:space:]]//p')
  echo "$prior_group"
}

verify_bundle() {
  local bundle="$1"
  local platform="$2"

  local prod_supabase staging_supabase prod_backend staging_backend
  prod_supabase=$(strings "$bundle" | grep -c "$PROD_SUPABASE_REF" || true)
  staging_supabase=$(strings "$bundle" | grep -c "$STAGING_SUPABASE_REF" || true)
  prod_backend=$(strings "$bundle" | grep -c "$PROD_BACKEND_HOST" || true)
  staging_backend=$(strings "$bundle" | grep -c "$STAGING_BACKEND_HOST" || true)

  echo "    $platform: prod-supabase=$prod_supabase  staging-supabase=$staging_supabase  prod-backend=$prod_backend  staging-backend=$staging_backend"

  if [[ "$staging_supabase" != "0" || "$staging_backend" != "0" ]]; then
    local prior_group
    prior_group=$(resolve_prior_group_id)
    local rollback_cmd
    if [[ -n "$prior_group" ]]; then
      rollback_cmd="eas update:republish --group $prior_group --message 'Rollback: poisoned credentials'"
    else
      rollback_cmd="(could not auto-resolve prior group — run \`eas update:list --branch preview --limit 5\` and republish the second entry)"
    fi

    echo ""
    echo "  ╔══════════════════════════════════════════════════════════════════════════╗"
    echo "  ║                                                                          ║"
    echo "  ║  ⛔ STOP — PROD BUNDLE CONTAINS STAGING CREDENTIALS                       ║"
    echo "  ║                                                                          ║"
    echo "  ║  $platform bundle has staging refs (both must be 0):                      "
    echo "  ║    Supabase ($STAGING_SUPABASE_REF): $staging_supabase                    "
    echo "  ║    Backend  ($STAGING_BACKEND_HOST):  $staging_backend                     "
    echo "  ║                                                                          ║"
    echo "  ║  The bundle was JUST PUBLISHED. Prod users may already be downloading    ║"
    echo "  ║  it on their next cold launch. ROLL BACK IMMEDIATELY:                    ║"
    echo "  ║                                                                          ║"
    echo "  ╚══════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  $rollback_cmd"
    echo ""
    echo "  After rollback: investigate why --clear-cache + env-unset failed to"
    echo "  produce a clean bundle. See AGENTS.md \"Mobile OTA wrappers\" and"
    echo "  memory/feedback_deploy_gotchas.md for the failure modes."
    exit 1
  fi

  if [[ "$prod_supabase" -lt 1 || "$prod_backend" -lt 1 ]]; then
    echo ""
    echo "ERROR: $platform bundle is missing prod credentials entirely."
    echo "       Bundle has prod-supabase=$prod_supabase, prod-backend=$prod_backend."
    echo "       Both should be at least 1. Roll back and investigate app.json."
    exit 1
  fi
}

verify_bundle "$IOS_BUNDLE" "iOS    "
verify_bundle "$ANDROID_BUNDLE" "Android"

echo ""
echo "✓ prod OTA verified clean — only prod refs in bundle, zero staging refs"
