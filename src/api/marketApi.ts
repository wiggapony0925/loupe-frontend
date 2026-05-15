/**
 * Market data layer — pricing, comps, and listings for a single card.
 *
 * Designed to be provider-agnostic so we can fan out to many data sources
 * (TCGplayer, eBay sold comps, 130point, PWCC, Goldin, PSA / CGC pop reports,
 * Card Ladder, PriceCharting, COMC, etc.). Each provider is just an entry
 * in `MarketComp.source`.
 *
 * The mock implementation seeds deterministic walks per card id so dev
 * pricing stays stable across reloads while still feeling alive.
 */
import type { CollectionCard, PricePoint } from "@/types/domain";
import { fetchCollection } from "@/api/forensicApi";
import { api } from "@/lib/apiClient";
import { config } from "@/lib/config";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type MarketRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export type MarketCondition = "raw" | "graded" | "pop";

/** Recognized third-party grading houses we surface prices for. */
export type GradingHouse = "PSA" | "CGC" | "BGS" | "SGC" | "TAG";

/** A single graded-tier price tile (e.g. PSA 10 = $4,200). */
export interface GradedTier {
  house: GradingHouse;
  /** Numeric grade — 10, 9.5, 9, 8 (½-grade allowed for CGC/BGS). */
  grade: number;
  priceUsd: number;
  /** Population at this grade-house tier. */
  pop: number;
  /** Pct change vs 30 days ago. */
  deltaPct: number;
}

/** Canonical list of sources we surface in the comps rail. */
export type MarketSource =
  | "TCGplayer"
  | "eBay"
  | "PWCC"
  | "Goldin"
  | "130point"
  | "PSA"
  | "CGC"
  | "PriceCharting"
  | "COMC"
  | "Card Ladder";

export interface MarketComp {
  id: string;
  source: MarketSource;
  /** Sold/asking price in USD. */
  priceUsd: number;
  /** ISO date — when the comp closed or was listed. */
  date: string;
  /** Free-form extra label (grade, lot size, etc.). */
  detail?: string;
  /** "sold" comps anchor real value; "listing" are aspirational. */
  kind: "sold" | "listing" | "index";
}

export interface MarketStats {
  /** 30-day rolling stats. */
  thirtyDay: {
    low: number;
    high: number;
    avg: number;
    sales: number;
    deltaPct: number;
  };
  /** 90-day rolling stats — used for the "Market Cap" panel. */
  ninetyDay: {
    avg: number;
    sales: number;
  };
  /** PSA / CGC population for this card's grade. Provider-merged. */
  pop: {
    psa10: number;
    psa9: number;
    cgc10: number;
    total: number;
  };
}

export interface MarketCard {
  id: string;
  title: string;
  set: string;
  year: number;
  /** Canonical front-face image URL. */
  imageUri: string;
  /** Cached lookup — populated when the user already owns this card. */
  ownedCard?: CollectionCard;
  condition: MarketCondition;
  /** Live "spot" mid-price the chart anchors to. */
  spotUsd: number;
  /** Per-condition headline — RAW (ungraded), GRADED (PSA 9 avg), POP (PSA 10). */
  conditionPrices: Record<MarketCondition, number>;
  stats: MarketStats;
  /**
   * Full multi-house grade ladder — PSA 10/9/8, CGC 10/9.5/9, BGS 10/9.5/9,
   * SGC 10/9.5, TAG 10/9. Sorted by priceUsd desc so the highest-end
   * (BGS Black Label → PSA 10 → …) appears first.
   */
  gradedTiers: GradedTier[];
  /** Range → seeded PricePoint[] walk anchored to spotUsd. */
  history: Record<MarketRange, PricePoint[]>;
  /** Recent sold comps + outstanding listings, newest first. */
  comps: MarketComp[];
}

/* ─── Synthetic catalog ──────────────────────────────────────────────── */

interface CatalogEntry {
  id: string;
  title: string;
  set: string;
  year: number;
  spot: number;
  imageUri: string;
}

/**
 * Discoverable cards beyond the user's vault — populates Search results
 * and powers "I have this card → grade it" on cards they don't yet own.
 */
