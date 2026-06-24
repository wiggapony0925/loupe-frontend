// ───────────────────────────────────────────────────────────────────────────
// @loupe/tokens — the single source of truth for the "Precision" design
// language. Plain ESM (no TS syntax) so it is consumable everywhere with zero
// tooling: Vite (web), Metro (Expo app, vendored), and bare `node` (the SCSS
// generator). Types live in the sibling `tokens.d.ts`.
//
// Two surfaces consume these values:
//   • loupe-web   → `tokens.scss` is GENERATED from `buildScss()` (do not edit
//                   that file by hand); `theme/tokens.ts` references the same
//                   `var(--…)` names this emits.
//   • loupe-frontend (Expo) → `presentation/theme/tokens.ts` imports the color
//                   sets + scales below and builds its NativeWind `vars()`.
//
// Changing a value here is the ONLY place a color/scale should change; run
// `npm run gen:tokens` (root) afterwards to re-emit the web SCSS.
// ───────────────────────────────────────────────────────────────────────────

/** OLED-grade dark scheme (the default). */
export const darkColors = {
  bg: { base: "#121214", elevated: "#1c1c1e", sunken: "#0b0b0d" },
  line: { default: "#2a2a2e", strong: "#3a3a40" },
  ink: { default: "#f5f5f7", muted: "#a1a1a6", dim: "#6e6e73" },
  accent: {
    mint: "#00f59b",
    blue: "#0a84ff",
    amber: "#ffb020",
    rose: "#ff453a",
    purple: "#9d6bff",
  },
  // Ink that sits on a bright accent fill (text on a mint button): near-black
  // with a faint green cast. Bright accents clear contrast in both schemes.
  onAccent: "#06140d",
  shadow: {
    card: "0 1px 2px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.35)",
    pop: "0 12px 40px rgba(0, 0, 0, 0.55)",
  },
};

/** Notion/Linear-clean light scheme. */
export const lightColors = {
  bg: { base: "#f7f7f8", elevated: "#ffffff", sunken: "#efeff2" },
  line: { default: "#e5e5ea", strong: "#d1d1d6" },
  ink: { default: "#0b0b0d", muted: "#48484a", dim: "#8e8e93" },
  accent: {
    mint: "#00a86e",
    blue: "#0a84ff",
    amber: "#b8860b",
    rose: "#d63b30",
    purple: "#7a4fe8",
  },
  onAccent: "#ffffff",
  shadow: {
    card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 8px 24px rgba(16, 24, 40, 0.06)",
    pop: "0 12px 40px rgba(16, 24, 40, 0.16)",
  },
};

/** Corner radii (px — kept numeric so RN can use them directly). */
export const radius = { xs: 2, sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };

/** Spacing scale (px). */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };

/** Typography — font stacks + the px type scale. */
export const typography = {
  fontSans:
    '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontMono: '"SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace',
  fontSerif:
    '"Fraunces", "New York", "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
  text: { xs: 11, sm: 13, md: 15, lg: 17, xl: 22, "2xl": 28, "3xl": 36, "4xl": 48 },
};

/** Web-only layout rails (px). */
export const layout = {
  sidebarW: 248,
  sidebarWCollapsed: 76,
  topbarH: 64,
  contentMax: 1600,
};

/** Motion primitives. */
export const motion = {
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  durFast: 120,
  durMed: 200,
};

// ── Pure helpers (shared so web SVG + RN inline styles compute alpha the same)

