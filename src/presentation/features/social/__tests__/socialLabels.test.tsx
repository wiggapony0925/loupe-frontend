/**
 * The words and numbers on the community surfaces.
 *
 * These are the rules that are easy to get subtly wrong and hard to notice:
 * a pending follow request that invites a second tap (which cancels it), a
 * private vault whose empty state reads as "this person owns nothing", and
 * counts that wrap the stat row.
 */
import {
  collectionGateReason,
  followLabel,
  formatStat,
  pluralize,
  usernameError,
} from "../socialLabels";

describe("followLabel", () => {
  it("offers to follow someone you don't", () => {
    expect(followLabel("none")).toBe("Follow");
  });

  it("says Requested while an ask is outstanding", () => {
    // Saying "Follow" here invites a second tap, which CANCELS the request
    // the user just made — the worst possible outcome of a mislabel.
    expect(followLabel("requested")).toBe("Requested");
  });

  it("says Following once accepted", () => {
    expect(followLabel("following")).toBe("Following");
  });

  it("never offers to follow yourself", () => {
    expect(followLabel("self")).toBe("You");
  });
});

describe("formatStat", () => {
  it("shows small counts exactly", () => {
    expect(formatStat(0)).toBe("0");
    expect(formatStat(7)).toBe("7");
    expect(formatStat(999)).toBe("999");
  });

  it("compacts thousands, keeping one decimal while it means something", () => {
    expect(formatStat(1000)).toBe("1K");
    expect(formatStat(1200)).toBe("1.2K");
    expect(formatStat(9900)).toBe("9.9K");
    expect(formatStat(10_000)).toBe("10K");
  });

  it("compacts millions", () => {
    expect(formatStat(1_000_000)).toBe("1M");
    expect(formatStat(2_400_000)).toBe("2.4M");
  });

  it("never renders a negative or broken count", () => {
    expect(formatStat(-5)).toBe("0");
    expect(formatStat(Number.NaN)).toBe("0");
  });
});

describe("pluralize", () => {
  it("agrees with the number", () => {
    expect(pluralize(1, "follower")).toBe("follower");
    expect(pluralize(0, "follower")).toBe("followers");
    expect(pluralize(2, "follower")).toBe("followers");
  });
});

describe("collectionGateReason", () => {
  it("says nothing when there are cards to show", () => {
    expect(
      collectionGateReason({
        isPrivate: false,
        relationship: "none",
        cardCount: 12,
      }),
    ).toBeNull();
  });

  it("explains a private vault rather than showing it as empty", () => {
    const gate = collectionGateReason({
      isPrivate: true,
      relationship: "none",
      cardCount: 40,
    });
    // "Nothing here" would misreport a 40-card collection as an empty one.
    expect(gate?.title).toBe("This vault is private");
    expect(gate?.body).toContain("Follow");
  });

  it("tells a requester their ask is still pending", () => {
    const gate = collectionGateReason({
      isPrivate: true,
      relationship: "requested",
      cardCount: 40,
    });
    expect(gate?.body).toContain("waiting");
  });

  it("shows a private vault to an accepted follower", () => {
    expect(
      collectionGateReason({
        isPrivate: true,
        relationship: "following",
        cardCount: 3,
      }),
    ).toBeNull();
  });

  it("always shows you your own vault", () => {
    expect(
      collectionGateReason({
        isPrivate: true,
        relationship: "self",
        cardCount: 3,
      }),
    ).toBeNull();
  });

  it("nudges you to scan when your own vault is empty", () => {
    const gate = collectionGateReason({
      isPrivate: false,
      relationship: "self",
      cardCount: 0,
    });
    expect(gate?.title).toBe("Your vault is empty");
    expect(gate?.body).toContain("Scan");
  });

  it("uses neutral wording for someone else's empty vault", () => {
    const gate = collectionGateReason({
      isPrivate: false,
      relationship: "none",
      cardCount: 0,
    });
    expect(gate?.title).toBe("Nothing here yet");
  });
});

describe("usernameError", () => {
  it("accepts a valid handle", () => {
    expect(usernameError("vintage_vault")).toBeNull();
    expect(usernameError("abc")).toBeNull();
  });

  it("rejects what the server would reject, before the round trip", () => {
    expect(usernameError("")).toBe("Pick a username");
    expect(usernameError("ab")).toBe("At least 3 characters");
    expect(usernameError("a".repeat(31))).toBe("At most 30 characters");
    expect(usernameError("has space")).toBe("Letters, numbers and _ only");
    expect(usernameError("no-dashes")).toBe("Letters, numbers and _ only");
  });

  it("treats handles case-insensitively, matching the backend", () => {
    // The server lowercases on write; rejecting "Ash" here would be a lie.
    expect(usernameError("AshKetchum")).toBeNull();
  });

  it("ignores surrounding whitespace", () => {
    expect(usernameError("  ash  ")).toBeNull();
  });
});

describe("pluralize — the Settings profile card regression", () => {
  it("agrees on a count of one", () => {
    // "1 profile views" shipped and was visible on the Settings profile card.
    expect(`${1} profile ${pluralize(1, "view")}`).toBe("1 profile view");
    expect(`${1} ${pluralize(1, "follower")}`).toBe("1 follower");
    expect(`${1} ${pluralize(1, "like")}`).toBe("1 like");
  });

  it("pluralizes zero and many", () => {
    expect(`${0} profile ${pluralize(0, "view")}`).toBe("0 profile views");
    expect(`${5} ${pluralize(5, "follower")}`).toBe("5 followers");
  });
});
