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
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
  },
};