/** `#RGB`/`#RRGGBB`/`#RRGGBBAA` → `rgba(r,g,b,a)`. Returns input untouched if not hex. */
export function withAlpha(hex, alpha) {
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

/** `#RGB`/`#RRGGBB` → `"R G B"` (space-separated, for NativeWind `rgb(var(--…) / <alpha>)`). */
export function hexToTriplet(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Maps a 1–10 grade to its semantic accent within a given color set. */
export function gradeColorFor(colors, grade) {
  if (grade >= 10) return colors.accent.mint;
  if (grade >= 9) return colors.accent.blue;
  if (grade >= 7) return colors.accent.amber;
  return colors.accent.rose;
}

/**
 * The `--loupe-*` NativeWind variable map for a color set (RGB triplets so
 * Tailwind's `rgb(var(--loupe-*) / <alpha-value>)` shorthands work on device).
 * Consumed by the Expo app's `themeVars`.
 */
export function nativeWindVars(colors) {
  return {
    "--loupe-bg-base": hexToTriplet(colors.bg.base),
    "--loupe-bg-elevated": hexToTriplet(colors.bg.elevated),
    "--loupe-bg-sunken": hexToTriplet(colors.bg.sunken),
    "--loupe-line": hexToTriplet(colors.line.default),
    "--loupe-line-strong": hexToTriplet(colors.line.strong),
    "--loupe-ink": hexToTriplet(colors.ink.default),
    "--loupe-ink-muted": hexToTriplet(colors.ink.muted),
    "--loupe-ink-dim": hexToTriplet(colors.ink.dim),
    "--loupe-accent-mint": hexToTriplet(colors.accent.mint),
    "--loupe-accent-blue": hexToTriplet(colors.accent.blue),
    "--loupe-accent-amber": hexToTriplet(colors.accent.amber),
    "--loupe-accent-rose": hexToTriplet(colors.accent.rose),
  };
}

// ── Web SCSS generator ──────────────────────────────────────────────────────

/** Emit one `--key: value;` line. */
function v(name, value) {
  return `  ${name}: ${value};`;
}

/** Emit the per-scheme color block body (shared by :root/dark and light). */
function colorBlock(c) {
  return [
    v("--bg-base", c.bg.base),
    v("--bg-elevated", c.bg.elevated),
    v("--bg-sunken", c.bg.sunken),
    "",
    v("--line", c.line.default),
    v("--line-strong", c.line.strong),
    "",
    v("--ink", c.ink.default),
    v("--ink-muted", c.ink.muted),
    v("--ink-dim", c.ink.dim),
    "",
    v("--accent-mint", c.accent.mint),
    v("--accent-blue", c.accent.blue),
    v("--accent-amber", c.accent.amber),
    v("--accent-rose", c.accent.rose),
    v("--accent-purple", c.accent.purple),
    "",
    v("--on-accent", c.onAccent),
    "",
    v("--up", "var(--accent-mint)"),
    v("--down", "var(--accent-rose)"),
    "",
    v("--shadow-card", c.shadow.card),
    v("--shadow-pop", c.shadow.pop),
  ].join("\n");
}

/**
 * Build the complete `tokens.scss` contents from the values above. The web
 * client's `src/styles/tokens.scss` is the committed output of this — never
 * hand-edit it; change values here and re-run the generator.
 */
export function buildScss() {
  const t = typography;
  return `// ───────────────────────────────────────────────────────────────────────────
// tokens.scss — AUTO-GENERATED from @loupe/tokens. DO NOT EDIT BY HAND.
// Edit packages/tokens/src/tokens.js, then run \`npm run gen:tokens\` (root).
// This guarantees the web client and the Expo app share one palette source.
// Flips on the \`data-theme\` attribute stamped on <html>.
// ───────────────────────────────────────────────────────────────────────────

:root {
  // ── Radius ──
  --radius-xs: ${radius.xs}px;
  --radius-sm: ${radius.sm}px;
  --radius-md: ${radius.md}px;
  --radius-lg: ${radius.lg}px;
  --radius-xl: ${radius.xl}px;
  --radius-pill: ${radius.pill}px;

  // ── Spacing scale ──
  --space-xs: ${spacing.xs}px;
  --space-sm: ${spacing.sm}px;
  --space-md: ${spacing.md}px;
  --space-lg: ${spacing.lg}px;
  --space-xl: ${spacing.xl}px;
  --space-2xl: ${spacing["2xl"]}px;
  --space-3xl: ${spacing["3xl"]}px;

  // ── Typography ──
  --font-sans: ${t.fontSans};
  --font-mono: ${t.fontMono};
  --font-serif: ${t.fontSerif};

  --text-xs: ${t.text.xs}px;
  --text-sm: ${t.text.sm}px;
  --text-md: ${t.text.md}px;
  --text-lg: ${t.text.lg}px;
  --text-xl: ${t.text.xl}px;
  --text-2xl: ${t.text["2xl"]}px;
  --text-3xl: ${t.text["3xl"]}px;
  --text-4xl: ${t.text["4xl"]}px;

  // ── Layout rails ──
  --sidebar-w: ${layout.sidebarW}px;
  --sidebar-w-collapsed: ${layout.sidebarWCollapsed}px;
  --topbar-h: ${layout.topbarH}px;
  --content-max: ${layout.contentMax}px;

  // ── Motion ──
  --ease-out: ${motion.easeOut};
  --dur-fast: ${motion.durFast}ms;
  --dur-med: ${motion.durMed}ms;
}

// ── DARK (default) — OLED-grade ──
:root,
[data-theme="dark"] {
${colorBlock(darkColors)}
  color-scheme: dark;
}

// ── LIGHT — Notion/Linear-clean ──
[data-theme="light"] {
${colorBlock(lightColors)}
  color-scheme: light;
}
`;
}
