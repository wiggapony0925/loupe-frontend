/**
 * The app's one notification feed — now read straight from the server.
 *
 * This used to merge three endpoints on-device (the announcement banner, the
 * public blog list, and the user's price alerts) and keep read state in device
 * storage. That had three costs: what you'd read was forgotten on reinstall and
 * never agreed with the web, the list couldn't paginate because there was no
 * list — only a merge — and anything the backend wanted to tell one specific
 * user had nowhere to go.
 *
 * The backend now owns the inbox, so this hook is a thin reader over
 * `/v1/me/notifications` — including *which categories exist*, which is why
 * `useNotificationCategories` fetches the filter strip rather than
 * hardcoding it. Four kinds of thing reach a user (community activity,
 * price alerts, news, and messages from the Loupe team); when a fifth
 * ships, the strip grows without an app release.
 */
import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { FeedItem, NotificationCategory } from "./notificationFeed";

/** One page of the server inbox. */
interface NotificationPage {
  items: ServerNotification[];
  total: number;
  page: number;
  page_size: number;
  /** Whole-inbox unread count — not this page's. Drives the badge. */
  unread: number;
}

interface ServerNotification {
  id: string;
  category: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

/** One tab of the filter strip, exactly as the server defines it. */
export interface NotificationCategoryTab {
  key: string;
  label: string;
  description: string;
  icon: string;
  tone: string;
  unread: number;
}

/** Categories the server may send. Anything unrecognised renders as system
 *  rather than being dropped — a notification we can't classify is still one
 *  the user was meant to see. */
const KNOWN: readonly NotificationCategory[] = [
  "market",
  "news",
  "social",
  "billing",
  "system",
];

function toFeedItem(n: ServerNotification): FeedItem {
  const category = (KNOWN as readonly string[]).includes(n.category)
    ? (n.category as NotificationCategory)
    : "system";
  return {
    id: n.id,
    category,
    title: n.title,
    body: n.body,
    at: n.created_at,
    href: n.href,
    unread: n.read_at === null,
  };
}

/**
 * The badge count on its own — a tiny query, so a surface that only wants a
 * dot (the feed's bell, the home tab) never pays for a page of rows it will
 * not render. Shares its cache key with the inbox, so marking everything
 * read clears both at once.
 */
function useUnreadCountQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () =>
      apiFetch<{ unread: number }>(ENDPOINTS.notifications.unreadCount),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

/** Just the number — for a bell that shows a dot and nothing else. */
export function useUnreadNotificationCount(): number {
  return useUnreadCountQuery().data?.unread ?? 0;
}

/**
 * The filter strip: the categories that exist, in display order, each with
 * its own unread count. One request — the alternative is a count query per
 * tab plus one for the total, refetched on every focus.
 */
export function useNotificationCategories(): {
  categories: NotificationCategoryTab[];
  unread: number;
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuth();
  const q = useQuery({
    queryKey: ["notifications", "summary"],
    queryFn: () =>
      apiFetch<{ unread: number; categories: NotificationCategoryTab[] }>(
        ENDPOINTS.notifications.summary,
      ),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
  return {
    categories: q.data?.categories ?? [],
    unread: q.data?.unread ?? 0,
    isLoading: q.isLoading,
  };
}

export function useNotificationFeed(category?: string): {
  feed: FeedItem[];
  unread: number;
  markAllRead: () => void;
  /** True while more pages exist — the screen shows a "load more" affordance. */
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  refetch: () => void;
} {
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();

  // The category is part of the KEY and part of the QUERY. Filtering the
  // loaded pages on the device instead looks identical on a short inbox and
  // is wrong on a long one: "Price alerts" would show only the alerts that
  // happened to be in the 25 rows already fetched, and paging further would
  // fetch 25 more of *everything* to find a couple more matches.
  const listQ = useInfiniteQuery({
    queryKey: ["notifications", "list", category ?? "all"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiFetch<NotificationPage>(ENDPOINTS.notifications.list, {
        query: {
          page: pageParam,
          page_size: PAGE_SIZE,
          ...(category ? { category } : {}),
        },
      }),
    getNextPageParam: (last) =>
      last && last.page * last.page_size < last.total ? last.page + 1 : undefined,
    // The inbox is the kind of thing people pull-to-refresh; don't re-fetch
    // aggressively behind their back. Gated on auth like every other query —
    // a cold boot must never fire it and cache a 401.
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const countQ = useUnreadCountQuery();

  const markAll = useMutation({
    mutationFn: () =>
      apiFetch<{ unread: number }>(ENDPOINTS.notifications.read, {
        method: "POST",
        json: { all: true },
      }),
    onSuccess: () => {
      // Both views of "unread" have to move together, or the badge and the
      // list disagree until something else happens to refetch.
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // This runs during RENDER — a single page missing `items` (a proxy blip,
  // a half-shaped envelope) must degrade to an empty inbox, never throw
  // into the root error boundary and blank the whole app at startup.
  const feed = useMemo(
    () =>
      (listQ.data?.pages ?? []).flatMap((p) =>
        (Array.isArray(p?.items) ? p.items : []).filter(Boolean).map(toFeedItem),
      ),
    [listQ.data],
  );

  // Prefer the list's count when we have it (it's computed in the same
  // transaction as the page); fall back to the standalone badge query.
  // Both are whole-inbox numbers even on a filtered page — the badge counts
  // what is waiting, not what the current tab happens to show.
  const unread = listQ.data?.pages?.[0]?.unread ?? countQ.data?.unread ?? 0;

  const markAllRead = useCallback(() => {
    if (unread > 0) markAll.mutate();
  }, [unread, markAll]);

  const loadMore = useCallback(() => {
    if (listQ.hasNextPage && !listQ.isFetchingNextPage) listQ.fetchNextPage();
  }, [listQ]);

  return {
    feed,
    unread,
    markAllRead,
    hasMore: Boolean(listQ.hasNextPage),
    loadMore,
    isLoading: listQ.isLoading,
    isLoadingMore: listQ.isFetchingNextPage,
    refetch: () => {
      listQ.refetch();
      countQ.refetch();
    },
  };
}
