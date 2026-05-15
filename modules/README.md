# Native Modules (Swift + Kotlin)

This folder holds **local Expo Modules** — Swift (iOS) and Kotlin (Android)
code that bridges to JavaScript. Local modules live inside the project,
are autolinked by Expo at build time, and require no `npm publish`.

## Folder layout

```
modules/
  <module-name>/
    expo-module.config.json     # autolink manifest
    index.ts                    # JS entry — re-exports the module + types
    src/
      <Name>Module.ts           # TS declaration of the native interface
      <Name>.types.ts           # Shared event / prop types
    ios/
      <Name>Module.swift        # iOS implementation (Expo Modules DSL)
    android/src/main/java/expo/modules/<name>/
      <Name>Module.kt           # Android implementation (Expo Modules DSL)
```

## Boundary rule

App code **never** imports from `modules/` directly. Always go through the
typed facade in [`src/native/`](../src/native):

```ts
// ✅ good
import { scannerBridge } from "@/native";

// ❌ bad — leaks native paths into features
import LoupeScannerBridge from "../../modules/loupe-scanner-bridge";
```

The facade lets us mock the native surface in Expo Go / unit tests and
keeps `requireNativeModule` calls in one place.

## Workflow

1. **Edit native code** in `ios/*.swift` or `android/**/*.kt`.
2. **Mirror the API** in `src/<Name>Module.ts` (TS declaration) and the
   facade in `src/native/`.
3. **Rebuild** — native changes do _not_ hot-reload:
   ```bash
   npx expo run:ios      # or npx expo run:android
   ```
4. Native modules are **not available in Expo Go**. Use a development
   build or `eas build --profile development`.

## Adding a new module

```bash
npx create-expo-module@latest --local <module-name>
```

Then create a matching facade under `src/native/<name>.ts` and re-export
it from `src/native/index.ts`.

## Why Expo Modules instead of classic RN bridge?

- Write Swift/Kotlin directly — no Objective-C bridging header, no
  `RCT_EXTERN_MODULE` boilerplate.
- Built on TurboModules / JSI — strongly typed, faster than the legacy
  bridge.
- One DSL covers methods, async functions, events, constants, and views.
- Stays inside the managed Expo workflow (no permanent eject).
