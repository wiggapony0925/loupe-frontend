/**
 * Adapter: project a `SealedProductWire` into the `CardSearchResult`
 * shape so the live-search row component (`SearchResultRow`) can render
 * sealed products without a parallel UI tree.
 *
 * The mapping is intentionally lossy — sealed has no rarity / number /
 * sparkline, so we leave those undefined. The two display-only overrides
 * (`badgeText="SEALED"`, `priceLabel="MSRP"`) live on the row props.
 */
import type { CardSearchResult, SealedProductWire } from "@/infrastructure/http";

export function sealedToCardSearchResult(s: SealedProductWire): CardSearchResult {
  const msrp = s.msrp_usd != null ? Number(s.msrp_usd) : null;
  return {
    id: s.id,
    name: s.name,
    tcg: s.tcg,
    set_name: s.set_name ?? undefined,
    image_url: s.image_url ?? undefined,
    rarity: prettyProductType(s.product_type),
    source: "sealed_catalog",
    pricing_summary:
      msrp != null
        ? {
            card_id: s.id,
            currency: "USD",
            market: { amount: msrp, currency: "USD" },
            low: null,
            mid: null,
            high: null,
            as_of: null,
            sample_size: null,
            sources: ["msrp"],
          }
        : null,
  };
}

function prettyProductType(t: SealedProductWire["product_type"]): string {
  switch (t) {
    case "booster_box":
      return "Booster Box";
    case "booster_pack":
      return "Booster Pack";
    case "etb":
      return "Elite Trainer Box";
    case "collection_box":
      return "Collection Box";
    case "premium_collection":
      return "Premium Collection";
    case "tin":
      return "Tin";
    case "blister":
      return "Blister";
    case "bundle":
      return "Bundle";
    case "case":
      return "Case";
    default:
      return "Sealed";
  }
}
