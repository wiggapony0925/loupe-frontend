import type {
  CollectionCard,
  ForensicReport,
  HardwareStatus,
  HeatmapDing,
  PricePoint,
} from "@/types/domain";
import { api } from "@/lib/apiClient";
import { config } from "@/lib/config";

// Each function dispatches to the FastAPI backend in production and falls
// back to deterministic fixtures when EXPO_PUBLIC_USE_MOCKS=true so the app
// remains runnable without the server.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAMPLE_CARDS: CollectionCard[] = [
  {
    id: "card_001",
    title: "Charizard — Holo",
    set: "Pokemon Base Set",
    year: 1999,
    grade: 9.5,
    estimatedValueUsd: 12500,
    thumbnailUri: "https://images.pokemontcg.io/base1/4_hires.png",
    scannedAt: "2026-05-12T14:21:00Z",
  },
  {
    id: "card_002",
    title: "Messi — Final Goal",
    set: "2026 World Cup Goals",
    year: 2026,
    grade: 10,
    estimatedValueUsd: 4200,
    thumbnailUri: "https://placehold.co/300x420/0A84FF/FFFFFF?text=MESSI",
    scannedAt: "2026-05-13T09:02:00Z",
  },
  {
    id: "card_003",
    title: "Blastoise — Holo",
    set: "Pokemon Base Set",
    year: 1999,
    grade: 8,
    estimatedValueUsd: 1800,
    thumbnailUri: "https://images.pokemontcg.io/base1/2_hires.png",
    scannedAt: "2026-05-14T18:44:00Z",
  },
  {
    id: "card_004",
    title: "Mbappé — Hat-Trick",
    set: "2026 World Cup Goals",
    year: 2026,
    grade: 9,
    estimatedValueUsd: 950,
    thumbnailUri: "https://placehold.co/300x420/00F59B/121214?text=MBAPPE",
    scannedAt: "2026-05-14T20:11:00Z",
  },
  {
    id: "card_005",
    title: "Black Lotus",
    set: "Magic Alpha",
    year: 1993,
    grade: 7,
    estimatedValueUsd: 28000,
    thumbnailUri: "https://placehold.co/300x420/2A2A2E/F5F5F7?text=LOTUS",
    scannedAt: "2026-05-15T08:00:00Z",
  },
];

const SAMPLE_DINGS: HeatmapDing[] = [
  { id: "d1", category: "corners", x: 0.06, y: 0.05, radius: 0.06, severity: 0.7 },
  { id: "d2", category: "corners", x: 0.93, y: 0.96, radius: 0.05, severity: 0.5 },
  { id: "d3", category: "edges", x: 0.5, y: 0.02, radius: 0.04, severity: 0.4 },
  { id: "d4", category: "surface", x: 0.42, y: 0.38, radius: 0.08, severity: 0.6 },
  { id: "d5", category: "centering", x: 0.5, y: 0.5, radius: 0.18, severity: 0.3 },
];

export async function fetchHardwareStatus(): Promise<HardwareStatus> {
  if (!config.useMocks) return api.get<HardwareStatus>("/scanner/status");
  await wait(280);
  return {
    transport: "ble",
    deviceName: "JFM-Scanner-Δ7",
    signalStrength: 0.82,
    firmware: "v2.4.1",
    scansRemaining: 1428,
    temperatureC: 41.2,
  };
}

export async function fetchCollection(): Promise<CollectionCard[]> {
  if (!config.useMocks) return api.get<CollectionCard[]>("/collection");
  await wait(420);
  return SAMPLE_CARDS;
}

export interface CollectionSummary {
  totalValueUsd: number;
  cardCount: number;
  avgAccuracy: number;
}

export async function fetchCollectionSummary(): Promise<CollectionSummary> {
  if (!config.useMocks) return api.get<CollectionSummary>("/collection/summary");
  await wait(220);
  const totalValueUsd = SAMPLE_CARDS.reduce((s, c) => s + c.estimatedValueUsd, 0);
  return {
    totalValueUsd,
    cardCount: SAMPLE_CARDS.length,
    avgAccuracy: 0.987,
  };
}

export async function fetchReport(id: string): Promise<ForensicReport> {
  if (!config.useMocks) return api.get<ForensicReport>(`/reports/${id}`);
  await wait(380);
  const card = SAMPLE_CARDS.find((c) => c.id === id) ?? SAMPLE_CARDS[0]!;
  return {
    id: `report_${card.id}`,
    card,
    frontCaptureUri: card.thumbnailUri,
    backCaptureUri: card.thumbnailUri,
    score: {
      surface: 962,
      edges: 941,
      corners: 905,
      centering: 978,
      composite: 947,
      grade: card.grade,
    },
    dings: SAMPLE_DINGS,
    capturedAt: card.scannedAt,
    source: "scanner",
    priceHistory: mockPriceHistory(card.estimatedValueUsd),
    ocr: {
      title: card.title,
      set: card.set,
      year: card.year,
      confidence: 0.94,
      rawLines: [card.title.toUpperCase(), card.set.toUpperCase(), `${card.year}`],
    },
  };
}

