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
// ── Shared pre-auth copy + feed shaping (`@loupe/marketing`) ──
// Vendored like the others (survives EAS staging). The hero strings the
// welcome screen renders are the same ones loupe-web's landing page uses.
// Re-sync with `npm run sync:marketing`.
const marketingPkg = path.resolve(__dirname, "vendor/loupe-marketing");
// ── Shared auth rules (`@loupe/auth`) ──
// Vendored like the others (survives EAS staging). Password policy mirroring
// the backend's constraints, so the app, the website, and the API agree on
// what a valid password is. Re-sync with `npm run sync:auth`.
const authPkg = path.resolve(__dirname, "vendor/loupe-auth");
// ── Moderation layer (`moderato`) ──
// Vendored like the others, but its canonical source is the standalone
// ../moderato repo (it ships to npm), not ../packages. Only the RN-safe
// parts are vendored — src/web (DOM wrappers) is dropped by the sync.
// Re-sync with `npm run sync:moderato`.
const moderatoPkg = path.resolve(__dirname, "vendor/moderato");
// Agent worktrees are checked out inside the repo at `.claude/worktrees/<name>`
// and each carries its own copy of `vendor/loupe-*`. Metro indexes everything
// under the project root, so leaving them in scope means several packages claim
// the same `@loupe/*` name and resolution becomes ambiguous. (Jest needs the
// same exclusion — see `modulePathIgnorePatterns` in jest.config.js.)
config.resolver.blockList = [/\/\.claude\/worktrees\/.*/];

// moderato's source is ESM: its relative imports carry explicit ".js"
// suffixes that really point at .ts files. Vite resolves that natively and
// jest has a moduleNameMapper for it; Metro needs the same courtesy or the
// release bundle dies with "Unable to resolve module ./useModeratedSubmit.js"
// (which is exactly how build 249's archive failed).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    context.originModulePath.includes("/vendor/moderato/")
  ) {
    return resolve(context, moduleName.slice(0, -3), platform);
  }
  return resolve(context, moduleName, platform);
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@loupe/chart": chartPkg,
  "@loupe/tokens": tokensPkg,
  "@loupe/grade": gradePkg,
  "@loupe/theme": themePkg,
  "@loupe/marketing": marketingPkg,
  "@loupe/auth": authPkg,
  moderato: moderatoPkg,
};

module.exports = withNativeWind(config, { input: "./global.css" });
