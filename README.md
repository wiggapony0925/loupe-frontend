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
