/**
 * Loupe ESLint config.
 * Extends Expo's flat preset (covers React, React Native, Hooks, Import).
 */
module.exports = {
  root: true,
  extends: ["expo"],
  ignorePatterns: [
    "node_modules/",
    ".expo/",
    "dist/",
    "build/",
    "ios/",
    "android/",
    "components/ui/", // gluestack-ui generated scaffolding
    "modules/loupe-scanner-bridge/build/",
    "vendor/", // @loupe/chart and other vendored sources — owned upstream, synced in
    "**/__generated__/", // OpenAPI schema + TS types generated from the backend
    "*.config.js",
    "*.config.ts",
  ],
  rules: {
    // Loupe project rules
    "react/no-unescaped-entities": "off",
    "react-hooks/exhaustive-deps": "warn",
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "never",
      },
    ],
    // No console.* in source — pipe through the Sentry helpers instead.
    // `warn`/`error`/`info` slip past linters in prod and leak data; ban them.
    "no-console": "warn",
  },
};
