/**
 * @loupe/theme — the framework-agnostic theme-mode core shared by loupe-web
 * and loupe-frontend. No DOM, React, or RN here: just the single source of
 * truth for the resolved color-scheme values + types. Each platform builds its
 * own provider / hook / themed-image on top of this core (web uses a
 * `data-theme` MutationObserver; mobile uses its native palette machinery).
 */

/**
 * The HTML attribute the host stamps the active scheme onto (`<html data-theme>`).
 * Web-only in practice, but the constant lives in the shared core so both
 * surfaces reference one string.
 */
export const THEME_ATTRIBUTE = "data-theme" as const;

/** Single source of truth for the resolved color-scheme values. */
export const THEME_MODE = {
  LIGHT: "light",
  DARK: "dark",
} as const;

/**
 * The resolved scheme actually painted (never a "system" preference). Derived
 * from THEME_MODE so the type can never drift from the constant.
 */
export type ThemeMode = (typeof THEME_MODE)[keyof typeof THEME_MODE];

/**
 * Map a raw attribute value → a `ThemeMode`. Only the two known scheme strings
 * resolve; anything else (missing / unknown) falls back to `fallback`.
 *
 * The fallback is a parameter because the two surfaces differ: loupe is
 * dark-first (pass `THEME_MODE.DARK`), while a light-first host would pass
 * `THEME_MODE.LIGHT` (the default).
 */
export function resolveThemeMode(
  value: string | null | undefined,
  fallback: ThemeMode = THEME_MODE.LIGHT,
): ThemeMode {
  if (value === THEME_MODE.DARK) return THEME_MODE.DARK;
  if (value === THEME_MODE.LIGHT) return THEME_MODE.LIGHT;
  return fallback;
}
