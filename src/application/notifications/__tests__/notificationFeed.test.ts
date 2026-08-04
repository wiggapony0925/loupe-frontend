/**
 * The unified inbox.
 *
 * The rules worth pinning down are the ones that decide whether a badge is
 * trustworthy: only real events count, read state survives a refetch, and
 * nothing silently disappears because a payload was missing a timestamp.
 */
import {
  alertItems,
  announcementItem,
  blogItems,
  buildNotificationFeed,
  unreadCount,
} from "../notificationFeed";

const POST = {
  id: "p1",
  slug: "building-loupe-value",
  title: "Building Loupe Value",
  excerpt: "One defensible number.",
  published_at: "2026-08-01T10:00:00Z",
  status: "published",
};

const TRIGGERED = {
  id: "a1",
  card_id: "card-1",
  card_name: "Umbreon VMAX",
  triggered_at: "2026-08-03T10:00:00Z",
  threshold_usd: 2000,
};

describe("announcementItem", () => {
  it("surfaces an enabled announcement", () => {
    const item = announcementItem({ enabled: true, message: "Scheduled maintenance" });
    expect(item?.category).toBe("system");
    expect(item?.body).toBe("Scheduled maintenance");
  });

  it("ignores a disabled one", () => {
    expect(announcementItem({ enabled: false, message: "hi" })).toBeNull();
  });

  it("ignores an enabled-but-empty one", () => {
    expect(announcementItem({ enabled: true, message: "   " })).toBeNull();
  });

  it("survives a null payload", () => {
    expect(announcementItem(null)).toBeNull();
    expect(announcementItem(undefined)).toBeNull();
  });

  it("keys on the message, so re-fetching the same text is not new", () => {
    const a = announcementItem({ enabled: true, message: "Same" });
    const b = announcementItem({ enabled: true, message: "Same" });
    expect(a?.id).toBe(b?.id);
  });

  it("becomes a new item when the message is edited", () => {
    const a = announcementItem({ enabled: true, message: "Before" });
    const b = announcementItem({ enabled: true, message: "After" });
    expect(a?.id).not.toBe(b?.id);
  });
});

describe("blogItems", () => {
  it("maps a published post to a news item that links to itself", () => {
    const [item] = blogItems([POST]);
    expect(item?.category).toBe("news");
    expect(item?.href).toBe("/blog/building-loupe-value");
  });

  it("excludes drafts — an unpublished post is not news yet", () => {
    expect(blogItems([{ ...POST, status: "draft" }])).toHaveLength(0);
  });

  it("treats a missing status as published", () => {
    expect(blogItems([{ ...POST, status: undefined }])).toHaveLength(1);
  });

  it("handles an empty or missing list", () => {
    expect(blogItems([])).toEqual([]);
    expect(blogItems(null)).toEqual([]);
  });
});

describe("alertItems", () => {
  it("includes an alert that actually fired", () => {
    const [item] = alertItems([TRIGGERED]);
    expect(item?.category).toBe("market");
    expect(item?.title).toContain("Umbreon VMAX");
    expect(item?.href).toBe("/card/card-1");
  });

  it("excludes an armed alert that has not fired", () => {
    // Counting these would leave a badge the user can never clear.
    expect(alertItems([{ ...TRIGGERED, triggered_at: null }])).toHaveLength(0);
  });

  it("formats the threshold with the caller's money formatter", () => {
    const [item] = alertItems([TRIGGERED], (n) => `£${n}`);
    expect(item?.body).toContain("£2000");
  });

  it("omits the threshold line when it isn't a usable number", () => {
    const [item] = alertItems([{ ...TRIGGERED, threshold_usd: "n/a" }]);
    expect(item?.body).toBeNull();
  });
});

describe("buildNotificationFeed", () => {
  it("merges all three sources", () => {
    const feed = buildNotificationFeed({
      announcement: { enabled: true, message: "Maintenance" },
      posts: [POST],
      alerts: [TRIGGERED],
    });
    expect(feed.map((i) => i.category).sort()).toEqual(["market", "news", "system"]);
  });

  it("sorts newest first", () => {
    const feed = buildNotificationFeed({
      posts: [POST], // Aug 1
      alerts: [TRIGGERED], // Aug 3
    });
    expect(feed[0]!.category).toBe("market");
  });

  it("keeps undated items, sorted last rather than dropped", () => {
    const feed = buildNotificationFeed({
      announcement: { enabled: true, message: "No timestamp" },
      alerts: [TRIGGERED],
    });
    expect(feed).toHaveLength(2);
    expect(feed[feed.length - 1]!.category).toBe("system");
  });

  it("marks items as read from the persisted id list", () => {
    const first = buildNotificationFeed({ alerts: [TRIGGERED] });
    const feed = buildNotificationFeed({
      alerts: [TRIGGERED],
      readIds: [first[0]!.id],
    });
    expect(feed[0]!.unread).toBe(false);
  });

  it("keeps ids stable across refetches, so read state survives", () => {
    const a = buildNotificationFeed({ posts: [POST], alerts: [TRIGGERED] });
    const b = buildNotificationFeed({ posts: [POST], alerts: [TRIGGERED] });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it("orders deterministically when timestamps tie", () => {
    const p2 = { ...POST, id: "p2", slug: "second", title: "Second" };
    const a = buildNotificationFeed({ posts: [POST, p2] });
    const b = buildNotificationFeed({ posts: [p2, POST] });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it("returns an empty feed when nothing is available", () => {
    expect(buildNotificationFeed({})).toEqual([]);
  });
});

describe("unreadCount", () => {
  it("counts only unread items", () => {
    const feed = buildNotificationFeed({ posts: [POST], alerts: [TRIGGERED] });
    expect(unreadCount(feed)).toBe(2);
  });

  it("reaches zero once everything is read", () => {
    const feed = buildNotificationFeed({ posts: [POST], alerts: [TRIGGERED] });
    const read = buildNotificationFeed({
      posts: [POST],
      alerts: [TRIGGERED],
      readIds: feed.map((i) => i.id),
    });
    expect(unreadCount(read)).toBe(0);
  });
});
