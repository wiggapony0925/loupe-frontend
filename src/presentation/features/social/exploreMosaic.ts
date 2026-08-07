/**
 * The Explore grid's band math — Instagram's mosaic, as a pure function.
 *
 * The grid is 3 columns. Two band shapes alternate:
 *
 *   HERO band (3 cards, 3 cols x 2 rows)      PLAIN band (3 cards, 1 row)
 *   ┌───────────┬─────┐                       ┌─────┬─────┬─────┐
 *   │           │  b  │                       │  a  │  b  │  c  │
 *   │     a     ├─────┤                       └─────┴─────┴─────┘
 *   │           │  c  │
 *   └───────────┴─────┘
 *
 * Hero bands alternate sides so the big tiles zig-zag rather than stacking
 * into a column, which is what gives Instagram's grid its rhythm.
 *
 * Kept separate from the component and free of React so the layout can be
 * unit-tested: an off-by-one here shows up as a torn grid on a device and
 * as nothing at all in a type check.
 */

/** A card that knows whether the server nominated it to lead a band. */
export interface MosaicItem {
  id: string;
  is_hero: boolean;
}

export interface MosaicBand<T> {
  kind: "hero" | "plain";
  /** Hero bands only: which side the big tile sits on. */
  side: "left" | "right";
  /** Hero bands: [big, small, small]. Plain bands: up to 3 equals. */
  items: T[];
}

/**
 * Group ordered cards into mosaic bands.
 *
 * A hero band needs all three of its cards; a trailing card that can't fill
 * one degrades to a plain band rather than leaving a hole in the grid.
 */
export function mosaicBands<T extends MosaicItem>(items: readonly T[]): MosaicBand<T>[] {
  const bands: MosaicBand<T>[] = [];
  let i = 0;
  let heroCount = 0;

  while (i < items.length) {
    const head = items[i]!;
    const remaining = items.length - i;
    // A hero needs two companions to square off the 3x2 block.
    if (head.is_hero && remaining >= 3) {
      bands.push({
        kind: "hero",
        side: heroCount % 2 === 0 ? "left" : "right",
        items: [items[i]!, items[i + 1]!, items[i + 2]!],
      });
      heroCount += 1;
      i += 3;
      continue;
    }
    bands.push({
      kind: "plain",
      side: "left",
      items: items.slice(i, i + 3),
    });
    i += 3;
  }
  return bands;
}
