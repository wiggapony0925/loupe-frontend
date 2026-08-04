/**
 * The app's one notification feed — price alerts, announcements and articles.
 *
 * Every surface that shows a count or a list reads from here, so the bell, the
 * inbox and any future badge can never disagree about what's waiting.
 *
 * All three queries are independent and none is required: a feed still builds
 * if the blog is unreachable or the user has no alerts, because a failed
 * fetch must not blank an inbox that has other things in it.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { usePriceAlerts } from "@/application/queries/alerts/usePriceAlerts";
import { useNotificationsRead } from "@/application/stores/notificationsReadStore";
import {
  buildNotificationFeed,
  unreadCount,
  type AnnouncementInput,
  type BlogPostInput,
  type FeedItem,
} from "./notificationFeed";

function useAnnouncement() {
  return useQuery<AnnouncementInput>({
    queryKey: ["announcement"],
    queryFn: () => apiFetch<AnnouncementInput>(ENDPOINTS.announcement),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

function useBlogPosts() {
  return useQuery<BlogPostInput[]>({
    queryKey: ["blog", "posts", "feed"],
    queryFn: () =>
      apiFetch<BlogPostInput[]>(ENDPOINTS.blog.posts, { query: { limit: 10 } }),
    // Articles are published rarely; polling them hard would be pure waste.
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
}

export function useNotificationFeed(formatMoney?: (n: number) => string): {
  feed: FeedItem[];
  unread: number;
  markAllRead: () => void;
} {
  const alertsQ = usePriceAlerts({ pending: false });
  const announcementQ = useAnnouncement();
  const postsQ = useBlogPosts();
  const readIds = useNotificationsRead((s) => s.readIds);
  const markAll = useNotificationsRead((s) => s.markAllRead);

  const feed = useMemo(
    () =>
      buildNotificationFeed({
        announcement: announcementQ.data ?? null,
        posts: postsQ.data ?? null,
        alerts: alertsQ.data ?? null,
        readIds,
        formatMoney,
      }),
    [announcementQ.data, postsQ.data, alertsQ.data, readIds, formatMoney],
  );

  return {
    feed,
    unread: unreadCount(feed),
    markAllRead: () => markAll(feed.map((i) => i.id)),
  };
}
