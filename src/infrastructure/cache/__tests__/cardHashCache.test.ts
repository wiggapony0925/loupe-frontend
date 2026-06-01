import type { IdentifyCandidate } from "@/infrastructure/repositories/identifyRepository";
import {
  _peekCardHashCache,
  clearCardHashCache,
  hammingDistance,
  lookupCardByHash,
  rememberCardHash,
} from "../cardHashCache";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      __reset: () => {
        store = {};
      },
    },
  };
});

function makeCandidate(id: string, name = "Charizard"): IdentifyCandidate {
  return {
    card_id: id,
    upstream_id: null,
    name,
    set_name: "Base Set",
    set_code: "BS",
    number: "4",
    image_url: null,
    tcg: "pokemon",
    confidence: 0.92,
    source: "phash",
    breakdown: {},
  };
}

describe("cardHashCache", () => {
  beforeEach(async () => {
    await clearCardHashCache();
  });

  test("hammingDistance — identical hashes", () => {
    expect(hammingDistance("ffffffffffffffff", "ffffffffffffffff")).toBe(0);
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
  });

  test("hammingDistance — fully opposite hashes", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });

  test("hammingDistance — single bit difference", () => {
    expect(hammingDistance("0000000000000000", "0000000000000001")).toBe(1);
    expect(hammingDistance("0000000000000001", "0000000000000003")).toBe(1);
  });

  test("hammingDistance — malformed input returns sentinel", () => {
    expect(hammingDistance("short", "ffffffffffffffff")).toBe(65);
    expect(hammingDistance("zzzzzzzzzzzzzzzz", "0000000000000000")).toBe(65);
  });

  test("lookup returns null on empty cache", async () => {
    const hit = await lookupCardByHash("a1b2c3d4e5f60718");
    expect(hit).toBeNull();
  });

  test("remember then lookup exact hash returns the candidate", async () => {
    const cand = makeCandidate("c1");
    await rememberCardHash("a1b2c3d4e5f60718", cand, 0.92);
    const hit = await lookupCardByHash("a1b2c3d4e5f60718");
    expect(hit).not.toBeNull();
    expect(hit!.candidate.card_id).toBe("c1");
    expect(hit!.distance).toBe(0);
  });

  test("lookup matches within threshold (≤4 bits)", async () => {
    await rememberCardHash("a1b2c3d4e5f60718", makeCandidate("c1"), 0.9);
    // Flip 3 low bits → distance 3.
    const hit = await lookupCardByHash("a1b2c3d4e5f6071f");
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBe(3);
  });

  test("lookup misses when distance exceeds threshold", async () => {
    await rememberCardHash("0000000000000000", makeCandidate("c1"), 0.9);
    // Distance 8 — well above the 4-bit threshold.
    const hit = await lookupCardByHash("00000000000000ff");
    expect(hit).toBeNull();
  });

  test("lookup returns the closest match when multiple are in range", async () => {
    await rememberCardHash("0000000000000000", makeCandidate("far"), 0.9);
    await rememberCardHash("0000000000000001", makeCandidate("near"), 0.9);
    const hit = await lookupCardByHash("0000000000000001");
    expect(hit).not.toBeNull();
    expect(hit!.candidate.card_id).toBe("near");
    expect(hit!.distance).toBe(0);
  });

  test("repeated lookup bumps hit count + recency", async () => {
    await rememberCardHash("a1b2c3d4e5f60718", makeCandidate("c1"), 0.9);
    await lookupCardByHash("a1b2c3d4e5f60718");
    const hit = await lookupCardByHash("a1b2c3d4e5f60718");
    expect(hit!.cachedHits).toBe(2);
  });

  test("remembering the same hash refreshes instead of duplicating", async () => {
    await rememberCardHash("a1b2c3d4e5f60718", makeCandidate("c1", "Old"), 0.7);
    await rememberCardHash("a1b2c3d4e5f60718", makeCandidate("c1", "New"), 0.95);
    const entries = _peekCardHashCache();
    const dupes = entries.filter((e) => e.hash === "a1b2c3d4e5f60718");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.candidate.name).toBe("New");
    // Should keep the higher confidence.
    expect(dupes[0]!.confidence).toBeCloseTo(0.95);
  });

  test("malformed hashes are rejected", async () => {
    await rememberCardHash("short", makeCandidate("c1"), 0.9);
    expect(_peekCardHashCache()).toHaveLength(0);
    const hit = await lookupCardByHash("short");
    expect(hit).toBeNull();
  });
});
