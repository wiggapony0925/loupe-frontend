// Type surface for the plain-ESM `tokens.js` single source of truth.

export interface ColorSet {
  bg: { base: string; elevated: string; sunken: string };
  line: { default: string; strong: string };
  ink: { default: string; muted: string; dim: string };
  accent: {
    mint: string;
    blue: string;
    amber: string;
    rose: string;
    purple: string;
  };
  /** Ink color that sits on a bright accent fill. */
  onAccent: string;
  shadow: { card: string; pop: string };
}

export const darkColors: ColorSet;
export const lightColors: ColorSet;

export const radius: {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export const spacing: {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
};

export const typography: {
  fontSans: string;
  fontMono: string;
  fontSerif: string;
  text: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
  };
};

export const layout: {
  sidebarW: number;
  sidebarWCollapsed: number;
  topbarH: number;
  contentMax: number;
};

export const motion: { easeOut: string; durFast: number; durMed: number };

export function withAlpha(hex: string, alpha: number): string;
export function hexToTriplet(hex: string): string;
export function gradeColorFor(colors: ColorSet, grade: number): string;
export function nativeWindVars(colors: ColorSet): Record<string, string>;
export function buildScss(): string;