const CATALOG: CatalogEntry[] = [
  {
    id: "mkt_pikachu_illustrator",
    title: "Pikachu Illustrator",
    set: "Pokemon Promo",
    year: 1998,
    spot: 1_650_000,
    imageUri: "https://placehold.co/600x840/F5C518/121214?text=PIKACHU",
  },
  {
    id: "mkt_charizard_1st",
    title: "Charizard 1st Edition Holo",
    set: "Pokemon Base Set",
    year: 1999,
    spot: 42_000,
    imageUri: "https://images.pokemontcg.io/base1/4_hires.png",
  },
  {
    id: "mkt_lugia_neo",
    title: "Lugia 1st Edition Holo",
    set: "Pokemon Neo Genesis",
    year: 2000,
    spot: 28_500,
    imageUri: "https://placehold.co/600x840/A0B7CC/121214?text=LUGIA",
  },
  {
    id: "mkt_mox_jet",
    title: "Mox Jet",
    set: "Magic Alpha",
    year: 1993,
    spot: 19_800,
    imageUri: "https://placehold.co/600x840/2A2A2E/F5F5F7?text=MOX+JET",
  },
  {
    id: "mkt_blue_eyes_lob",
    title: "Blue-Eyes White Dragon — LOB",
    set: "Yu-Gi-Oh LOB",
    year: 2002,
    spot: 4_200,
    imageUri: "https://placehold.co/600x840/0A84FF/FFFFFF?text=BEWD",
  },
  {
    id: "mkt_luffy_op01",
    title: "Monkey D. Luffy — Leader",
    set: "One Piece Romance Dawn",
    year: 2022,
    spot: 980,
    imageUri: "https://placehold.co/600x840/FF6B35/FFFFFF?text=LUFFY",
  },
  {
    id: "mkt_jordan_rookie",
    title: "Michael Jordan Rookie",
    set: "Fleer 1986",
    year: 1986,
    spot: 18_500,
    imageUri: "https://placehold.co/600x840/CC1F2D/FFFFFF?text=JORDAN",
  },
  {
    id: "mkt_brady_rookie",
    title: "Tom Brady Rookie",
    set: "Bowman Chrome 2000",
    year: 2000,
    spot: 9_400,
    imageUri: "https://placehold.co/600x840/132448/FFFFFF?text=BRADY",
  },
  {
    id: "mkt_elsa_lorcana",
    title: "Elsa — Spirit of Winter",
    set: "Disney Lorcana Rise",
    year: 2024,
    spot: 320,
    imageUri: "https://placehold.co/600x840/4FB3D9/FFFFFF?text=ELSA",
  },
];

/** Returns the merged universe — vault cards + catalog — for browse/search. */
export async function fetchMarketCatalog(): Promise<CatalogEntry[]> {
  if (!config.useMocks) return api.get<CatalogEntry[]>("/market/catalog");
  const owned = await fetchCollection();
  await wait(80);
  const ownedAsCatalog: CatalogEntry[] = owned.map((c) => ({
    id: c.id,
    title: c.title,
    set: c.set,
    year: c.year,
    spot: c.estimatedValueUsd,
    imageUri: c.thumbnailUri,
  }));
  return [...ownedAsCatalog, ...CATALOG];
}

/* ─── Detail fetch ───────────────────────────────────────────────────── */

const RANGES_CFG: Record<MarketRange, { count: number; vol: number; trend: number }> = {
  "1D": { count: 78, vol: 0.005, trend: 0.012 },
  "1W": { count: 56, vol: 0.01, trend: 0.024 },
  "1M": { count: 48, vol: 0.018, trend: 0.04 },
  "3M": { count: 64, vol: 0.024, trend: 0.07 },
  "YTD": { count: 80, vol: 0.028, trend: 0.12 },
  "1Y": { count: 96, vol: 0.034, trend: 0.21 },
  "ALL": { count: 120, vol: 0.05, trend: 0.55 },
};

const SOURCES: MarketSource[] = [
  "eBay",
  "PWCC",
  "Goldin",
  "TCGplayer",
  "130point",
  "PriceCharting",
  "COMC",
];

