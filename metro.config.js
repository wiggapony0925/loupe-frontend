// Loupe Metro config — Expo SDK 52 + NativeWind v4.
// Keep this thin: every plugin we add here taxes the dev cycle.

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// ── Monorepo: consume the shared `@loupe/chart` package (pure TS source) ──
// loupe-frontend is its own repo nested in the Loupe monorepo, so the chart
// geometry lives one level up at ../packages/chart. Teach Metro to (1) watch
// that folder and (2) resolve the bare specifier `@loupe/chart` to it. The
// package's `main` points at ./src/index.ts, which babel-preset-expo transpiles
// like any other source file.
const workspaceRoot = path.resolve(__dirname, "..");
const chartPkg = path.resolve(workspaceRoot, "packages/chart");

config.watchFolders = [...(config.watchFolders ?? []), chartPkg];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@loupe/chart": chartPkg,
};

module.exports = withNativeWind(config, { input: "./global.css" });
