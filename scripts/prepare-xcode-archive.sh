#!/usr/bin/env bash
#
# Get this Mac ready to archive Loupe from the XCODE GUI.
#
#   npm run archive:xcode              # prepare + open the workspace
#   npm run archive:xcode -- --clean   # wipe ios/ and regenerate first
#   npm run archive:xcode -- --no-bump # keep the current build number
#   npm run archive:xcode -- --no-open # prepare only, don't launch Xcode
#
# Then in Xcode:  Product ▸ Archive  →  Distribute App  →  TestFlight & App Store
#
# WHY THIS EXISTS, when build-ios-local.sh already ships an .ipa.
# That script archives headlessly and hands you a file for Transporter. This
# one prepares the project and gets out of the way, so the archive, the
# signing and the upload all happen inside Xcode's Organizer — which is what
# you want when you'd rather watch the build, or when Distribute's validation
# report is the thing you're after.
#
# WHAT XCODE WILL NOT DO FOR YOU (and this script therefore does):
#
#   1. The `eas-build-pre-install` hook — the set-logo registry is generated
#      code. Without it the app builds and every set logo is missing.
#   2. The production env block from eas.json. Xcode's bundle phase runs
#      Metro with no knowledge of eas.json, and EXPO_PUBLIC_* values are
#      INLINED at bundle time. `config.googleIosClientId` falls back to ""
#      when the var is absent, so Google sign-in ships silently broken.
#      Written to .env.production, which @expo/env loads only when
#      NODE_ENV=production — i.e. release bundles, never `expo start`.
#   3. The build number. App Store Connect rejects a number it has seen
#      before, and the rejection arrives after the upload, not before it.
#   4. `expo prebuild` + `pod install`. Archiving a stale ios/ silently
#      ships the last prebuild's native config — the wrong Info.plist
#      strings, the wrong OTA channel.
#
# SIGNING is Xcode's, not EAS's: plugins/withIphoneDistributionSigning.js
# switches Release to automatic signing whenever EAS_BUILD is unset, so the
# Organizer can mint or refresh the App Store profile on your Apple ID.

set -euo pipefail

# CocoaPods calls String#unicode_normalize on the install path, which raises
# on an ASCII-8BIT locale — and CocoaPods' own error reporter then crashes on
# the SAME encoding while trying to explain why. A non-interactive shell
# doesn't inherit Terminal's locale, so this has to be set here.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

cd "$(dirname "$0")/.."
ROOT="$PWD"

CLEAN=0
BUMP=1
OPEN=1
for arg in "$@"; do
  case "$arg" in
    --clean)   CLEAN=1 ;;
    --no-bump) BUMP=0 ;;
    --no-open) OPEN=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mx  %s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- preflight
command -v xcodebuild >/dev/null || die "xcodebuild not found. Install Xcode from the App Store."
command -v pod >/dev/null || die "CocoaPods not found. Install it: sudo gem install cocoapods"

FREE_GB=$(df -g "$ROOT" | awk 'NR==2 {print $4}')
say "Preflight — ${FREE_GB}GB free"
if [ "$FREE_GB" -lt 15 ]; then
  echo "  An archive that runs out of space mid-way leaves a corrupt"
  echo "  DerivedData that fails confusingly on the NEXT run too. Reclaim:"
  echo "    rm -rf ~/Library/Developer/Xcode/DerivedData/*"
  echo "    rm -rf ~/Library/Caches/CocoaPods && pod cache clean --all"
  echo "    rm -rf \"$ROOT/ios/build\" \"$ROOT/build\""
  die "Not enough free disk (${FREE_GB}GB)."
fi

# A warning, not a failure: Xcode can mint the certificate for you from
# Settings ▸ Accounts, which is a nicer place to fix this than a shell.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Distribution"; then
  printf '\n\033[1;33m!  No "Apple Distribution" identity in your login keychain.\033[0m\n'
  echo "   Xcode ▸ Settings ▸ Accounts ▸ (Apple ID) ▸ Manage Certificates ▸ + Apple Distribution"
  echo "   Archiving works without it; DISTRIBUTING does not."
