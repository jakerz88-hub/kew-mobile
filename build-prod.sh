#!/bin/bash
# Build and submit a production native app to App Store Connect:
#   1. Run `eas build --profile production --platform <ios|android> --auto-submit`
#
# Usage:
#   ./build-prod.sh ios
#   ./build-prod.sh android

set -e

PLATFORM="${1:-ios}"

if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "Usage: $0 <ios|android>"
  exit 1
fi

echo "==> Running: eas build --profile production --platform $PLATFORM --auto-submit"
eas build --profile production --platform "$PLATFORM" --auto-submit
