import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { palette, radius, spacing, type Palette } from "./tokens";

interface ThemeContextValue {
  palette: Palette;
  radius: typeof radius;
  spacing: typeof spacing;
  /** Always "dark" — the Precision palette is dark-only by design. */
  scheme: "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({ palette, radius, spacing, scheme: "dark" }),
    [],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
