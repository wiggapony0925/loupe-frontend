/**
 * The "Precision" palette — design tokens for the Loupe Forensic Suite.
 *
 * Two color schemes ship: the original dark "Precision" palette and a
 * warm "Cream" light palette inspired by Apple Music's tinted album view.
 *
 * The exported `palette` object is **mutated in place** by `applyTheme()`
 * when the user toggles the theme in Settings. Consumers (SVG fills,
 * inline styles, `Animated.Value` interpolations) re-read on every render
 * so they pick up the swap automatically. Tailwind class shorthands
 * (`bg-bg`, `text-ink-muted`, …) flip via CSS variables in `global.css`.
 */

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
    base: "#E9DEC7",
    elevated: "#F4EBD9",
    sunken: "#DCCFB8",
  },
  line: {
    default: "#C9BBA1",
    strong: "#A99B82",
  },
  ink: {
    default: "#1C1815",
    muted: "#5C5043",
    dim: "#8F8273",
  },
  accent: {
    mint: "#00A86E",
    blue: "#1A6FE0",
    amber: "#C47C00",
    rose: "#C6352B",
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
