/**
 * Vault list layout helpers — keep FlatList at `numColumns={1}` forever
 * by chunking cards into rows for grid mode. Changing `numColumns` mid-
 * flight forces a remount (RN limitation) which jumps the header.
 */

export type VaultViewMode = "list" | "grid";

/** How many grid columns for a given screen width. */
export function vaultGridColumns(screenWidth: number): number {
  if (screenWidth >= 768) {
    return Math.max(2, Math.min(4, Math.floor(screenWidth / 220)));
  }
  return 2;
}

/** Chunk an array into fixed-size rows (last row may be shorter). */
export function chunkRows<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size) as T[]);
  }
  return rows;
}

/**
 * Build FlatList data for the vault. List mode = one card per row;
 * grid mode = `columns` cards per row. FlatList always uses numColumns=1.
 */
export function vaultListRows<T>(
  items: readonly T[],
  mode: VaultViewMode,
  columns: number,
): T[][] {
  if (mode === "list") return items.map((item) => [item]);
  return chunkRows(items, columns);
}
