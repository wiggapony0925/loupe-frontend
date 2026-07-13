/**
 * recentRailsStore — replayable shelf-filter tags on the search page.
 *
 * A rail is identified by (id, game): re-opening the same shelf moves its
 * tag to the front instead of duplicating, the list stays capped, and the
 * same rail id under a different game is a distinct tag (Pokémon trending
 * vs Magic trending).
 */
import { useRecentRails } from "@/application/stores/recentRailsStore";

// AsyncStorage's node shim references `window`; persistence is not under
// test here — the dedupe/cap logic is. (jest.mock is hoisted above imports.)
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const rail = (id: string, game = "pokemon", title = id) => ({ id, game, title });

describe("recentRailsStore", () => {
  beforeEach(() => {
    useRecentRails.setState({ items: [] });
  });

  it("dedupes on (id, game) and moves repeats to the front", () => {
    const s = useRecentRails.getState();
    s.push(rail("grails"));
    s.push(rail("trending"));
    s.push(rail("grails", "pokemon", "Grails & chase cards"));
    const items = useRecentRails.getState().items;
    expect(items.map((r) => r.id)).toEqual(["grails", "trending"]);
    expect(items[0]?.title).toBe("Grails & chase cards"); // freshest copy wins
  });

  it("treats the same rail id under different games as distinct tags", () => {
    const s = useRecentRails.getState();
    s.push(rail("trending", "pokemon"));
    s.push(rail("trending", "magic"));
    expect(useRecentRails.getState().items).toHaveLength(2);
  });

  it("caps the list and drops the oldest", () => {
    const s = useRecentRails.getState();
    for (const id of ["a", "b", "c", "d", "e"]) s.push(rail(id));
    const items = useRecentRails.getState().items;
    expect(items.map((r) => r.id)).toEqual(["e", "d", "c", "b"]);
  });

  it("removes one tag and ignores blank pushes", () => {
    const s = useRecentRails.getState();
    s.push(rail("grails"));
    s.push({ id: "", game: "pokemon", title: "" }); // never stored
    s.remove(rail("grails"));
    expect(useRecentRails.getState().items).toEqual([]);
  });
});
