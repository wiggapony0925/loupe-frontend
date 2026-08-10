# Loupe

> See every grain.

The operator app for the **JFM hardware card scanner**. Real-time hardware link, 1000-point forensic grading, heatmap of surface dings, and a vault for your collection — built for collectors who treat cards like assets.

## Stack

Expo SDK 52 · Expo Router · TypeScript (strict) · NativeWind 4 · Zustand · TanStack Query 5 · Reanimated · expo-blur · react-native-svg · lucide-react-native.

## Run it

```bash
cd ~/Projects/JFMForensicSuite
npm install
npx expo start
```

Then in the Expo dev menu:

- press **i** → open in iOS Simulator (requires Xcode)
- press **a** → open in Android emulator (requires Android Studio)
- scan the QR with **Expo Go** on your phone

If you hit a stale-cache issue, run `npx expo start -c` to clear the Metro cache.

## Shipping to TestFlight (local builds)

Release builds happen **on this Mac**, not on EAS. The EAS workflows in
`.eas/workflows/` used to fire on every push to `main`, which billed a full
native build per commit; they are now `workflow_dispatch` only.

There are two paths to the same binary. Pick by where you want to be standing
when it fails.

### Headless — script hands you an `.ipa`

```bash
npm run build:ios
```

[`scripts/build-ios-local.sh`](scripts/build-ios-local.sh): preflight →
increment `ios.buildNumber` → prebuild → archive → export to
`build/ipa/Loupe.ipa`. Upload the `.ipa` with **Transporter.app** (Apple ID
`ninjeff06@gmail.com`).

### Xcode — archive and upload from the Organizer

```bash
npm run archive:xcode
```

[`scripts/prepare-xcode-archive.sh`](scripts/prepare-xcode-archive.sh) does
everything Xcode can't, then opens `ios/Loupe.xcworkspace`. In Xcode: set the
destination to **Any iOS Device (arm64)** (Archive is greyed out on a
simulator), then **Product ▸ Archive ▸ Distribute App ▸ TestFlight & App
Store**.

Use this when you want to watch the build, or when Distribute's validation
report is the thing you're after.

**What the script does that Xcode won't**, each of which ships a broken build
if skipped:

1. The `eas-build-pre-install` hook. The set-logo registry is generated code —
   without it the app builds and every set logo is missing.
2. The production env block from `eas.json`. Xcode's bundle phase runs Metro
   with no knowledge of `eas.json`, and `EXPO_PUBLIC_*` values are **inlined at
   bundle time**; `config.googleIosClientId` falls back to `""`, so Google
   sign-in ships silently broken. Written to `.env.production`, which
   `@expo/env` loads only under `NODE_ENV=production` — release bundles, never
   `expo start`. Gitignored.
3. The build number. App Store Connect rejects a repeat *after* the upload.
4. `expo prebuild` + `pod install`. A stale `ios/` archives the last prebuild's
   native config — wrong `Info.plist` strings, wrong OTA channel.

Flags (both scripts): `--clean` regenerates `ios/` from scratch, `--no-bump`
reuses the current build number after a failed attempt. `archive:xcode` also
takes `--no-open` to prepare without launching Xcode.

Things worth knowing:

- **Signing is Xcode's job now.** The EAS distribution certificate's private key
  isn't in this keychain, so `plugins/withIphoneDistributionSigning.js` only
  applies its SHA-1 pin when `EAS_BUILD` is set; locally it switches Release to
  automatic signing against `Apple Distribution: Jeffrey Fernandez`. The two
  `[expo] app.loupe.client AppStore` profiles in `~/Library/MobileDevice/` embed
  the EAS cert and are unusable locally — Xcode mints a fresh one on first
  archive (`-allowProvisioningUpdates`).
- **Build numbers are local now.** `eas.json` moved from
  `appVersionSource: "remote"` to `"local"`, so `app.json` is the counter.
  EAS's last build was 226; local numbering resumes at 227. Commit `app.json`
  after a build or the counter drifts and App Store Connect rejects a repeat.
- **Disk.** `buildReactNativeFromSource: true` means React Native compiles from
  source every archive, which needs tens of GB. The script refuses to start
  below 25GB free rather than dying mid-archive with a misleading compile error.
- **OTA still points at EAS.** `updates.url` is unchanged, so existing installs
  keep checking `u.expo.dev`; EAS Update bills on active users, not per job. If
  it stops being served, `expo-updates` falls back to the bundle embedded in the
  last build — no breakage.

## Layout

```
app/
  _layout.tsx                 root providers
  (tabs)/
    _layout.tsx               bottom tabs
    index.tsx                 Command Center
    vault.tsx                 The Vault
    analytics.tsx             Analytics
  scan/[id].tsx               Forensic Report

src/
  theme/                      Precision palette + ThemeProvider
  components/
    brand/LoupeMark.tsx       SVG logo
    ui/                       GlassCard, StatTile, PrimaryButton, Badge,
                              Skeleton, StatusDot, LiveSyncChip, SectionHeader
  features/
    scanner/                  hardware link + scan CTA
    collection/               vault list + filters
    report/                   split capture, heatmap, score breakdown
  store/                      Zustand stores
  api/                        mock API — swap for the Pi backend
  lib/                        queryClient, format helpers
  types/                      shared domain types
```

## Hooking up the real scanner

Every network call lives in [src/api/forensicApi.ts](src/api/forensicApi.ts). Replace the mock bodies with `fetch` against the Pi (e.g. `http://jfm-scanner.local/api/status`). Nothing else needs to change — TanStack Query keys and Zustand stores stay the same.

## Backend (loupe-backend)

The FastAPI service lives at <https://github.com/wiggapony0925/loupe-backend>.

Configuration is via Expo public env vars — copy `.env.example` to `.env` and set:

| Var | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | Base URL used by [src/api/client.ts](src/api/client.ts) |
| `EXPO_PUBLIC_WS_URL` | `ws://localhost:8000` | WebSocket base (e.g. `/ws/scans`) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | — | Google OAuth client (sign-in flow) |
| `EXPO_PUBLIC_APPLE_CLIENT_ID` | — | Apple Services ID |

Anything else (typed client, endpoint catalog, auth wrappers) is in `src/api/`.
