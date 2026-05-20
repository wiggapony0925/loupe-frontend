/**
 * Jest configuration — runs the Loupe frontend test suite.
 *
 * Two projects:
 *  - `domain` runs pure-TS unit tests in a plain node env. Fast, no
 *    React Native runtime. Covers `src/domain/**` and `src/shared/**`.
 *  - `app` uses the `jest-expo` preset for component-level tests that
 *    need to render React Native primitives. Covers everything else
 *    under `src/` and `app/`.
 *
 * Paths mirror `tsconfig.json#compilerOptions.paths`: `@/x` resolves
 * to either `src/x` or `x` from the workspace root.
 */
const path = require("path");

const moduleNameMapper = {
  "^@/(.*)$": [
    path.join(__dirname, "src/$1"),
    path.join(__dirname, "$1"),
  ],
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: "domain",
      testEnvironment: "node",
      transform: {
        "^.+\\.(ts|tsx|js|jsx)$": [
          "babel-jest",
          { configFile: path.join(__dirname, "babel.config.js") },
        ],
      },
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      moduleNameMapper,
      testMatch: [
        "<rootDir>/src/domain/**/__tests__/**/*.test.ts",
        "<rootDir>/src/shared/**/__tests__/**/*.test.ts",
        "<rootDir>/src/infrastructure/**/__tests__/**/*.test.ts",
        "<rootDir>/src/application/**/__tests__/**/*.test.ts",
      ],
    },
    {
      displayName: "app",
      preset: "jest-expo",
      moduleNameMapper,
      testMatch: [
        "<rootDir>/src/presentation/**/__tests__/**/*.test.tsx",
        "<rootDir>/app/**/__tests__/**/*.test.tsx",
      ],
      transformIgnorePatterns: [
        "node_modules/(?!(jest-)?@?react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|@gluestack-ui/.*|@legendapp/.*|lucide-react-native)",
      ],
    },
  ],
};
