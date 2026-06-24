/**
 * @loupe/tokens — single source of truth for the "Precision" design language,
 * shared by loupe-web (SVG/SCSS) and loupe-frontend (the Expo app, vendored).
 *
 * Values + the SCSS generator live in the plain-ESM `tokens.js` so they are
 * consumable by Vite, Metro, and bare `node` alike; this entry just re-exports
 * them with full TypeScript types (from `tokens.d.ts`).
 *
 * See `tokens.js` for the rule: change a color/scale ONLY there, then run
 * `npm run gen:tokens` (root) to re-emit the web SCSS.
 */
export * from "./tokens.js";
export type { ColorSet } from "./tokens.js";
