/**
 * Feed data hooks — posts, comments, hashtags.
 *
 * Two rules that shape everything here:
 *
 * 1. **Gate on `isAuthenticated`**, like every other query in the app. A cold
 *    boot with no hydrated token would otherwise fire, cache a 401, and only
 *    recover on a manual refresh.
 * 2. **Hearts never wait for the network.** Likes are applied optimistically
 *    across every cached feed page, then reconciled with the server's own
 *    count. A heart that fills in half a second after the tap reads as a
 *    broken button, and in a feed the same post can be on screen in two
 *    tabs at once — so the patch is applied by post id everywhere, not to
 *    the one list that happened to be tapped.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  CommentThreadWire,
  CommentWire,
  FeedTab,
  FeedWire,
  HashtagWire,
  PostWire,
  SocialLikeStateWire,
  SocialSearchWire,
} from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

/** Flatten an infinite feed's pages into the list a FlatList renders. */
export function feedPosts(data: InfiniteData<FeedWire> | undefined): PostWire[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

const PAGE_SIZE = 12;

/** Every cursor-paged post list is the same query — only the URL, the cache
 *  key and the extra params differ. */
function infiniteFeed(
  url: string,
  key: readonly unknown[],
  enabled: boolean,
  extraQuery: Record<string, string> = {},
) {
  return {
    queryKey: key,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiFetch<FeedWire>(url, {
        query: {
          ...extraQuery,
          limit: PAGE_SIZE,
          // The cursor is opaque — read off the previous page and handed
          // straight back, never constructed here.
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: FeedWire) => last.next_cursor,
    enabled,
    // Short but non-zero: switching tabs shouldn't refetch what was on
    // screen a second ago, and a feed that never goes stale never shows
    // the post you just made.
    staleTime: 30_000,
  };
}

/** One of the three feed tabs. */
export function useFeed(
  tab: FeedTab,
  enabled = true,
): UseInfiniteQueryResult<InfiniteData<FeedWire>> {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery(
    infiniteFeed(
      ENDPOINTS.social.feed,
      queryKeys.social.feed(tab),
      isAuthenticated && enabled,
      { tab },
    ),
  );
}

/** A collector's own posts — the grid on their profile. */
export function useUserPosts(
  handle: string | null | undefined,
): UseInfiniteQueryResult<InfiniteData<FeedWire>> {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery(
    infiniteFeed(
      ENDPOINTS.social.userPosts(handle ?? ""),
      queryKeys.social.userPosts(handle ?? ""),
      isAuthenticated && !!handle,
    ),
  );
}

/** Every post carrying a tag. */
export function useHashtagPosts(
  tag: string | null,
): UseInfiniteQueryResult<InfiniteData<FeedWire>> {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery(
    infiniteFeed(
      ENDPOINTS.social.hashtagPosts(tag ?? ""),
      queryKeys.social.hashtagPosts(tag ?? ""),
      isAuthenticated && !!tag,
    ),
  );
}

/** The chip row above For You. */
export function useTrendingHashtags(
  enabled = true,
): UseQueryResult<HashtagWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<HashtagWire[]>({
    queryKey: queryKeys.social.trendingHashtags(),
    queryFn: () =>
      apiFetch<HashtagWire[]>(ENDPOINTS.social.trendingHashtags, {
        query: { limit: 12 },
      }),
    enabled: isAuthenticated && enabled,
    staleTime: 5 * 60_000,
  });
}

/** The feed's search bar: people and tags in one round trip. */
export function useSocialSearch(query: string): UseQueryResult<SocialSearchWire> {
  const { isAuthenticated } = useAuth();
  const q = query.trim();
  return useQuery<SocialSearchWire>({
    queryKey: queryKeys.social.searchAll(q),
    queryFn: () =>
      apiFetch<SocialSearchWire>(ENDPOINTS.social.searchAll, {
        query: { q, limit: 15 },
      }),
    // Two characters, matching the server's floor — a one-letter query
    // matches most of the directory and costs a round trip to say nothing.
    enabled: isAuthenticated && q.length >= 2,
    staleTime: 30_000,
  });
}

/** One post, for the permalink screen a notification opens. */
export function usePost(id: string | null): UseQueryResult<PostWire> {
  const { isAuthenticated } = useAuth();
  return useQuery<PostWire>({
    queryKey: queryKeys.social.post(id ?? ""),
    queryFn: () => apiFetch<PostWire>(ENDPOINTS.social.post(id as string)),
    enabled: isAuthenticated && !!id,
    staleTime: 30_000,
  });
}

/** A post's comment thread. Paged by offset — a thread grows at the bottom,
 *  so rows above the reader's position don't shift. */
export function useComments(
  postId: string | null,
): UseInfiniteQueryResult<InfiniteData<CommentThreadWire>> {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: queryKeys.social.comments(postId ?? ""),
    queryFn: ({ pageParam }) =>
      apiFetch<CommentThreadWire>(
        ENDPOINTS.social.postComments(postId as string),
        { query: { offset: pageParam, limit: 20 } },
      ),
    initialPageParam: 0,
    getNextPageParam: (last: CommentThreadWire) =>
      last.next_cursor ? Number(last.next_cursor) : undefined,
    enabled: isAuthenticated && !!postId,
    staleTime: 15_000,
  });
}

