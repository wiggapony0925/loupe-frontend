/**
 * Every route builder must point at a screen that actually exists.
 *
 * expo-router resolves paths at RUNTIME from the filesystem, so a typo or a
 * renamed screen is invisible to TypeScript and to every other test — it
 * surfaces as a tap that goes nowhere on someone's phone. This walks `app/`
 * and checks the registry against it.
 *
 * Each case states the screen it expects explicitly rather than deriving it,
 * so the test can't quietly "normalise" a wrong answer into a passing one.
 */
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { routes } from "@/shared/routes";

const APP_DIR = join(__dirname, "../../../app");

/** Filesystem → the route paths expo-router will serve, with `[param]` for
 *  dynamic segments. Group folders like `(tabs)` don't appear in the URL. */
function discoverRoutes(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const segment = entry.startsWith("(") ? prefix : `${prefix}/${entry}`;
      found.push(...discoverRoutes(full, segment));
      continue;
    }
    if (!entry.endsWith(".tsx")) continue;
    const name = entry.replace(/\.tsx$/, "");
    if (name === "_layout" || name.startsWith("+")) continue;
    const leaf = name.replace(/^\[.+\]$/, "[param]");
    found.push(leaf === "index" ? prefix || "/" : `${prefix}/${leaf}`);
  }
  return found;
}

const SAMPLE = "sample-id-1234";
/** Real catalog ids are composite — this is the shape that breaks paths. */
const COMPOSITE = "pokemontcg:base1-4";

/** builder output → the screen file it must resolve to. */
const CASES: [name: string, href: string, screen: string][] = [
  ["home", routes.home(), "/"],
  ["vault", routes.vault(), "/vault"],
  ["search", routes.search(), "/search"],
  ["analytics", routes.analytics(), "/analytics"],
  ["settings", routes.settings(), "/settings"],
  ["statements", routes.statements(), "/statements"],
  ["notifications", routes.notifications(), "/notifications"],
  ["sealed", routes.sealed(), "/sealed"],
  ["watchlist", routes.watchlist(), "/watchlist"],
  ["welcome", routes.welcome(), "/welcome"],
  ["legal", routes.legal("terms"), "/legal/[param]"],
  ["collector", routes.collector("someone"), "/u/[param]"],
  ["card", routes.card(COMPOSITE), "/card/[param]"],
  ["scan", routes.scan(SAMPLE), "/scan/[param]"],
  ["gradeEdit", routes.gradeEdit(SAMPLE), "/grade/[param]"],
  ["sealedDetail", routes.sealedDetail(SAMPLE), "/sealed/[param]"],
];

/** A built href → the screen shape it will resolve to. */
function screenFor(href: string): string {
  const path = href.split("?")[0]!.replace(/\(.+?\)\//g, "");
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  // The last segment of a builder that took an argument is the parameter.
  return `/${segments.join("/")}`;
}

describe("route registry ↔ app/ filesystem", () => {
  const fileRoutes = new Set(discoverRoutes(APP_DIR));

  it("discovers the app's screens", () => {
    expect(fileRoutes.size).toBeGreaterThan(20);
    expect(fileRoutes.has("/vault")).toBe(true);
    expect(fileRoutes.has("/card/[param]")).toBe(true);
  });

  it.each(CASES)("routes.%s() → %s exists", (_name, href, screen) => {
    expect(fileRoutes.has(screen)).toBe(true);
    // …and the built path really is that screen, not a lookalike.
    const built = screenFor(href);
    const shape = screen.includes("[param]")
      ? built.split("/").slice(0, -1).join("/")
      : built;
    const expected = screen.includes("[param]")
      ? screen.split("/").slice(0, -1).join("/")
      : screen;
    expect(shape).toBe(expected);
  });
});

describe("id encoding", () => {
  /** Every builder that takes an id must encode it: composite catalog ids
   *  carry a colon, which splits the path when left raw. */
  it.each([
    ["card", routes.card(COMPOSITE)],
    ["sealedDetail", routes.sealedDetail(COMPOSITE)],
    ["scan", routes.scan(COMPOSITE)],
    ["gradeEdit", routes.gradeEdit(COMPOSITE)],
  ])("routes.%s() encodes a composite id", (_name, href) => {
    expect(href).not.toContain(COMPOSITE);
    expect(decodeURIComponent(href.split("/").pop()!)).toBe(COMPOSITE);
  });

  it("encodes a handle containing a character that would split the path", () => {
    expect(routes.collector("a/b")).not.toContain("a/b");
  });
});
