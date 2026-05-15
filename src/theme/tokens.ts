/**
 * The "Precision" palette — design tokens for the Loupe Forensic Suite.
 *
 * Two color schemes ship: an OLED-grade dark palette and a clean,
 * Notion/Linear-inspired white palette.
 *
 * The exported `palette` object is **mutated in place** by `applyTheme()`
 * when the user toggles the theme in Settings. Tailwind class shorthands
 * (`bg-bg`, `text-ink-muted`, …) flip via CSS variables in `global.css`.
 * Components that read `palette.x.y` inline must subscribe to a render
 * trigger (e.g. `useSettings(s => s.themeMode)`) or use the
 * `useThemedPalette()` hook which does it for them.
 */

import { useColorScheme } from "react-native";
import { useSettings } from "@/store/settingsStore";

export type Scheme = "dark" | "light";

export const darkPalette = {
  bg: {
    base: "#121214",
    elevated: "#1C1C1E",
    sunken: "#0B0B0D",
  },
  line: {
    default: "#2A2A2E",
    strong: "#3A3A40",
  },
  ink: {
    default: "#F5F5F7",
    muted: "#A1A1A6",
    dim: "#6E6E73",
  },
  accent: {
    mint: "#00F59B",
    blue: "#0A84FF",
    amber: "#FFB020",
    rose: "#FF453A",
  },
};

export const lightPalette: typeof darkPalette = {
  bg: {
    base: "#F7F7F8",
    elevated: "#FFFFFF",
    sunken: "#EFEFF2",
  },
  line: {
    default: "#E5E5EA",
    strong: "#D1D1D6",
  },
  ink: {
    default: "#0B0B0D",
    muted: "#48484A",
    dim: "#8E8E93",
  },
  accent: {
    mint: "#00A86E",
    blue: "#0A84FF",
    amber: "#B8860B",
    rose: "#D63B30",
  },
};

/** Live palette — mutated by `applyTheme`. Initial value: dark. */
export const palette: typeof darkPalette = {
  bg: { ...darkPalette.bg },
  line: { ...darkPalette.line },
  ink: { ...darkPalette.ink },
  accent: { ...darkPalette.accent },
};

let activeScheme: Scheme = "dark";

export function applyTheme(scheme: Scheme): void {
  const next = scheme === "light" ? lightPalette : darkPalette;
  Object.assign(palette.bg, next.bg);
  Object.assign(palette.line, next.line);
  Object.assign(palette.ink, next.ink);
  Object.assign(palette.accent, next.accent);
  activeScheme = scheme;
}

export function getActiveScheme(): Scheme {
  return activeScheme;
}

export const radius = {
  xs: 2,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;

/**
 * Maps a 1–10 grade to its semantic display color.
 * Grade 10 (Gem Mint) is the hero accent.
 */
export const gradeColor = (grade: number): string => {
  if (grade >= 10) return palette.accent.mint;
  if (grade >= 9) return palette.accent.blue;
  if (grade >= 7) return palette.accent.amber;
  return palette.accent.rose;
};

export type Palette = typeof palette;

/**
 * Convert a hex color to an `rgba()` string with the requested alpha.
 * Handles `#RGB`, `#RRGGBB`, and `#RRGGBBAA`. Returns the input untouched
 * if it doesn't look like a hex color (so `withAlpha("transparent", 1)`
 * is safe).
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!hex || hex[0] !== "#") return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
