/**
 * ThemeProvider — the root of Loupe's design system.
 *
 * Single source of truth for "what does the app look like right now":
 *   1. Resolves the user's preference (`themeMode` in settings + system
 *      `Appearance` for "system" mode) into a concrete `Scheme`.
 *   2. Mirrors that scheme onto the **three** consumers that need it:
 *        - the JS `palette` object (mutated via `applyTheme`) for inline
 *          styles + `useThemedPalette()` callers,
 *        - `nativewind`'s color scheme (drives Tailwind `dark:` variants
 *          + the CSS custom-properties in `global.css`),
 *        - Gluestack UI v3 via `GluestackUIProvider mode={scheme}`.
 *   3. Exposes a reactive `useTheme()` hook so any consumer can read
 *      `{ scheme, palette, radius, spacing, gradeColor, withAlpha }`
 *      and re-render automatically when the user flips the theme.
 *
 * Mount once at the very top of the tree — see `app/_layout.tsx`.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform } from "react-native";
import { useColorScheme } from "nativewind";

import { useSettings } from "@/application/stores/settingsStore";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import {
  applyTheme,
  gradeColor,
  palette,
  radius,
  spacing,
  withAlpha,
  type Palette,
  type Scheme,
} from "./tokens";

interface ThemeContextValue {
  /** Active resolved scheme — never the literal "system". */
  scheme: Scheme;
  /** Live design-token palette. Same reference as the module-level
   *  `palette` export but typed and accessible without importing tokens. */
  palette: Palette;
  radius: typeof radius;
  spacing: typeof spacing;
  /** Hex/rgb → rgba helper, hoisted for ergonomics. */
  withAlpha: typeof withAlpha;
  /** 1–10 grade → semantic accent color. */
  gradeColor: typeof gradeColor;
  /** True when the device is in light mode, regardless of user override. */
  isLight: boolean;
  /** True when the device is in dark mode. */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Resolves `themeMode` (which may be "system") into a concrete scheme. */
function useResolvedScheme(): Scheme {
  const themeMode = useSettings((s) => s.themeMode);
  const [system, setSystem] = useState<Scheme>(() =>
    Appearance.getColorScheme() === "light" ? "light" : "dark",
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, []);
  return themeMode === "system" ? system : (themeMode as Scheme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useResolvedScheme();
  const { setColorScheme } = useColorScheme();

  // 1. JS palette mirror — synchronous so the first render after a toggle
  //    already sees the new values for inline styles / SVG fills.
  applyTheme(scheme);

  // 2. NativeWind class flip — the CSS-vars in global.css flip with it,
  //    which in turn re-skins every Tailwind class and Gluestack token.
  useEffect(() => {
    setColorScheme(scheme);
  }, [scheme, setColorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      palette,
      radius,
      spacing,
      withAlpha,
      gradeColor,
      isLight: scheme === "light",
      isDark: scheme === "dark",
    }),
    [scheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* 3. Gluestack v3 — owns its own colorScheme View. We hand it the
            resolved mode so it stays in lock-step with our palette. */}
      <GluestackUIProvider mode={scheme}>{children}</GluestackUIProvider>
    </ThemeContext.Provider>
  );
}

/**
 * Reactive theme access. Components calling `useTheme()` re-render
 * whenever the user toggles light/dark or the system scheme flips.
 *
 * Falls back to a non-reactive snapshot (with current `palette` values)
 * when used outside the provider — handy for one-off utilities and
 * Jest tests, but the warning makes the mistake loud in dev.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  if (__DEV__ && Platform.OS !== "web") {
    console.warn(
      "[loupe] useTheme() called outside <ThemeProvider> — falling back to module snapshot.",
    );
  }
  return {
    scheme: "dark",
    palette,
    radius,
    spacing,
    withAlpha,
    gradeColor,
    isLight: false,
    isDark: true,
  };
}
