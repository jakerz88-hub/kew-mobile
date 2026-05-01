#!/bin/bash
# Publish an OTA update to the staging channel with the correct env vars.
#
# Why this exists:
#   `eas update --branch staging` without exporting EXPO_PUBLIC_* env vars
#   bakes the FALLBACK values from app.json's `extra` block into the bundle
#   — which point at PRODUCTION. Result: the staging app silently auths
#   against prod Supabase, causing auth errors and (worse) write traffic
#   leaking from staging into the prod database.
#
#   This script reads the canonical staging values from eas.json
#   (build.staging.env) and exports them before calling `eas update`,
#   so Metro inlines the correct values into the JS bundle.
#
# Usage:
#   ./update-staging.sh "your update message"

set -e

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 \"<update message>\""
  exit 1
fi

MESSAGE="$1"

echo "==> Reading staging env from eas.json (build.staging.env)"

# Use python3 (built into macOS) to extract env var values from eas.json.
read_env() {
  python3 -c "
import json, sys
with open('eas.json') as f:
    cfg = json.load(f)
val = cfg['build']['staging']['env'].get('$1')
if not val:
    print(f'ERROR: $1 missing from eas.json build.staging.env', file=sys.stderr)
    sys.exit(1)
print(val)
"
}

EXPO_PUBLIC_API_BASE_URL="$(read_env EXPO_PUBLIC_API_BASE_URL)"
EXPO_PUBLIC_SUPABASE_URL="$(read_env EXPO_PUBLIC_SUPABASE_URL)"
EXPO_PUBLIC_SUPABASE_ANON_KEY="$(read_env EXPO_PUBLIC_SUPABASE_ANON_KEY)"

# Sanity check: anon key must decode to staging project ref. Catches the
# case where someone pastes the prod key into eas.json by mistake.
# Use python3 throughout — it handles unpadded base64url that JWTs use.
EXPECTED_REF=$(echo "$EXPO_PUBLIC_SUPABASE_URL" | sed -E 's|https://([a-z0-9]+)\.supabase\.co.*|\1|')
PAYLOAD_REF=$(python3 -c "
import base64, json, sys
key = '$EXPO_PUBLIC_SUPABASE_ANON_KEY'
parts = key.split('.')
if len(parts) < 2:
    print('')
    sys.exit(0)
seg = parts[1]
seg += '=' * ((4 - len(seg) % 4) % 4)
try:
    payload = json.loads(base64.urlsafe_b64decode(seg).decode())
    print(payload.get('ref', ''))
except Exception:
    print('')
")
if [[ "$PAYLOAD_REF" != "$EXPECTED_REF" ]]; then
  echo "ERROR: anon key in eas.json decodes to project ref '$PAYLOAD_REF'"
  echo "       but EXPO_PUBLIC_SUPABASE_URL points at '$EXPECTED_REF'."
  echo "       The anon key is for the wrong Supabase project. Fix eas.json before publishing."
  exit 1
fi

echo "    EXPO_PUBLIC_API_BASE_URL    = $EXPO_PUBLIC_API_BASE_URL"
echo "    EXPO_PUBLIC_SUPABASE_URL    = $EXPO_PUBLIC_SUPABASE_URL"
echo "    EXPO_PUBLIC_SUPABASE_ANON_KEY = (decodes to ref: $PAYLOAD_REF)"
echo ""
echo "==> Running: eas update --branch staging --clear-cache"

export EXPO_PUBLIC_API_BASE_URL EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY

eas update --branch staging --message "$MESSAGE" --clear-cache
