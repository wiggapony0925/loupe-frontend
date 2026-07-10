import {
  chunkRows,
  vaultGridColumns,
  vaultListRows,
} from "../vaultLayout";

describe("vaultGridColumns", () => {
  it("returns 2 columns on phones", () => {
    expect(vaultGridColumns(390)).toBe(2);
    expect(vaultGridColumns(430)).toBe(2);
  });

  it("scales on tablets but clamps to 2–4", () => {
    expect(vaultGridColumns(768)).toBe(3);
    expect(vaultGridColumns(1024)).toBe(4);
    expect(vaultGridColumns(2000)).toBe(4);
  });
});

describe("chunkRows", () => {
  it("chunks evenly", () => {
    expect(chunkRows([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("keeps a short final row", () => {
    expect(chunkRows([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  it("handles empty input", () => {
    expect(chunkRows([], 2)).toEqual([]);
  });
});

describe("vaultListRows", () => {
  const cards = ["a", "b", "c", "d", "e"];

  it("list mode wraps each card in its own row (stable numColumns=1)", () => {
    expect(vaultListRows(cards, "list", 2)).toEqual([
      ["a"],
      ["b"],
      ["c"],
      ["d"],
      ["e"],
    ]);
  });

  it("grid mode chunks into column-sized rows without remounting FlatList", () => {
    expect(vaultListRows(cards, "grid", 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("toggling list↔grid only changes row shape — same cards, no remount key needed", () => {
    const list = vaultListRows(cards, "list", 2);
    const grid = vaultListRows(cards, "grid", 2);
    expect(list.flat()).toEqual(grid.flat());
    expect(list.length).toBe(5);
    expect(grid.length).toBe(3);
  });
});
