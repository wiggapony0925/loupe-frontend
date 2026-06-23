// Loupe Metro config — Expo SDK 52 + NativeWind v4.
// Keep this thin: every plugin we add here taxes the dev cycle.

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// ── Shared chart geometry (`@loupe/chart`) ──
// VENDORED into the repo at vendor/loupe-chart (pure TS, mirrors the monorepo
// packages/chart) so it survives EAS build staging — the local/cloud builders
// copy ONLY this project to a temp dir, which drops the monorepo's sibling
// ../packages. Resolving from an in-repo path is the only thing that survives.
// Re-sync from the canonical source with `npm run sync:chart`.
const chartPkg = path.resolve(__dirname, "vendor/loupe-chart");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@loupe/chart": chartPkg,
};

module.exports = withNativeWind(config, { input: "./global.css" });
