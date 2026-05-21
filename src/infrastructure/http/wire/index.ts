/**
 * Wire-layer barrel — every snake_case shape mirroring `loupe-backend/CONTRACT.md`.
 *
 * Prefer importing from the specific module for clearer dependency graphs:
 *   import type { CardSearchResult } from "@/infrastructure/http/wire/catalog";
 */

export * from "./identity";
export * from "./catalog";
export * from "./market";
export * from "./grading";
export * from "./scan";
export * from "./collection";
export * from "./providers";
export * from "./ws";
export * from "./health";
export * from "./setProgress";
export * from "./alerts";
export * from "./marketIndex";
export * from "./canonicalCard";
export * from "./cardResolve";
