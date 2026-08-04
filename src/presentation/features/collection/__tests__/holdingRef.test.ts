/**
 * Per-copy references.
 *
 * The point of these is that three identical Pikachus become tellable apart,
 * so the properties under test are stability and spread — a ref that changes,
 * or that collides across a vault, is worse than showing nothing.
 */
import { holdingRef, holdingRefWithPosition } from "../holdingRef";

const UUID_A = "b3f1c2d4-5e6a-4b7c-8d9e-0f1a2b3c4d5e";
const UUID_B = "c4e2d3a5-6f7b-4c8d-9e0f-1a2b3c4d5e6f";

describe("holdingRef", () => {
  it("formats as a short, readable ref", () => {
    expect(holdingRef(UUID_A)).toMatch(/^#\d{1,4}$/);
  });

  it("is stable across calls — the same copy keeps the same ref", () => {
    expect(holdingRef(UUID_A)).toBe(holdingRef(UUID_A));
  });

  it("distinguishes two different copies", () => {
    expect(holdingRef(UUID_A)).not.toBe(holdingRef(UUID_B));
  });

  it("returns an empty string when there is no id to derive from", () => {
    expect(holdingRef(null)).toBe("");
    expect(holdingRef(undefined)).toBe("");
    expect(holdingRef("")).toBe("");
    expect(holdingRef("   ")).toBe("");
  });

  it("ignores surrounding whitespace rather than producing a second ref", () => {
    expect(holdingRef(` ${UUID_A} `)).toBe(holdingRef(UUID_A));
  });

  it("spreads well over realistic UUIDs", () => {
    // UUIDs share most of their alphabet, so a weak hash clusters hard. A
    // vault of 500 copies should see essentially no collisions.
    const refs = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      refs.add(holdingRef(`b3f1c2d4-5e6a-4b7c-8d9e-${String(i).padStart(12, "0")}`));
    }
    expect(refs.size).toBeGreaterThan(480);
  });

  it("never returns a negative or overflowed number", () => {
    for (let i = 0; i < 200; i += 1) {
      const ref = holdingRef(`${UUID_A}-${i}`);
      const n = Number(ref.slice(1));
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10_000);
    }
  });
});

describe("holdingRefWithPosition", () => {
  it("adds the ordinal when several copies are owned", () => {
    expect(holdingRefWithPosition(UUID_A, 1, 3)).toBe(
      `${holdingRef(UUID_A)} · 2 of 3`,
    );
  });

  it("omits the ordinal for a single copy — '1 of 1' is noise", () => {
    expect(holdingRefWithPosition(UUID_A, 0, 1)).toBe(holdingRef(UUID_A));
  });

  it("keeps the ref identical whatever the position", () => {
    // The ordinal is context; the ref is identity. Selling a copy must not
    // rename the ones you kept.
    const a = holdingRefWithPosition(UUID_A, 0, 3).split(" · ")[0];
    const b = holdingRefWithPosition(UUID_A, 2, 3).split(" · ")[0];
    expect(a).toBe(b);
  });

  it("returns empty when there is no id", () => {
    expect(holdingRefWithPosition(null, 0, 3)).toBe("");
  });
});
