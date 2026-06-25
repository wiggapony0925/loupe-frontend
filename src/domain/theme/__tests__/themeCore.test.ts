import { THEME_MODE, resolveThemeMode } from "@loupe/theme";

/** Guards the shared @loupe/theme core — same constants/types web + app use. */
describe("@loupe/theme core", () => {
  it("resolves the two known scheme strings", () => {
    expect(resolveThemeMode("dark")).toBe(THEME_MODE.DARK);
    expect(resolveThemeMode("light")).toBe(THEME_MODE.LIGHT);
  });

  it("falls back (default light) for missing/unknown values", () => {
    expect(resolveThemeMode(null)).toBe(THEME_MODE.LIGHT);
    expect(resolveThemeMode("nope")).toBe(THEME_MODE.LIGHT);
  });

  it("honors an explicit fallback (loupe web is dark-first)", () => {
    expect(resolveThemeMode(null, THEME_MODE.DARK)).toBe(THEME_MODE.DARK);
    expect(resolveThemeMode("light", THEME_MODE.DARK)).toBe(THEME_MODE.LIGHT);
  });
});