export async function fetchMarketCard(
  id: string,
  condition: MarketCondition = "graded",
): Promise<MarketCard> {
  if (!config.useMocks)
    return api.get<MarketCard>(`/market/${encodeURIComponent(id)}?condition=${condition}`);

  await wait(180);
  const owned = await fetchCollection();
  const ownedHit = owned.find((c) => c.id === id);
  const catalogHit = CATALOG.find((c) => c.id === id);
  const base: CatalogEntry = ownedHit
    ? {
        id: ownedHit.id,
        title: ownedHit.title,
        set: ownedHit.set,
        year: ownedHit.year,
        spot: ownedHit.estimatedValueUsd,
        imageUri: ownedHit.thumbnailUri,
      }
    : (catalogHit ?? CATALOG[0]!);

  // Per-condition multipliers approximate the RAW < PSA 9 < PSA 10 ladder.
  const conditionPrices: Record<MarketCondition, number> = {
    raw: Math.round(base.spot * 0.18),
    graded: base.spot,
    pop: Math.round(base.spot * 2.6),
  };
  const spotUsd = conditionPrices[condition];

  const history: Record<MarketRange, PricePoint[]> = {} as Record<MarketRange, PricePoint[]>;
  for (const r of Object.keys(RANGES_CFG) as MarketRange[]) {
    history[r] = walk(spotUsd, r, base.id);
  }

  const comps = generateComps(base.id, spotUsd);
  const stats = computeStats(history["1M"], history["3M"], spotUsd, base.id);
  const gradedTiers = generateGradedTiers(base.id, base.spot);

  return {
    id: base.id,
    title: base.title,
    set: base.set,
    year: base.year,
    imageUri: base.imageUri,
    ownedCard: ownedHit,
    condition,
    spotUsd,
    conditionPrices,
    stats,
    gradedTiers,
    history,
    comps,
  };
}

/* ─── Walk + comp generation (deterministic per card id) ─────────────── */

function seededRand(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h | 0;
}

function walk(target: number, range: MarketRange, idSeed: string): PricePoint[] {
  const { count, vol, trend } = RANGES_CFG[range];
  const rand = seededRand(hashId(idSeed) + range.length * 9973);
  const start = target / (1 + trend);
  const points: PricePoint[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const driftToTarget = start + (target - start) * t;
    const noise = (rand() - 0.5) * 2 * vol * target;
    price = driftToTarget + noise;
    const date = new Date();
    if (range === "1D") date.setMinutes(date.getMinutes() - (count - 1 - i) * 5);
    else if (range === "1W") date.setHours(date.getHours() - (count - 1 - i) * 3);
    else if (range === "1M") date.setHours(date.getHours() - (count - 1 - i) * 16);
    else if (range === "3M") date.setDate(date.getDate() - (count - 1 - i) * 1.4);
    else if (range === "YTD") {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      const elapsedDays = (Date.now() - startOfYear) / 86_400_000;
      date.setTime(startOfYear + (elapsedDays / (count - 1)) * i * 86_400_000);
    } else if (range === "1Y") date.setDate(date.getDate() - (count - 1 - i) * 4);
    else date.setDate(date.getDate() - (count - 1 - i) * 12);
    points.push({ date: date.toISOString(), priceUsd: Math.max(1, Math.round(price)) });
  }
  points[points.length - 1] = { ...points[points.length - 1]!, priceUsd: target };
  return points;
}

function generateComps(idSeed: string, spot: number): MarketComp[] {
  const rand = seededRand(hashId(idSeed) + 7919);
  const comps: MarketComp[] = [];
  for (let i = 0; i < 8; i++) {
    const source = SOURCES[Math.floor(rand() * SOURCES.length)]!;
    const drift = 0.78 + rand() * 0.4;
    const date = new Date();
    date.setDate(date.getDate() - i * 4 - Math.floor(rand() * 3));
    const isListing = source === "TCGplayer" || source === "COMC";
    comps.push({
      id: `${idSeed}_comp_${i}`,
      source,
      priceUsd: Math.round(spot * drift),
      date: date.toISOString().slice(0, 10),
      detail:
        source === "PSA" || source === "CGC"
          ? `Pop +${Math.floor(rand() * 12)}`
          : isListing
            ? "Active listing"
            : `PSA ${Math.random() > 0.5 ? "9" : "10"}`,
      kind: isListing ? "listing" : "sold",
    });
  }
  return comps;
}

