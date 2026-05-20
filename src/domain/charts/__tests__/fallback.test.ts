import { seededWalk } from "../fallback";

describe("seededWalk", () => {
  it("is deterministic — same seed produces the same walk forever", () => {
    const a = seededWalk("card-42", 100);
    const b = seededWalk("card-42", 100);
    expect(a).toEqual(b);
  });

  it("different seeds produce different walks", () => {
    const a = seededWalk("card-42", 100);
    const b = seededWalk("card-99", 100);
    expect(a).not.toEqual(b);
  });

  it("emits exactly `length` samples", () => {
    expect(seededWalk("x", 100, 24)).toHaveLength(24);
    expect(seededWalk("x", 100, 7)).toHaveLength(7);
  });

  it("clamps length to a minimum of 2", () => {
    expect(seededWalk("x", 100, 0)).toHaveLength(2);
    expect(seededWalk("x", 100, 1)).toHaveLength(2);
    expect(seededWalk("x", 100, -5)).toHaveLength(2);
  });

  it("anchors the right edge to `anchor` exactly", () => {
    const out = seededWalk("seed", 137.42, 14);
    expect(out[out.length - 1]).toBe(137.42);
  });

  it("never drops below the floor anchor * 0.5", () => {
    const anchor = 100;
    const out = seededWalk("dropper", anchor, 64);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(anchor * 0.5);
    }
  });

  it("first sample sits in [0.85, 0.95] × anchor", () => {
    // Sample many seeds — every one should obey the opening range.
    for (let i = 0; i < 20; i++) {
      const out = seededWalk(`seed-${i}`, 1000);
      expect(out[0]).toBeGreaterThanOrEqual(850);
      expect(out[0]).toBeLessThanOrEqual(950);
    }
  });
});
