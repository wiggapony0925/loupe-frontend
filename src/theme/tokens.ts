/**
 * The "Precision" Palette — design tokens for the JFM Forensic Suite.
 * Mirrors tailwind.config.js so non-Tailwind code (SVG fills, animated values,
 * StatusBar, etc.) can reference the exact same values.
 */
export const palette = {
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
} as const;

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
