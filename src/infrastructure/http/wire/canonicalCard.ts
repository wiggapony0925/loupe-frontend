/**
 * CanonicalCard — the unified "holy grail" card object returned by
 * `GET /v1/cards/{id}/canonical`.
 *
 * Mirrors `loupe-backend/app/schemas/canonical_card.py` exactly. Any
 * change here MUST be reflected in the Python schema and vice versa;
 * `tests/test_canonical_card.py` locks the round-trip in CI.
 *
 * Every section is optional — providers only fill in what they have.
 * `provenance.*_sources` lists which provider ids contributed each
 * section, so the UI can flag real-vs-synthesized data.
 */

export const CANONICAL_CARD_VERSION = "1.0.0" as const;

export type ProvenanceKind = "real" | "synthesized" | "cached" | "missing";

export interface CanonicalMoney {
  amount: number;
  currency: string;
}

export interface CanonicalImageAsset {
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}

export interface CanonicalImageSet {
  small: CanonicalImageAsset | null;
  normal: CanonicalImageAsset | null;
  large: CanonicalImageAsset | null;
  art_crop: CanonicalImageAsset | null;
}

export interface CanonicalIdentity {
  id: string;
  name: string;
  tcg: string;
  number: string | null;
  rarity: string | null;
  year: number | null;
  language: string;
  variant: string | null;
  finish: string | null;
  tags: string[];
}

export interface CanonicalSetBlock {
  id: string | null;
  code: string | null;
  name: string | null;
  series: string | null;
  release_date: string | null;
  printed_total: number | null;
  total_cards: number | null;
  logo: CanonicalImageAsset | null;
  symbol: CanonicalImageAsset | null;
}

export interface CanonicalPriceQuote {
  source: string;
  market: CanonicalMoney | null;
  low: CanonicalMoney | null;
  mid: CanonicalMoney | null;
  high: CanonicalMoney | null;
  as_of: string | null;
  sample_size: number | null;
  url: string | null;
}

export interface CanonicalGradedPriceRow {
  house: string;
  grade: number;
  grade_label: string;
  market: CanonicalMoney;
  population: number | null;
  pop_higher: number | null;
  change_pct: number | null;
  last_sale_at: string | null;
  listing_url: string | null;
  source: ProvenanceKind;
}

export interface CanonicalPricing {
  consensus: CanonicalMoney | null;
  currency: string;
  quotes: CanonicalPriceQuote[];
  graded: CanonicalGradedPriceRow[];
  summary: Record<string, number | string | null>;
}

export interface CanonicalPopulationRow {
  source: string;
  house: string;
  grade: string;
  population: number;
  pop_higher: number | null;
}

export interface CanonicalPopulation {
  rows: CanonicalPopulationRow[];
  total: number;
  by_house: Record<string, number>;
}

export interface CanonicalListing {
  source: string;
  title: string;
  price: CanonicalMoney;
  url: string;
  condition: string | null;
  image_url: string | null;
  is_auction: boolean;
  time_left_seconds: number | null;
}

export interface CanonicalComp {
  source: string;
  title: string;
  price: CanonicalMoney;
  sold_at: string;
  condition: string | null;
  grade: string | null;
  house: string | null;
  url: string | null;
  image_url: string | null;
}

export interface CanonicalCert {
  house: string;
  cert_number: string;
  grade: string | null;
  subject: string | null;
  year: string | null;
  brand: string | null;
  category: string | null;
  verified_at: string | null;
}

export interface CanonicalAttributes {
  types?: string[] | null;
  hp?: number | null;
  mana_cost?: string | null;
  type_line?: string | null;
  oracle_text?: string | null;
  abilities?: unknown[] | null;
  attacks?: unknown[] | null;
  [extra: string]: unknown;
}

export interface CanonicalProvenance {
  identity_source: string | null;
  set_source: string | null;
  image_source: string | null;
  pricing_sources: string[];
  population_sources: string[];
  listings_sources: string[];
  comps_sources: string[];
  cert_sources: string[];
  composed_at: string;
  errors: string[];
}

export interface CanonicalCard {
  schema_version: string;
  identity: CanonicalIdentity;
  set: CanonicalSetBlock | null;
  images: CanonicalImageSet | null;
  attributes: CanonicalAttributes | null;
  pricing: CanonicalPricing;
  population: CanonicalPopulation;
  listings: CanonicalListing[];
  comps: CanonicalComp[];
  certs: CanonicalCert[];
  provenance: CanonicalProvenance;
}
