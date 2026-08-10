/**
 * Stories — the tray, one author's cards, comments, viewers, and posting.
 *
 * Everything about *what* a story is comes from the server: whether it has
 * expired, whose ring is lit, what order the tray sits in. These hooks ask
 * and render. The one piece of state the client owns is optimistic
 * "seen" — marking a story read has to feel instant, because the ring is
 * right under the thumb that just tapped it.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  StoryCommentWire,
  StoryTrayWire,
  StoryViewerWire,
  StoryWire,
} from "@/infrastructure/http/wire/social";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

/**
 * The row of avatars above the feed.
 *
 * Short `staleTime`: a story going up is the most time-sensitive thing in
 * the app, and a tray that's five minutes stale shows a grey ring over
 * something posted four minutes ago.
 */
export function useStoryTray(enabled = true): UseQueryResult<StoryTrayWire> {
  const { isAuthenticated } = useAuth();
  return useQuery<StoryTrayWire>({
    queryKey: queryKeys.social.storyTray(),
    queryFn: () => apiFetch<StoryTrayWire>(ENDPOINTS.social.storyTray),
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
    refetchOnMount: true,
  });
}

/** One collector's live stories, oldest first — the tap-through order. */
export function useStories(
  handle: string | null,
): UseQueryResult<StoryWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<StoryWire[]>({
    queryKey: queryKeys.social.stories(handle ?? ""),
    queryFn: () => apiFetch<StoryWire[]>(ENDPOINTS.social.storiesFor(handle!)),
    enabled: isAuthenticated && Boolean(handle),
    // Never served from cache on open: a story may have expired since the
    // tray was built, and opening a card that isn't there any more is the
    // one failure a story viewer must not have.
    staleTime: 0,
  });
}

/** Your own stories including expired ones — the archive in Settings. */
export function useStoryArchive(enabled = true): UseQueryResult<StoryWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<StoryWire[]>({
    queryKey: queryKeys.social.storyArchive(),
    queryFn: () => apiFetch<StoryWire[]>(ENDPOINTS.social.storyArchive),
    enabled: isAuthenticated && enabled,
    staleTime: 60_000,
  });
}

export function useStoryComments(
  storyId: string | null,
): UseQueryResult<StoryCommentWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<StoryCommentWire[]>({
    queryKey: queryKeys.social.storyComments(storyId ?? ""),
    queryFn: () =>
      apiFetch<StoryCommentWire[]>(ENDPOINTS.social.storyComments(storyId!)),
    enabled: isAuthenticated && Boolean(storyId),
    staleTime: 15_000,
  });
}

/** Who watched. Author only — the server 403s anyone else. */
export function useStoryViewers(
  storyId: string | null,
  enabled = true,
): UseQueryResult<StoryViewerWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<StoryViewerWire[]>({
    queryKey: queryKeys.social.storyViewers(storyId ?? ""),
    queryFn: () =>
      apiFetch<StoryViewerWire[]>(ENDPOINTS.social.storyViewers(storyId!)),
    enabled: isAuthenticated && Boolean(storyId) && enabled,
    staleTime: 20_000,
  });
}

export interface NewStory {
  uri: string;
  /** From the camera. Decides the mime type and whether duration applies. */
  kind: "image" | "video";
  caption?: string;
  durationMs?: number;
}

/** Post a story. Multipart, because the file and the caption go together. */
export function usePostStory() {
  const qc = useQueryClient();
  return useMutation<StoryWire, Error, NewStory>({
    mutationFn: ({ uri, kind, caption, durationMs }) => {
      const form = new FormData();
      const isVideo = kind === "video";
      form.append("media", {
        uri,
        // The extension has to match the type or the server's content-type
        // check and the file's actual bytes disagree.
        name: isVideo ? "story.mp4" : "story.jpg",
        type: isVideo ? "video/mp4" : "image/jpeg",
      } as unknown as Blob);
      if (caption?.trim()) form.append("caption", caption.trim());
      if (isVideo && durationMs) {
        form.append("duration_ms", String(Math.round(durationMs)));
      }
      return apiFetch<StoryWire>(ENDPOINTS.social.stories, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.social.storyTray() });
      void qc.invalidateQueries({ queryKey: queryKeys.social.storyArchive() });
      void qc.invalidateQueries({ queryKey: ["social", "stories"] });
    },
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation<void, Error, { storyId: string }>({
    mutationFn: ({ storyId }) =>
      apiFetch<void>(ENDPOINTS.social.story(storyId), { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["social", "story-tray"] });
      void qc.invalidateQueries({ queryKey: ["social", "story-archive"] });
      void qc.invalidateQueries({ queryKey: ["social", "stories"] });
    },
  });
}

/**
 * Mark a story seen.
 *
 * Optimistic, and deliberately fire-and-forget on failure. The ring is
 * directly under the thumb that just opened the card, so it has to dim
 * immediately; and if the request is lost the only cost is that the ring
 * comes back on the next refetch, which is a far better failure than a
 * spinner on a full-screen viewer.
 */
export function useMarkStorySeen() {
  const qc = useQueryClient();
  return useMutation<void, Error, { storyId: string; handle: string }>({
    mutationFn: ({ storyId }) =>
      apiFetch<void>(ENDPOINTS.social.storyView(storyId), { method: "POST" }),
    onMutate: async ({ storyId, handle }) => {
      qc.setQueryData<StoryWire[]>(queryKeys.social.stories(handle), (rows) =>
        rows?.map((s) => (s.id === storyId ? { ...s, seen: true } : s)),
      );
      qc.setQueryData<StoryTrayWire>(queryKeys.social.storyTray(), (tray) => {
        if (!tray) return tray;
        // The ring is per AUTHOR, so it only goes out once every one of
        // their cards is seen. The tray doesn't carry the per-story seen
        // flags, so read them back from the author's own cached list.
        const cards = qc.getQueryData<StoryWire[]>(
          queryKeys.social.stories(handle),
        );
        const allSeen = (cards ?? []).every((s) => s.seen);
        return {
          ...tray,
          entries: (tray.entries ?? []).map((e) =>
            e.author.username === handle && allSeen
              ? { ...e, has_unseen: false }
              : e,
          ),
        };
      });
    },
  });
}

export function useCommentOnStory() {
  const qc = useQueryClient();
  return useMutation<StoryCommentWire, Error, { storyId: string; body: string }>(
    {
      mutationFn: ({ storyId, body }) =>
        apiFetch<StoryCommentWire>(ENDPOINTS.social.storyComments(storyId), {
          method: "POST",
          json: { body },
        }),
      onSuccess: (_data, { storyId }) => {
        void qc.invalidateQueries({
          queryKey: queryKeys.social.storyComments(storyId),
        });
        void qc.invalidateQueries({ queryKey: ["social", "stories"] });
      },
    },
  );
}

export function useDeleteStoryComment() {
  const qc = useQueryClient();
  return useMutation<void, Error, { commentId: string; storyId: string }>({
    mutationFn: ({ commentId }) =>
      apiFetch<void>(ENDPOINTS.social.storyComment(commentId), {
        method: "DELETE",
      }),
    onSuccess: (_data, { storyId }) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.social.storyComments(storyId),
      });
    },
  });
}
