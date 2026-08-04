/**
 * One inbox, three sources.
 *
 * The bell used to count price alerts only, so an announcement posted from the
 * admin dashboard or a new article reached nobody — they existed as a banner
 * you could scroll past and a tab you'd have to think to open. Anything worth
 * telling a user belongs in the same place, counted the same way.
 *
 * This module is the pure part: merge, sort, and decide what's unread. The
 * hooks that fetch and the store that remembers what you've read live beside
 * it, so this can be tested without a network or a device.
 */

export type NotificationCategory = "market" | "news" | "system";

export interface FeedItem {
  /** Stable across refetches — it's what read-state is keyed on. */
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  /** ISO timestamp. Items without one sort last rather than being dropped. */
  at: string | null;
  /** Route to open on tap, when the item points somewhere. */
  href: string | null;
  unread: boolean;
}

export interface AnnouncementInput {
  enabled: boolean;
  message: string;
  tone?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  /** Optional — most announcement payloads carry no timestamp. */
  updated_at?: string | null;
}

export interface BlogPostInput {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  published_at?: string | null;
  status?: string | null;
}

export interface PriceAlertInput {
  id: string;
  card_id?: string | null;
  card_name?: string | null;
  triggered_at?: string | null;
  created_at?: string | null;
  threshold_usd?: number | string | null;
}

/**
 * The announcement endpoint returns a single live banner, not a list, and it
 * carries no id. Key it on its own text so that editing the message surfaces
 * it again as unread, while re-fetching the same message does not.
 */
export function announcementItem(
  a: AnnouncementInput | null | undefined,
): FeedItem | null {
  if (!a?.enabled) return null;
  const message = (a.message ?? "").trim();
  if (!message) return null;
  return {
    id: `announcement:${hash(message)}`,
    category: "system",
    title: "Announcement",
    body: message,
    at: a.updated_at ?? null,
    href: a.cta_href ?? null,
    unread: true,
  };
}

/** Published posts only — a draft in the admin dashboard is not news yet. */
export function blogItems(
  posts: readonly BlogPostInput[] | null | undefined,
): FeedItem[] {
  return (posts ?? [])
    .filter((p) => p && p.id && (p.status ?? "published") === "published")
    .map((p) => ({
      id: `blog:${p.id}`,
      category: "news" as const,
      title: p.title,
      body: p.excerpt ?? null,
      at: p.published_at ?? null,
      href: p.slug ? `/blog/${p.slug}` : null,
      unread: true,
    }));
}

/**
 * Only *triggered* alerts are notifications. An armed alert that hasn't fired
 * is a setting, and counting it would leave a badge that never clears.
 */
export function alertItems(
  alerts: readonly PriceAlertInput[] | null | undefined,
  formatMoney: (n: number) => string = (n) => `$${n}`,
): FeedItem[] {
  return (alerts ?? [])
    .filter((a) => a && a.id && a.triggered_at)
    .map((a) => {
      const threshold = Number(a.threshold_usd);
      const target = Number.isFinite(threshold) ? formatMoney(threshold) : null;
      return {
        id: `alert:${a.id}`,
        category: "market" as const,
        title: `${a.card_name ?? "A card"} hit your price`,
        body: target ? `Your alert was set at ${target}.` : null,
        at: a.triggered_at ?? a.created_at ?? null,
        href: a.card_id ? `/card/${a.card_id}` : null,
        unread: true,
      };
    });
}

/**
 * Merge everything, newest first, and mark what's already been read.
 *
 * Undated items sort to the end rather than being dropped — an announcement
 * with no timestamp is still worth showing, just not above today's news.
 */
export function buildNotificationFeed(input: {
  announcement?: AnnouncementInput | null;
  posts?: readonly BlogPostInput[] | null;
  alerts?: readonly PriceAlertInput[] | null;
  readIds?: readonly string[] | null;
  formatMoney?: (n: number) => string;
}): FeedItem[] {
  const read = new Set(input.readIds ?? []);
  const items = [
    ...alertItems(input.alerts, input.formatMoney),
    ...blogItems(input.posts),
    ...(announcementItem(input.announcement)
      ? [announcementItem(input.announcement) as FeedItem]
      : []),
  ].map((i) => ({ ...i, unread: !read.has(i.id) }));

  return items.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : NaN;
    const tb = b.at ? Date.parse(b.at) : NaN;
    const va = Number.isNaN(ta) ? -Infinity : ta;
    const vb = Number.isNaN(tb) ? -Infinity : tb;
    if (va !== vb) return vb - va;
    // Deterministic tiebreak so the list doesn't shuffle between renders.
    return a.id.localeCompare(b.id);
  });
}

/** What the bell shows. Capped for display by the caller, not here. */
export function unreadCount(feed: readonly FeedItem[]): number {
  return feed.reduce((n, i) => (i.unread ? n + 1 : n), 0);
}

/** djb2 — short, stable, and enough to key a message string on. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