/**
 * Recognized house-grade ladder. Multipliers are vs the card's "spot" PSA 9
 * baseline — rough industry averages, fine to tune as data partners come on.
 */
const GRADED_LADDER: { house: GradingHouse; grade: number; mult: number }[] = [
  { house: "BGS", grade: 10, mult: 5.6 }, // BGS 10 / Black Label / Pristine
  { house: "PSA", grade: 10, mult: 4.0 },
  { house: "CGC", grade: 10, mult: 3.2 }, // CGC Pristine 10
  { house: "SGC", grade: 10, mult: 2.6 },
  { house: "TAG", grade: 10, mult: 2.4 },
  { house: "BGS", grade: 9.5, mult: 2.0 },
  { house: "CGC", grade: 9.5, mult: 1.55 },
  { house: "SGC", grade: 9.5, mult: 1.4 },
  { house: "PSA", grade: 9, mult: 1.0 },
  { house: "CGC", grade: 9, mult: 0.85 },
  { house: "BGS", grade: 9, mult: 0.9 },
  { house: "TAG", grade: 9, mult: 0.7 },
  { house: "PSA", grade: 8, mult: 0.55 },
  { house: "CGC", grade: 8, mult: 0.5 },
];

function generateGradedTiers(idSeed: string, spot: number): GradedTier[] {
  const rand = seededRand(hashId(idSeed) + 1607);
  const tiers = GRADED_LADDER.map((tier) => {
    const noise = 0.9 + rand() * 0.22;
    const priceUsd = Math.max(1, Math.round(spot * tier.mult * noise));
    const baseTotal = 80 + rand() * 1800;
    const gradeMult =
      tier.grade === 10
        ? 0.18 + rand() * 0.25
        : tier.grade === 9.5
          ? 0.45 + rand() * 0.35
          : tier.grade === 9
            ? 0.75 + rand() * 0.5
            : 1.2 + rand() * 0.6;
    const houseMult =
      tier.house === "PSA"
        ? 1
        : tier.house === "CGC"
          ? 0.32
          : tier.house === "BGS"
            ? 0.18
            : tier.house === "SGC"
              ? 0.14
              : 0.05;
    const pop = Math.max(1, Math.floor(baseTotal * gradeMult * houseMult));
    const deltaPct = (rand() - 0.45) * 14;
    return { house: tier.house, grade: tier.grade, priceUsd, pop, deltaPct };
  });
  tiers.sort((a, b) => b.priceUsd - a.priceUsd);
  return tiers;
}

function computeStats(
  m: PricePoint[],
  q: PricePoint[],
  spot: number,
  idSeed: string,
): MarketStats {
  const rand = seededRand(hashId(idSeed) + 31337);
  const ms = m.map((p) => p.priceUsd);
  const qs = q.map((p) => p.priceUsd);
  const low = Math.min(...ms);
  const high = Math.max(...ms);
  const avg = Math.round(ms.reduce((s, n) => s + n, 0) / ms.length);
  const qAvg = Math.round(qs.reduce((s, n) => s + n, 0) / qs.length);
  const first = ms[0]!;
  const deltaPct = ((spot - first) / first) * 100;
  const psa10 = Math.floor(50 + rand() * 1200);
  const psa9 = Math.floor(psa10 * (1.4 + rand() * 1.2));
  const cgc10 = Math.floor(psa10 * (0.15 + rand() * 0.4));
  return {
    thirtyDay: {
      low,
      high,
      avg,
      sales: Math.floor(8 + rand() * 40),
      deltaPct,
    },
    ninetyDay: {
      avg: qAvg,
      sales: Math.floor(30 + rand() * 120),
    },
    pop: {
      psa10,
      psa9,
      cgc10,
      total: psa10 + psa9 + cgc10 + Math.floor(rand() * 200),
    },
  };
}
