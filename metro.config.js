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
// ── Shared design tokens (`@loupe/tokens`) ──
// Vendored for the same reason as @loupe/chart (survives EAS staging). The
// single source of truth is the monorepo's packages/tokens; loupe-web's
// tokens.scss is generated from it and the app builds its NativeWind vars from
// the same color sets. Re-sync from the canonical source with `npm run sync:tokens`.
const tokensPkg = path.resolve(__dirname, "vendor/loupe-tokens");
// ── Shared grade engine (`@loupe/grade`) ──
// Vendored like the others (survives EAS staging). Pure-TS rubric math shared
// with loupe-web's /grade playground. Re-sync with `npm run sync:grade`.
const gradePkg = path.resolve(__dirname, "vendor/loupe-grade");
const themePkg = path.resolve(__dirname, "vendor/loupe-theme");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@loupe/chart": chartPkg,
  "@loupe/tokens": tokensPkg,
  "@loupe/grade": gradePkg,
  "@loupe/theme": themePkg,
};

module.exports = withNativeWind(config, { input: "./global.css" });
