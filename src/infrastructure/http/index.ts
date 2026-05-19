/**
 * HTTP infrastructure barrel — envelope, atoms, and all wire types.
 *
 * Tiers:
 *   - `envelope`  Universal `Envelope<T>` + meta + pagination + error
 *   - `atoms`     Wire-level scalars (`ID`, `Money`, `Tcg`, `ScanStatus`, …)
 *   - `wire/*`    Resource-grouped wire shapes (catalog, market, grading, …)
 */

export * from "./envelope";
export * from "./atoms";
export * from "./wire";
