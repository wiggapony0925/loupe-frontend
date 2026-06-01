/**
 * In-memory + AsyncStorage-backed cache of recently-identified card
 * crops keyed by 64-bit dHash. Lets `LiveIdentifyFlow` skip the network
 * identify round-trip entirely when the user hovers over a card the
 * session has already recognized.
 *
 * Why a hand-rolled LRU instead of expo-sqlite or @tanstack/query:
 *   - We need a Hamming-distance lookup, not exact match. SQL can't do
 *     that without a CTE per query; in-memory scan over ≤200 entries is
 *     ~0.1ms.
 *   - The dataset is bounded and disposable — losing it on app uninstall
 *     is fine, and the cap (200 entries × ~200 bytes JSON ≈ 40KB) fits
 *     comfortably in AsyncStorage.
 *
 * Match semantics: an entry matches the query hash when the Hamming
 * distance ≤ `MATCH_DISTANCE`. Empirically ≤4 means "same card" for our
 * perspective-corrected crops; ≥12 means "different card". The middle
 * is rare in practice because we hash AFTER perspective correction.
 *
 * Threading: every method is async to keep the door open for a future
 * SQLite backend, but the hot path (`lookup`) is synchronous internally
 * — the Promise wrapper is microtask-cheap.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IdentifyCandidate } from "@/infrastructure/repositories/identifyRepository";
import { lookupStaticPhash } from "./staticPhashIndex";

const STORAGE_KEY = "loupe.cardHashCache.v1";
const MAX_ENTRIES = 200;
/** Hamming distance threshold for a cache hit. */
const MATCH_DISTANCE = 4;

export interface CachedIdentification {
  hash: string; // 16-char hex (64-bit dHash)
  candidate: IdentifyCandidate;
  /** Server-side confidence at the time we cached it. */
  confidence: number;
  /** ms since epoch — last time we matched against this entry. */
  lastSeenAt: number;
  /** Times this entry has matched a live frame (informational). */
  hits: number;
}

let entries: CachedIdentification[] = [];
let loaded = false;
let loadingPromise: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedIdentification[];
        if (Array.isArray(parsed)) {
          // Trust but verify — defensive against schema drift.
          entries = parsed.filter(
            (e) =>
              typeof e?.hash === "string" &&
              e.hash.length === 16 &&
              e?.candidate &&
              typeof e.candidate.name === "string",
          );
        }
      }
    } catch {
      // Corrupt cache → start fresh. We don't surface this; the user
      // will just experience one round-trip of cache miss.
      entries = [];
    } finally {
      loaded = true;
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  // Coalesce bursts of writes (e.g. consecutive frames of the same
  // card bumping `lastSeenAt`) into one disk write per second.
  flushTimer = setTimeout(() => {
    flushTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
  }, 1000);
}

/**
 * Hamming distance between two 64-bit hex strings. Returns 65 (i.e.
 * "definitely different") if either input is malformed so the caller's
 * threshold comparison naturally rejects them.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 65;
  // Split into two 32-bit halves to stay inside JS's safe integer range
  // before the bit-twiddling popcount.
  const aHi = parseInt(a.slice(0, 8), 16);
  const aLo = parseInt(a.slice(8, 16), 16);
  const bHi = parseInt(b.slice(0, 8), 16);
  const bLo = parseInt(b.slice(8, 16), 16);
  if (
    Number.isNaN(aHi) ||
    Number.isNaN(aLo) ||
    Number.isNaN(bHi) ||
    Number.isNaN(bLo)
  ) {
    return 65;
  }
  return popcount32(aHi ^ bHi) + popcount32(aLo ^ bLo);
}

// SWAR popcount — fast enough to run on every cache scan without
// pulling in a WASM dep.
function popcount32(x: number): number {
  x = x >>> 0;
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

export interface CacheHit {
  candidate: IdentifyCandidate;
  hash: string;
  distance: number;
  confidence: number;
  cachedHits: number;
}

/**
 * Find the closest cached entry within `MATCH_DISTANCE` of `hash`.
 * Returns `null` on miss. Side-effect: bumps `lastSeenAt` + `hits` on
 * the matched entry so LRU eviction keeps frequently-scanned cards
 * around longer.
 */
export async function lookupCardByHash(hash: string): Promise<CacheHit | null> {
  if (!hash || hash.length !== 16) return null;

  // 1. Per-user LRU first — captures recent feedback / freshly-confirmed
  //    cards, including non-Pokémon TCGs the static manifest doesn't
  //    cover.
  await ensureLoaded();
  if (entries.length > 0) {
    let best: CachedIdentification | null = null;
    let bestDist = MATCH_DISTANCE + 1;
    for (const e of entries) {
      const d = hammingDistance(hash, e.hash);
      if (d < bestDist) {
        bestDist = d;
        best = e;
        if (d === 0) break; // Can't beat an exact match.
      }
    }
    if (best && bestDist <= MATCH_DISTANCE) {
      best.lastSeenAt = Date.now();
      best.hits += 1;
      scheduleFlush();
      return {
        candidate: best.candidate,
        hash: best.hash,
        distance: bestDist,
        confidence: best.confidence,
        cachedHits: best.hits,
      };
    }
  }

  // 2. Fall back to the bundled static manifest of every published
  //    Pokémon TCG card. Synthesise an IdentifyCandidate-shaped
  //    response so the UI doesn't have to special-case the source.
  const staticHit = lookupStaticPhash(hash);
  if (staticHit) {
    const e = staticHit.entry;
    // Calibrate confidence on Hamming distance: 0 → 0.97, 3 → 0.88.
    const confidence = Math.max(0.85, 0.97 - staticHit.distance * 0.03);
    const candidate: IdentifyCandidate = {
      card_id: null,
      upstream_id: `pokemontcg:${e.cardId}`,
      name: e.name,
      set_name: e.setName,
      set_code: e.setId,
      number: e.number,
      image_url: e.imageUrl,
      tcg: "pokemon",
      confidence,
      source: "phash",
      breakdown: { phash_static: 1 - staticHit.distance / 64 },
    };
    return {
      candidate,
      hash: staticHit.hash,
      distance: staticHit.distance,
      confidence,
      cachedHits: 0,
    };
  }

  return null;
}

/**
 * Insert (or refresh) an entry. We only cache server-confirmed matches
 * above the `LOCK_CONFIDENCE` threshold — caching low-confidence guesses
 * would teach the scanner the wrong answer.
 */
export async function rememberCardHash(
  hash: string,
  candidate: IdentifyCandidate,
  confidence: number,
): Promise<void> {
  if (!hash || hash.length !== 16) return;
  await ensureLoaded();

  // Dedupe: if we already have this exact hash, refresh the timestamp.
  const existing = entries.find((e) => e.hash === hash);
  if (existing) {
    existing.candidate = candidate;
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.lastSeenAt = Date.now();
    scheduleFlush();
    return;
  }

  entries.push({
    hash,
    candidate,
    confidence,
    lastSeenAt: Date.now(),
    hits: 0,
  });

  // LRU eviction by lastSeenAt — oldest entries drop off the back when
  // we exceed MAX_ENTRIES. The sort runs once per insert (≤200 items),
  // not per lookup, so it stays off the hot path.
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    entries.length = MAX_ENTRIES;
  }
  scheduleFlush();
}

/** Test / debug helper — wipes the cache from memory and disk. */
export async function clearCardHashCache(): Promise<void> {
  entries = [];
  loaded = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Test helper — exposes the in-memory entries (do not mutate). */
export function _peekCardHashCache(): readonly CachedIdentification[] {
  return entries;
}
