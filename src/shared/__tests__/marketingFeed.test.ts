/**
 * Guards the trending-feed shaping shared with loupe-web (`@loupe/marketing`).
 *
 * The hero and the home rails both depend on this staying mixed and stable
 * when an upstream game feed goes empty, which is the common failure mode.
 */
import { interleaveById, pickPopulated } from "@loupe/marketing";

const card = (id: string) => ({ id });

describe("pickPopulated", () => {
  it("prefers the primary list when it has items", () => {
    expect(pickPopulated([card("a")], [card("b")])).toEqual([card("a")]);
  });

  it("falls back when the primary list is empty or missing", () => {
    expect(pickPopulated([], [card("b")])).toEqual([card("b")]);
    expect(pickPopulated(undefined, [card("b")])).toEqual([card("b")]);
  });

  it("returns an empty list when neither side has anything", () => {
    expect(pickPopulated(undefined, undefined)).toEqual([]);
  });
});

describe("interleaveById", () => {
  it("round-robins across lists so no single game leads", () => {
    const out = interleaveById(
      [
        [card("pk1"), card("pk2")],
        [card("mg1"), card("mg2")],
        [card("yg1"), card("yg2")],
      ],
      (c) => c.id,
    );
    expect(out.map((c) => c.id)).toEqual([
      "pk1",
      "mg1",
      "yg1",
      "pk2",
      "mg2",
      "yg2",
    ]);
  });

  it("keeps the remaining games mixed when one list is short", () => {
    const out = interleaveById(
      [[card("pk1")], [card("mg1"), card("mg2"), card("mg3")], []],
      (c) => c.id,
    );
    // Magic's extras trail the round-robin rather than opening the rail.
    expect(out.map((c) => c.id)).toEqual(["pk1", "mg1", "mg2", "mg3"]);
  });

  it("drops duplicates that appear in more than one feed", () => {
    const out = interleaveById(
      [
        [card("dup"), card("a")],
        [card("dup"), card("b")],
      ],
      (c) => c.id,
    );
    expect(out.map((c) => c.id)).toEqual(["dup", "a", "b"]);
  });

  it("handles no lists and all-empty lists without throwing", () => {
    expect(interleaveById([], (c: { id: string }) => c.id)).toEqual([]);
    expect(interleaveById([[], []], (c: { id: string }) => c.id)).toEqual([]);
  });
});
