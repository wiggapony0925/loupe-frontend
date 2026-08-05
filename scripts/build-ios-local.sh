#!/usr/bin/env bash
#
# Build a signed App Store .ipa on this Mac — the local replacement for
# `eas build --platform ios --profile production`.
#
#   npm run build:ios              # prebuild (incremental) + archive + export
#   npm run build:ios -- --clean   # wipe ios/ and regenerate from app.json first
#   npm run build:ios -- --no-bump # don't increment ios.buildNumber
#
# Output: build/ipa/Loupe.ipa, then upload it with Transporter.app.
#
# WHAT THIS REPLICATES FROM eas.json
#   - the production profile's env block (EXPO_PUBLIC_*, Sentry upload off)
#   - the `eas-build-pre-install` package.json hook (set-logo registry)
#   - `autoIncrement: true` (EAS used to own the build number remotely;
#     appVersionSource is now "local", so app.json is the source of truth)
#
# SIGNING: handled by Xcode, not by the EAS certificate. The EAS dist cert's
# private key isn't in this keychain, so plugins/withIphoneDistributionSigning.js
# switches Release to automatic signing whenever EAS_BUILD is unset.
# -allowProvisioningUpdates lets Xcode mint/refresh the App Store profile.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

CLEAN=0
BUMP=1
for arg in "$@"; do
  case "$arg" in
    --clean)   CLEAN=1 ;;
    --no-bump) BUMP=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mx  %s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- preflight
# buildReactNativeFromSource is true in app.json, so every archive compiles
# React Native itself. That is tens of GB of intermediates; running out of
# space mid-archive leaves a corrupt DerivedData that fails confusingly.
FREE_GB=$(df -g "$ROOT" | awk 'NR==2 {print $4}')
say "Preflight — ${FREE_GB}GB free"
if [ "$FREE_GB" -lt 25 ]; then
  echo "  React Native builds from source here; under ~25GB this usually dies"
  echo "  partway through with a misleading compile error. Reclaim space:"
  echo "    rm -rf ~/Library/Developer/Xcode/DerivedData/*"
  echo "    rm -rf ~/Library/Caches/CocoaPods && pod cache clean --all"
  echo "    rm -rf \"$ROOT/ios/build\" \"$ROOT/build\""
  die "Not enough free disk (${FREE_GB}GB)."
elif [ "$FREE_GB" -lt 40 ]; then
  echo "  ⚠ ${FREE_GB}GB is enough to start but leaves little headroom."
fi

command -v xcodebuild >/dev/null || die "xcodebuild not found. Install Xcode."
security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Distribution" \
  || die "No 'Apple Distribution' identity in the login keychain.
  Xcode > Settings > Accounts > (your Apple ID) > Manage Certificates > + Apple Distribution"

# ------------------------------------------------------------ build number
if [ "$BUMP" -eq 1 ]; then
  NEXT=$(node -e '
    const fs = require("fs");
    const p = "app.json";
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    const n = String(Number(j.expo.ios.buildNumber || 0) + 1);
    j.expo.ios.buildNumber = n;
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
    process.stdout.write(n);
  ')
  say "Build number -> $NEXT"
  echo "  App Store Connect rejects a build number it has already seen."
  echo "  Commit app.json so the counter survives; --no-bump to retry one."
else
  NEXT=$(node -p 'require("./app.json").expo.ios.buildNumber')
  say "Build number pinned at $NEXT (--no-bump)"
fi

# ------------------------------------------------- env (from eas.json prod)
export EXPO_PUBLIC_API_URL="https://loupe-api-wrrcqaayra-uc.a.run.app"
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="714615078104-ta4c6j64ir3rqauqvf593q8llu8i2kr4.apps.googleusercontent.com"
export SENTRY_DISABLE_AUTO_UPLOAD="true"   # no SENTRY_AUTH_TOKEN needed locally
export EAS_BUILD_NO_EXPO_GO_WARNING="true"

# --------------------------------------------------------- generated assets
say "Generating set-logo registry (was the eas-build-pre-install hook)"
node scripts/generate-set-logo-registry.mjs || true

# ---------------------------------------------------------------- prebuild
if [ "$CLEAN" -eq 1 ]; then
  say "Clean prebuild — regenerating ios/ from app.json"
  rm -rf "$ROOT/ios"
  npx expo prebuild --platform ios --clean
else
  say "Prebuild (incremental)"
  npx expo prebuild --platform ios
fi

[ -d "$ROOT/ios/Pods" ] || { say "Installing pods"; (cd ios && pod install); }

# ----------------------------------------------------------------- archive
ARCHIVE="$ROOT/build/Loupe.xcarchive"
rm -rf "$ARCHIVE"
mkdir -p "$ROOT/build"

say "Archiving (first run compiles React Native from source — expect a long build)"
xcodebuild archive \
  -workspace "$ROOT/ios/Loupe.xcworkspace" \
  -scheme Loupe \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  COMPILER_INDEX_STORE_ENABLE=NO \
  | (command -v xcbeautify >/dev/null && xcbeautify || cat)

[ -d "$ARCHIVE" ] || die "Archive not produced."

# ------------------------------------------------------------------ export
say "Exporting .ipa"
rm -rf "$ROOT/build/ipa"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$ROOT/ios/exportOptions.plist" \
  -exportPath "$ROOT/build/ipa" \
  -allowProvisioningUpdates \
  | (command -v xcbeautify >/dev/null && xcbeautify || cat)

IPA=$(find "$ROOT/build/ipa" -name '*.ipa' -maxdepth 1 | head -1)
[ -n "$IPA" ] || die "No .ipa in build/ipa."

say "Done — build $NEXT"
echo "  $IPA  ($(du -h "$IPA" | cut -f1))"
echo
echo "  Upload to TestFlight: open Transporter.app, sign in as ninjeff06@gmail.com,"
echo "  drag in the .ipa, Deliver. (App Store Connect app id 6773403045.)"
echo
echo "  Reclaim ~$(du -sh "$ARCHIVE" 2>/dev/null | cut -f1) when you're done:"
echo "    rm -rf build/Loupe.xcarchive"
