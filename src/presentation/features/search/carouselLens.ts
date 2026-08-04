/**
 * carouselLens — the pure "compile a recipe over a fetched shelf" logic behind
 * the mobile marketplace carousels, mirroring the web `cardFilters` lens.
 *
 * The backend (`/v1/public/carousels`) owns WHICH shelves exist and their
 * filters; the client fetches the priced shelf then narrows it here — price
 * band, rarity pattern, sort, limit. Kept free of React/React-Native imports so
 * it's unit-testable in isolation.
 */
import type { CardWire } from "@/presentation/cards";
import type { CarouselRecipeWire } from "@/infrastructure/http";

const priceOf = (c: CardWire): number | null =>
  c.pricing_summary?.market?.amount ?? null;

/** Apply a recipe's price band / rarity / sort / limit to a fetched shelf. */
export function applyRecipeLens(
  cards: CardWire[],
  recipe: CarouselRecipeWire,
): CardWire[] {
  let out = cards;

  const min = recipe.priceMin ?? null;
  const max = recipe.priceMax ?? null;
  if (min != null || max != null) {
    // A price-band rail only makes sense for cards that HAVE a price.
    out = out.filter((c) => {
      const p = priceOf(c);
      if (p == null) return false;
      if (min != null && p < min) return false;
      if (max != null && p > max) return false;
      return true;
    });
  }

  if (recipe.rarityPattern) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(recipe.rarityPattern, "i");
    } catch {
      re = null; // tolerate a malformed pattern rather than crash the rail
    }
    if (re) out = out.filter((c) => (c.rarity ? re!.test(c.rarity) : false));
  }

  const sort = recipe.sort ?? "price_desc";
  if (sort === "price_desc" || sort === "price_asc") {
    const dir = sort === "price_desc" ? -1 : 1;
    out = [...out].sort((a, b) => ((priceOf(a) ?? 0) - (priceOf(b) ?? 0)) * dir);
  } else if (sort === "name") {
    out = [...out].sort((a, b) => a.name.localeCompare(b.name));
  }

  return out.slice(0, recipe.limit ?? 20);
}