/** The rest of a comment's replies, behind "View N replies". */
export function useReplies(
  commentId: string | null,
): UseQueryResult<CommentThreadWire> {
  const { isAuthenticated } = useAuth();
  return useQuery<CommentThreadWire>({
    queryKey: queryKeys.social.replies(commentId ?? ""),
    queryFn: () =>
      apiFetch<CommentThreadWire>(
        ENDPOINTS.social.commentReplies(commentId as string),
        { query: { limit: 50 } },
      ),
    enabled: isAuthenticated && !!commentId,
    staleTime: 15_000,
  });
}

// ── Mutations ──

/**
 * Publish a post. React Native's fetch turns a `{ uri, name, type }`
 * FormData part into a real multipart file upload — the same trick the
 * avatar upload uses.
 */
export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation<
    PostWire,
    Error,
    { body?: string; cardId?: string; images?: { uri: string; mimeType?: string }[] }
  >({
    mutationFn: ({ body, cardId, images }) => {
      const form = new FormData();
      if (body) form.append("body", body);
      if (cardId) form.append("card_id", cardId);
      (images ?? []).forEach((image, index) => {
        const type = image.mimeType ?? "image/jpeg";
        form.append("images", {
          uri: image.uri,
          name: `post-${index}.${type.includes("png") ? "png" : "jpg"}`,
          type,
        } as unknown as Blob);
      });
      return apiFetch<PostWire>(ENDPOINTS.social.posts, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      // A new post changes Following (it includes your own), Mine, your
      // profile grid, and the trending chips if it carried tags.
      void qc.invalidateQueries({ queryKey: ["social", "feed"] });
      void qc.invalidateQueries({ queryKey: ["social", "user-posts"] });
      void qc.invalidateQueries({ queryKey: queryKeys.social.trendingHashtags() });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation<void, Error, { postId: string }>({
    mutationFn: ({ postId }) =>
      apiFetch<void>(ENDPOINTS.social.post(postId), { method: "DELETE" }),
    onSuccess: (_data, { postId }) => {
      // Drop it from every cached page immediately. Invalidating instead
      // would leave the deleted post on screen until the refetch lands.
      patchFeeds(qc, postId, () => null);
      void qc.invalidateQueries({ queryKey: ["social", "user-posts"] });
    },
  });
}

/**
 * Like/unlike, optimistic. The same post can be on screen in two tabs, so
 * the patch is applied to every cached feed by post id, and rolled back on
 * every one of them if the request fails.
 */
export function useLikePost() {
  const qc = useQueryClient();
  return useMutation<
    SocialLikeStateWire,
    Error,
    { postId: string; liked: boolean }
  >({
    mutationFn: ({ postId, liked }) =>
      apiFetch<SocialLikeStateWire>(ENDPOINTS.social.postLike(postId), {
        method: liked ? "DELETE" : "POST",
      }),
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: ["social", "feed"] });
      patchFeeds(qc, postId, (post) => ({
        ...post,
        viewer_has_liked: !liked,
        // Clamped: a stale page could otherwise render "-1 likes".
        like_count: Math.max(0, post.like_count + (liked ? -1 : 1)),
      }));
    },
    onSuccess: (data, { postId }) => {
      // Replace the guess with the server's own count, so the heart and the
      // number beside it can never disagree.
      patchFeeds(qc, postId, (post) => ({
        ...post,
        viewer_has_liked: data.liked,
        like_count: data.like_count,
      }));
    },
    onError: (_error, { postId, liked }) => {
      patchFeeds(qc, postId, (post) => ({
        ...post,
        viewer_has_liked: liked,
        like_count: Math.max(0, post.like_count + (liked ? 1 : -1)),
      }));
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation<
    CommentWire,
    Error,
    { postId: string; body: string; parentId?: string | null }
  >({
    mutationFn: ({ postId, body, parentId }) =>
      apiFetch<CommentWire>(ENDPOINTS.social.postComments(postId), {
        method: "POST",
        json: { body, parent_id: parentId ?? null },
      }),
    onSuccess: (_comment, { postId, parentId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.social.comments(postId) });
      if (parentId) {
        void qc.invalidateQueries({ queryKey: queryKeys.social.replies(parentId) });
      }
      // The bubble count under the post moved.
      patchFeeds(qc, postId, (post) => ({
        ...post,
        comment_count: post.comment_count + 1,
      }));
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation<void, Error, { commentId: string; postId: string }>({
    mutationFn: ({ commentId }) =>
      apiFetch<void>(ENDPOINTS.social.comment(commentId), { method: "DELETE" }),
    onSuccess: (_data, { postId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.social.comments(postId) });
      patchFeeds(qc, postId, (post) => ({
        ...post,
        comment_count: Math.max(0, post.comment_count - 1),
      }));
    },
  });
}

/** The heart beside a comment. Optimistic within the thread's cache. */
export function useLikeComment(postId: string) {
  const qc = useQueryClient();
  return useMutation<
    SocialLikeStateWire,
    Error,
    { commentId: string; liked: boolean }
  >({
    mutationFn: ({ commentId, liked }) =>
      apiFetch<SocialLikeStateWire>(ENDPOINTS.social.commentLike(commentId), {
        method: liked ? "DELETE" : "POST",
      }),
    onMutate: ({ commentId, liked }) => {
      patchComments(qc, postId, commentId, (comment) => ({
        ...comment,
        viewer_has_liked: !liked,
        like_count: Math.max(0, comment.like_count + (liked ? -1 : 1)),
      }));
    },
    onSuccess: (data, { commentId }) => {
      patchComments(qc, postId, commentId, (comment) => ({
        ...comment,
        viewer_has_liked: data.liked,
        like_count: data.like_count,
      }));
    },
    onError: (_error, { commentId, liked }) => {
      patchComments(qc, postId, commentId, (comment) => ({
        ...comment,
        viewer_has_liked: liked,
        like_count: Math.max(0, comment.like_count + (liked ? 1 : -1)),
      }));
    },
  });
}

/** The closed list of report reasons, straight from the server. */
export function useReportReasons(
  enabled = true,
): UseQueryResult<Record<string, string>> {
  const { isAuthenticated } = useAuth();
  return useQuery<Record<string, string>>({
    queryKey: queryKeys.social.reportReasons(),
    queryFn: () =>
      apiFetch<Record<string, string>>(ENDPOINTS.social.reportReasons),
    enabled: isAuthenticated && enabled,
    staleTime: 60 * 60_000,
  });
}

/** Report a post, comment or profile. Idempotent per person per thing, so a
 *  second tap is not an error and not a second vote. */
export function useReportContent() {
  return useMutation<
    unknown,
    Error,
    {
      targetType: "post" | "comment" | "profile";
      targetId: string;
      reason: string;
      note?: string;
    }
  >({
    mutationFn: ({ targetType, targetId, reason, note }) =>
      apiFetch<unknown>(ENDPOINTS.social.reports, {
        method: "POST",
        json: {
          target_type: targetType,
          target_id: targetId,
          reason,
          note: note ?? null,
        },
      }),
  });
}

// ── Cache surgery ──

type QueryClient = ReturnType<typeof useQueryClient>;

/**
 * Apply `edit` to one post across EVERY cached feed — the three tabs,
 * profile grids and hashtag pages alike. Returning null removes it.
 *
 * Feeds overlap by design (For You can show a post you also see in
 * Following), so patching only the list that was tapped leaves the same
 * post showing two different like counts one swipe apart.
 */
function patchFeeds(
  qc: QueryClient,
  postId: string,
  edit: (post: PostWire) => PostWire | null,
): void {
  const apply = (data: InfiniteData<FeedWire> | undefined) => {
    if (!data) return data;
    let touched = false;
    const pages = data.pages.map((page) => {
      if (!page.items.some((item) => item.id === postId)) return page;
      touched = true;
      const items: PostWire[] = [];
      for (const item of page.items) {
        if (item.id !== postId) {
          items.push(item);
          continue;
        }
        const next = edit(item);
        if (next) items.push(next);
      }
      return { ...page, items };
    });
    // Returning the original object when nothing matched keeps React-Query
    // from re-rendering every feed on every tap.
    return touched ? { ...data, pages } : data;
  };

  for (const key of [
    ["social", "feed"],
    ["social", "user-posts"],
    ["social", "hashtag-posts"],
  ]) {
    qc.setQueriesData<InfiniteData<FeedWire>>({ queryKey: key }, apply);
  }
  qc.setQueryData<PostWire>(queryKeys.social.post(postId), (post) =>
    post ? (edit(post) ?? post) : post,
  );
}

/** Apply `edit` to one comment wherever it sits — top level or inlined
 *  under its parent. */
function patchComments(
  qc: QueryClient,
  postId: string,
  commentId: string,
  edit: (comment: CommentWire) => CommentWire,
): void {
  qc.setQueryData<InfiniteData<CommentThreadWire>>(
    queryKeys.social.comments(postId),
    (data) => {
      if (!data) return data;
      const walk = (comment: CommentWire): CommentWire => {
        const next = comment.id === commentId ? edit(comment) : comment;
        return next.replies.length
          ? { ...next, replies: next.replies.map(walk) }
          : next;
      };
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map(walk),
        })),
      };
    },
  );
  qc.setQueryData<CommentThreadWire>(
    queryKeys.social.replies(commentId),
    (thread) =>
      thread
        ? {
            ...thread,
            items: thread.items.map((c) => (c.id === commentId ? edit(c) : c)),
          }
        : thread,
  );
}
