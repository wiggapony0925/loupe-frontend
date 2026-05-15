import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { palette, radius, spacing, getActiveScheme, type Palette, type Scheme } from "./tokens";

interface ThemeContextValue {
  palette: Palette;
  radius: typeof radius;
  spacing: typeof spacing;
  /** Currently active color scheme. Mutated at the root via `applyTheme`. */
  scheme: Scheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({ palette, radius, spacing, scheme: getActiveScheme() }),
    [],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