/**
 * Generates a deterministic 12-month sold-price walk anchored on the card's
 * current estimated value. Used by the price-history sparkline.
 */
function mockPriceHistory(currentUsd: number): PricePoint[] {
  const points: PricePoint[] = [];
  const venues: PricePoint["venue"][] = ["eBay", "PWCC", "Goldin"];
  let price = currentUsd * 0.7;
  // Seed the walk with a tiny PRNG so the same card always gets the same chart.
  let seed = currentUsd;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 11; i >= 0; i--) {
    const drift = 1 + (rand() - 0.4) * 0.18;
    price = Math.max(currentUsd * 0.45, price * drift);
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    points.push({
      date: date.toISOString().slice(0, 10),
      priceUsd: Math.round(price),
      venue: venues[Math.floor(rand() * venues.length)],
    });
  }
  // Anchor the latest point to the card's current value for visual consistency.
  points[points.length - 1] = {
    ...points[points.length - 1]!,
    priceUsd: currentUsd,
  };
  return points;
}

/* ─── Portfolio history ──────────────────────────────────────────────── */

export type PortfolioRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export interface PortfolioHistory {
  range: PortfolioRange;
  /** Sorted oldest → newest. Synthetic price walk anchored to current value. */
  points: PricePoint[];
  /** USD change from first → last point. */
  deltaUsd: number;
  /** Percentage change from first → last point. */
  deltaPct: number;
}

/**
 * Returns a seeded synthetic value-over-time walk for the user's whole
 * collection at the requested range. Anchors the final point to the live
 * total so the hero value matches the chart's right edge.
 *
 * Real backend will compute this from per-card sold-comp price history.
 */
export async function fetchPortfolioHistory(
  range: PortfolioRange,
): Promise<PortfolioHistory> {
  if (!config.useMocks)
    return api.get<PortfolioHistory>(`/collection/history?range=${range}`);
  await wait(180);

  const total = SAMPLE_CARDS.reduce((s, c) => s + c.estimatedValueUsd, 0);
  const cfg: Record<PortfolioRange, { count: number; vol: number; trend: number }> = {
    "1D": { count: 78, vol: 0.004, trend: 0.012 },
    "1W": { count: 56, vol: 0.008, trend: 0.022 },
    "1M": { count: 48, vol: 0.012, trend: 0.035 },
    "3M": { count: 64, vol: 0.018, trend: 0.06 },
    "1Y": { count: 96, vol: 0.025, trend: 0.18 },
    "ALL": { count: 120, vol: 0.04, trend: 0.42 },
  };
  const { count, vol, trend } = cfg[range];

  // Tiny seeded PRNG so the chart is deterministic per range.
  let seed = (total + range.length * 9973) | 0;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Walk backwards from `total` so the rightmost point equals the live value.
  const start = total / (1 + trend);
  const points: PricePoint[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const driftToTarget = start + (total - start) * t;
    const noise = (rand() - 0.5) * 2 * vol * total;
    price = driftToTarget + noise;
    const date = new Date();
    if (range === "1D") {
      date.setMinutes(date.getMinutes() - (count - 1 - i) * 5);
    } else if (range === "1W") {
      date.setHours(date.getHours() - (count - 1 - i) * 3);
    } else if (range === "1M") {
      date.setHours(date.getHours() - (count - 1 - i) * 16);
    } else if (range === "3M") {
      date.setDate(date.getDate() - (count - 1 - i) * 1.4);
    } else if (range === "1Y") {
      date.setDate(date.getDate() - (count - 1 - i) * 4);
    } else {
      date.setDate(date.getDate() - (count - 1 - i) * 12);
    }
    points.push({
      date: date.toISOString(),
      priceUsd: Math.max(1, Math.round(price)),
    });
  }
  // Anchor right edge.
  points[points.length - 1] = { ...points[points.length - 1]!, priceUsd: total };
  const first = points[0]!.priceUsd;
  const deltaUsd = total - first;
  const deltaPct = first > 0 ? (deltaUsd / first) * 100 : 0;
  return { range, points, deltaUsd, deltaPct };
}

/* ─── Per-card sparklines ────────────────────────────────────────────── */

export interface CardSparkline {
  cardId: string;
  points: number[]; // last 14 normalized closes
  deltaPct: number; // pct change vs first point
}

export async function fetchCardSparklines(): Promise<CardSparkline[]> {
  if (!config.useMocks) return api.get<CardSparkline[]>("/collection/sparklines");
  await wait(140);
  return SAMPLE_CARDS.map((c) => {
    let seed = (c.estimatedValueUsd + c.id.length * 7919) | 0;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const points: number[] = [];
    let v = c.estimatedValueUsd * (0.85 + rand() * 0.2);
    for (let i = 0; i < 14; i++) {
      v = v * (1 + (rand() - 0.45) * 0.05);
      points.push(Math.round(v));
    }
    points[points.length - 1] = c.estimatedValueUsd;
    const deltaPct = ((points[points.length - 1]! - points[0]!) / points[0]!) * 100;
    return { cardId: c.id, points, deltaPct };
  });
}

