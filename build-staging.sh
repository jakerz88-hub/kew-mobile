#!/bin/bash
# Build a staging native app:
#   1. Back up app.json
#   2. Patch bundleIdentifier/package/name to staging values
#   3. Run `eas build --profile staging --platform <ios|android>`
#   4. Always restore app.json on exit (success, failure, or Ctrl-C)
#
# Usage:
#   ./build-staging.sh ios
#   ./build-staging.sh android

set -e

PLATFORM="${1:-ios}"

if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "Usage: $0 <ios|android>"
  exit 1
fi

BACKUP="app.json.prod-backup"

# Restore on any exit (Ctrl-C, error, normal completion)
restore() {
  if [[ -f "$BACKUP" ]]; then
    mv "$BACKUP" app.json
    echo "==> Restored app.json from backup."
  fi
}
trap restore EXIT

cp app.json "$BACKUP"
echo "==> Backed up app.json to $BACKUP"

# Patch the three fields. Using python3 (built into macOS) for safe JSON edit.
python3 <<'PY'
import json
with open("app.json") as f:
    cfg = json.load(f)
e = cfg["expo"]
e["name"] = "Kew Staging"
e["ios"]["bundleIdentifier"] = "com.kew.app.staging"
e["android"]["package"] = "com.kew.app.staging"
with open("app.json", "w") as f:
    json.dump(cfg, f, indent=2)
print("==> Patched app.json: name='Kew Staging', bundleId/package='com.kew.app.staging'")
PY

echo "==> Running: eas build --profile staging --platform $PLATFORM"
eas build --profile staging --platform "$PLATFORM"