fi

# ------------------------------------------------------------ build number
if [ "$BUMP" -eq 1 ]; then
  NEXT=$(node -e '
    const fs = require("fs");
    const j = JSON.parse(fs.readFileSync("app.json", "utf8"));
    const n = String(Number(j.expo.ios.buildNumber || 0) + 1);
    j.expo.ios.buildNumber = n;
    fs.writeFileSync("app.json", JSON.stringify(j, null, 2) + "\n");
    process.stdout.write(n);
  ')
  say "Build number -> $NEXT"
  echo "  Commit app.json so the counter survives; --no-bump to retry this one."
else
  NEXT=$(node -p 'require("./app.json").expo.ios.buildNumber')
  say "Build number pinned at $NEXT (--no-bump)"
fi

# -------------------------------------------- the production env, for Metro
# NOT .env or .env.local: those load in development too, which would point
# `expo start` at the production API. `.env.production` is read only when
# NODE_ENV=production — the release bundle Xcode's archive builds. See
# @expo/env's file precedence. Gitignored, so it never lands in a commit.
say "Writing .env.production (Xcode's bundle phase can't read eas.json)"
cat > "$ROOT/.env.production" <<'ENVEOF'
# GENERATED by scripts/prepare-xcode-archive.sh — do not commit.
# Mirrors the production profile's env block in eas.json. Loaded only when
# NODE_ENV=production, i.e. release bundles; `expo start` never sees it.
EXPO_PUBLIC_API_URL=https://loupe-api-wrrcqaayra-uc.a.run.app
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=714615078104-ta4c6j64ir3rqauqvf593q8llu8i2kr4.apps.googleusercontent.com
ENVEOF
export SENTRY_DISABLE_AUTO_UPLOAD="true"   # no SENTRY_AUTH_TOKEN needed locally
export EAS_BUILD_NO_EXPO_GO_WARNING="true"

# --------------------------------------------------------- generated assets
say "Generating set-logo registry (the eas-build-pre-install hook)"
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

say "Installing pods"
(cd "$ROOT/ios" && pod install)

# ---------------------------------------------------- OTA channel guard
# A non-EAS build gets its update channel from app.json's
# updates.requestHeaders — `eas build` injects it from eas.json, and nothing
# here runs EAS. Without it the binary asks the update server for a manifest
# with no `expo-channel-name` header, gets HTTP 400, and silently NEVER
# receives an OTA update. Build 243 shipped exactly that way.
CHANNEL=$(/usr/libexec/PlistBuddy -c "Print :EXUpdatesRequestHeaders:expo-channel-name" \
  "$ROOT/ios/Loupe/Supporting/Expo.plist" 2>/dev/null || true)
if [ -z "$CHANNEL" ]; then
  die "No OTA channel baked into Expo.plist. Add
    \"updates\": { \"requestHeaders\": { \"expo-channel-name\": \"production\" } }
  to app.json, or this build can never receive an update."
fi
say "OTA channel: $CHANNEL"

# ------------------------------------------------------------------- hand off
say "Ready to archive — build $NEXT"
cat <<INSTRUCTIONS

  In Xcode:

    1. Scheme:  Loupe        (top bar, left of the device picker)
    2. Device:  Any iOS Device (arm64)   ← Archive is greyed out on a simulator
    3. Product ▸ Archive
    4. Organizer opens ▸ Distribute App ▸ TestFlight & App Store ▸ Upload

  Signing is automatic — Xcode mints or refreshes the App Store profile on
  your Apple ID. If Distribute complains about the profile, open
  Signing & Capabilities on the Loupe target and confirm the team is
  DCU7GHRVUQ with "Automatically manage signing" ticked.

  Prefer a headless build that hands you an .ipa for Transporter instead?
    npm run build:ios

INSTRUCTIONS

if [ "$OPEN" -eq 1 ]; then
  say "Opening ios/Loupe.xcworkspace"
  open "$ROOT/ios/Loupe.xcworkspace"
else
  echo "  Workspace: $ROOT/ios/Loupe.xcworkspace  (--no-open, so not launched)"
fi
