/**
 * The 404's buttons.
 *
 * The rule worth pinning down is that every destination offered is one the
 * root layout will actually let this user reach. A button that hands the user
 * to a guard which immediately redirects them somewhere else is worse than no
 * button — it reads as the app misbehaving.
 */
import { NOT_FOUND } from "@loupe/marketing";
import { notFoundActions } from "../notFoundActions";

/**
 * Mirrors `PUBLIC_SEGMENTS` in app/_layout.tsx. If that set is narrowed, this
 * copy has to be narrowed too — and the signed-out case below will fail,
 * which is the point.
 */
const PUBLIC_SEGMENTS = new Set(["(auth)", "legal", "+not-found"]);

/** "/(auth)/welcome" → "(auth)", "/search" → "search". */
const firstSegment = (href: string): string => href.split("/").filter(Boolean)[0] ?? "";

describe("notFoundActions — signed in", () => {
  const actions = notFoundActions(true);

  it("offers home as the primary way out", () => {
    expect(actions.primary.kind).toBe("home");
    expect(actions.primary.href).toBe("/");
  });

  it("offers the browse surface as the alternative", () => {
    expect(actions.secondary?.kind).toBe("browse");
    expect(actions.secondary?.href).toBe("/search");
  });

  it("uses the copy shared with the website", () => {
    expect(actions.primary.label).toBe(NOT_FOUND.ctaHome);
    expect(actions.secondary?.label).toBe(NOT_FOUND.ctaBrowse);
  });
});

describe("notFoundActions — signed out", () => {
  const actions = notFoundActions(false);

  it("sends the visitor to the one door they can open", () => {
    expect(actions.primary.kind).toBe("signIn");
    expect(actions.primary.href).toBe("/(auth)/welcome");
    expect(actions.primary.label).toBe(NOT_FOUND.ctaSignedOut);
  });

  it("drops the browse button rather than offering a decoy", () => {
    // Every tab is behind the auth guard, so "Browse the market" would bounce
    // straight back to welcome and look like the button did nothing.
    expect(actions.secondary).toBeNull();
  });

  it("offers nothing the auth guard would redirect away from", () => {
    const offered = [actions.primary, actions.secondary].filter(Boolean);
    for (const action of offered) {
      expect(PUBLIC_SEGMENTS.has(firstSegment(action!.href as string))).toBe(true);
    }
  });
});

describe("notFoundActions — both states", () => {
  it("always gives the user at least one way out", () => {
    for (const authed of [true, false]) {
      const { primary } = notFoundActions(authed);
      expect(primary.href).toBeTruthy();
      expect(primary.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("never points the two buttons at the same place", () => {
    const { primary, secondary } = notFoundActions(true);
    expect(primary.href).not.toBe(secondary?.href);
  });
});
