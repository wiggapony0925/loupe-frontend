/**
 * The "Precision" palette — design tokens for the Loupe Forensic Suite.
 *
 * The color VALUES + scales now live in `@loupe/tokens` (the single source of
 * truth shared with loupe-web, whose `tokens.scss` is generated from the same
 * file). This module keeps only the RN-specific runtime machinery:
 *   • `palette` — a live object mutated in place by `applyTheme()` so inline
 *     `palette.x.y` reads flip Light/Dark without re-importing.
 *   • `themeVars` — per-scheme NativeWind `vars()` (built from the shared
 *     `nativeWindVars`) so Tailwind shorthands (`bg-bg`, `text-ink`, …) switch
 *     on device, where the `global.css` `:root`/`.dark` vars don't resolve.
 *   • `useThemedPalette()` — subscribes a component to theme changes.
 *
 * Components reading `palette.*` inline must subscribe to a render trigger
 * (e.g. `useThemedPalette()` or `useSettings(s => s.themeMode)`).
 */

import { vars } from "nativewind";
import { useColorScheme } from "react-native";
import {
  darkColors,
  lightColors,
  nativeWindVars,
  radius as tokenRadius,
  spacing as tokenSpacing,
  type ColorSet,
} from "@loupe/tokens";
import { THEME_MODE, type ThemeMode } from "@loupe/theme";
import { useSettings } from "@/application/stores/settingsStore";

/** Resolved color scheme — the shared `ThemeMode` core (matches web). */
export type Scheme = ThemeMode;

/**
 * Map the shared `ColorSet` → the app's palette shape (the subset RN
 * components read: bg/line/ink/accent). Sourced from `@loupe/tokens` so the
 * web SCSS and the app palette can never drift.
 */
function toPalette(c: ColorSet) {
  return {
    bg: { ...c.bg },
    line: { ...c.line },
    ink: { ...c.ink },
    accent: { ...c.accent },
  };
}

export const darkPalette = toPalette(darkColors);
export const lightPalette: typeof darkPalette = toPalette(lightColors);

/** Live palette — mutated by `applyTheme`. Initial value: dark. */
export const palette: typeof darkPalette = toPalette(darkColors);

let activeScheme: Scheme = THEME_MODE.DARK;

export function applyTheme(scheme: Scheme): void {
  const next = scheme === THEME_MODE.LIGHT ? lightPalette : darkPalette;
  Object.assign(palette.bg, next.bg);
  Object.assign(palette.line, next.line);
  Object.assign(palette.ink, next.ink);
  Object.assign(palette.accent, next.accent);
  activeScheme = scheme;
}

export function getActiveScheme(): Scheme {
  return activeScheme;
}

/**
 * Per-scheme `vars()` styles, built from the shared `nativeWindVars` map. On
 * native, NativeWind does NOT flip the `:root`/`.dark` CSS variables declared
 * in `global.css` at runtime — those only resolve on web. To make the Tailwind
 * palette shorthands switch on device, apply `themeVars[scheme]` as an inline
 * style on a wrapping `<View>` (see `ThemeProvider`).
 */
export const themeVars: Record<Scheme, ReturnType<typeof vars>> = {
  light: vars(nativeWindVars(lightColors)),
  dark: vars(nativeWindVars(darkColors)),
};

/** Corner radii + spacing scales — re-exported from the shared token source. */
export const radius = tokenRadius;
export const spacing = tokenSpacing;

/**
 * Maps a 1–10 grade to its semantic display color (reads the LIVE palette so
 * it tracks the active theme). Grade 10 (Gem Mint) is the hero accent.
 */
export const gradeColor = (grade: number): string => {
  if (grade >= 10) return palette.accent.mint;
  if (grade >= 9) return palette.accent.blue;
  if (grade >= 7) return palette.accent.amber;
  return palette.accent.rose;
};

export type Palette = typeof palette;

/** Hex → `rgba()` with alpha. Shared with web so both compute alpha identically. */
export { withAlpha } from "@loupe/tokens";

/**
 * Subscribes the calling component to theme changes and returns the live
 * palette. Use this in any component that reads `palette.*` in its render
 * (inline styles, SVG fills, etc.) so it re-renders when the user toggles
 * Light/Dark/Auto.
 */
export function useThemedPalette(): Palette {
  // Both selectors trigger re-renders so components stay in sync whether
  // the user picks an explicit theme or the device theme flips in "Auto".
  useSettings((s) => s.themeMode);
  useColorScheme();
  return palette;
}
