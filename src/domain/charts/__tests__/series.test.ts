import {
  computeDelta,
  downsample,
  monotoneCubic,
  nearestIndex,
  pointsToCoords,
  valuesToCoords,
  type Coord,
} from "../series";

describe("monotoneCubic", () => {
  it("returns empty string for fewer than 2 points", () => {
    expect(monotoneCubic([])).toBe("");
    expect(monotoneCubic([[0, 0]])).toBe("");
  });

  it("draws a straight line for exactly 2 points", () => {
    expect(monotoneCubic([[0, 10], [100, 20]])).toBe("M 0 10 L 100 20");
  });

  it("emits a Move + Cubic chain for 3+ points", () => {
    const d = monotoneCubic([[0, 0], [10, 10], [20, 0]]);
    expect(d.startsWith("M 0.00 0.00")).toBe(true);
    // Two segments → two `C` commands.
    expect(d.match(/C /g)?.length).toBe(2);
  });

  it("does not overshoot at a local maximum (Fritsch–Carlson invariant)", () => {
    // Coords with a peak at the middle. The interpolated y at any sample
    // should never exceed the peak.
    const coords: Coord[] = [
      [0, 100],
      [50, 50],
      [100, 100],
      [150, 50],
      [200, 100],
    ];
    const path = monotoneCubic(coords);
    // Pull every numeric coord pair out of the path string and check that
    // no y value drops below 50 (the local min) — i.e. no undershoot.
    const numbers = path.match(/-?\d+\.\d+/g)?.map(Number) ?? [];
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(50);
  });
});

describe("nearestIndex", () => {
  const coords: Coord[] = [
    [0, 0],
    [10, 0],
    [20, 0],
    [30, 0],
  ];
  it("returns 0 for empty coords", () => {
    expect(nearestIndex(123, [])).toBe(0);
  });
  it("snaps to the closest x", () => {
    expect(nearestIndex(-5, coords)).toBe(0);
    expect(nearestIndex(4, coords)).toBe(0);
    expect(nearestIndex(6, coords)).toBe(1);
    expect(nearestIndex(15, coords)).toBe(1); // ties → first match
    expect(nearestIndex(99, coords)).toBe(3);
  });
});

describe("valuesToCoords / pointsToCoords", () => {
  it("returns empty when width or height is 0", () => {
    expect(valuesToCoords([1, 2, 3], 0, 100)).toEqual([]);
    expect(valuesToCoords([1, 2, 3], 100, 0)).toEqual([]);
  });

  it("centers a single point horizontally and vertically", () => {
    const [[x, y]] = valuesToCoords([42], 100, 50) as [Coord];
    expect(x).toBe(50);
    expect(y).toBe(25);
  });

  it("evenly distributes x across width", () => {
    const out = valuesToCoords([1, 2, 3, 4, 5], 100, 50);
    expect(out.map(([x]) => x)).toEqual([0, 25, 50, 75, 100]);
  });

  it("maps min value to the bottom and max to the top, respecting padding", () => {
    const out = valuesToCoords([0, 100], 100, 100, 10);
    // First point is min → y = paddingY + (1-0) * (height - 2*padding) = 10+80 = 90
    // Second point is max → y = paddingY + (1-1) * ... = 10
    expect(out[0]![1]).toBeCloseTo(90);
    expect(out[1]![1]).toBeCloseTo(10);
  });

  it("draws flat values through the vertical center", () => {
    const out = valuesToCoords([5, 5, 5], 100, 80);
    expect(out.every(([, y]) => y === 40)).toBe(true);
  });

  it("pointsToCoords reads priceUsd", () => {
    const out = pointsToCoords(
      [
        { date: "2026-01-01", priceUsd: 10 },
        { date: "2026-01-02", priceUsd: 20 },
      ],
      100,
      50,
    );
    expect(out).toHaveLength(2);
    expect(out[0]![0]).toBe(0);
    expect(out[1]![0]).toBe(100);
  });
});

describe("computeDelta", () => {
  it("returns flat for 0 or 1 points", () => {
    expect(computeDelta([])).toEqual({ absUsd: 0, pct: 0, direction: "flat" });
    expect(computeDelta([100])).toEqual({ absUsd: 0, pct: 0, direction: "flat" });
  });

  it("computes positive delta correctly", () => {
    const d = computeDelta([100, 110]);
    expect(d.absUsd).toBeCloseTo(10);
    expect(d.pct).toBeCloseTo(10);
    expect(d.direction).toBe("up");
  });

  it("computes negative delta correctly", () => {
    const d = computeDelta([200, 150]);
    expect(d.absUsd).toBeCloseTo(-50);
    expect(d.pct).toBeCloseTo(-25);
    expect(d.direction).toBe("down");
  });

  it("guards against divide-by-zero when first value is 0", () => {
    const d = computeDelta([0, 50]);
    expect(d.absUsd).toBe(50);
    expect(d.pct).toBe(0);
    expect(d.direction).toBe("flat");
  });

  it("respects the flat threshold (default 0.05%)", () => {
    // 0.04% change → flat
    expect(computeDelta([10000, 10004]).direction).toBe("flat");
    // 0.06% change → up
    expect(computeDelta([10000, 10006]).direction).toBe("up");
  });

  it("custom flat threshold", () => {
    expect(computeDelta([100, 101], 2).direction).toBe("flat"); // 1% < 2%
    expect(computeDelta([100, 103], 2).direction).toBe("up");
  });
});

describe("downsample", () => {
  it("returns empty for target <= 0", () => {
    expect(downsample([1, 2, 3], 0)).toEqual([]);
    expect(downsample([1, 2, 3], -5)).toEqual([]);
  });

  it("returns a copy when target >= source length", () => {
    const src = [1, 2, 3];
    const out = downsample(src, 10);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(src);
  });

  it("down-samples to exactly target length", () => {
    expect(downsample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toHaveLength(5);
  });

  it("anchors the last sample to the last source value (so right edge is current)", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = downsample(src, 4);
    expect(out[out.length - 1]).toBe(10);
  });
});
