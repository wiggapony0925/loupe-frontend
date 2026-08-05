/**
 * Community data hooks — the native replacement for the web embed.
 *
 * Every query is gated on `isAuthenticated`, matching the rest of the app:
 * a cold boot with no hydrated token used to fire these, cache a 401, and
 * only recover on a manual refresh.
 *
 * Mutations invalidate rather than hand-patch the cache, with one deliberate
 * exception — the like button, which writes the server's own returned count
 * straight back. A heart that waits for a refetch to fill in feels broken at
 * the moment it's tapped.
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
  SocialCollectionWire,
  SocialFollowRequestWire,
  SocialFollowStateWire,
  SocialLikeStateWire,
  SocialMeWire,
  SocialProfileUpsertWire,
  SocialProfileViewWire,
  SocialProfileWire,
  SocialUserCardWire,
} from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

/** My social identity. `profile === null` means no username claimed yet. */
export function useSocialMe(): UseQueryResult<SocialMeWire> {
  const { isAuthenticated } = useAuth();
  return useQuery<SocialMeWire>({
    queryKey: queryKeys.social.me(),
    queryFn: () => apiFetch<SocialMeWire>(ENDPOINTS.social.me),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

/** Collectors worth following. The first thing a new user sees. */
export function useSuggestedCollectors(
  enabled = true,
): UseQueryResult<SocialUserCardWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<SocialUserCardWire[]>({
    queryKey: queryKeys.social.suggested(),
    queryFn: () => apiFetch<SocialUserCardWire[]>(ENDPOINTS.social.suggested),
    enabled: isAuthenticated && enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Handle/name search. Only fires past two characters — a one-letter query
 * matches most of the directory and costs a round trip to say nothing.
 */
export function useCollectorSearch(
  query: string,
): UseQueryResult<SocialUserCardWire[]> {
  const { isAuthenticated } = useAuth();
  const q = query.trim();
  return useQuery<SocialUserCardWire[]>({
    queryKey: queryKeys.social.search(q),
    queryFn: () =>
      apiFetch<SocialUserCardWire[]>(ENDPOINTS.social.search, {
        query: { q, limit: 25 },
      }),
    enabled: isAuthenticated && q.length >= 2,
    staleTime: 30_000,
  });
}

/** People asking to follow my private account. */
export function useFollowRequests(): UseQueryResult<SocialFollowRequestWire[]> {
  const { isAuthenticated } = useAuth();
  return useQuery<SocialFollowRequestWire[]>({
    queryKey: queryKeys.social.requests(),
    queryFn: () =>
      apiFetch<SocialFollowRequestWire[]>(ENDPOINTS.social.requests),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useCollectorProfile(
  handle: string | null | undefined,
): UseQueryResult<SocialProfileViewWire> {
  const { isAuthenticated } = useAuth();
  return useQuery<SocialProfileViewWire>({
    queryKey: queryKeys.social.profile(handle ?? ""),
    queryFn: () =>
      apiFetch<SocialProfileViewWire>(ENDPOINTS.social.profile(handle as string)),
    enabled: isAuthenticated && !!handle,
    // Short: the view counter on your own profile should move when you
    // come back to it, not sit on a five-minute-old number.
    staleTime: 30_000,
  });
}

/**
 * Someone's vault. Only fetched when the server says it's viewable — asking
 * for a private collection returns 403, and a cached 403 would keep the
 * empty state on screen even after a follow request is accepted.
 */
export function useCollectorCollection(
  handle: string | null | undefined,
  canView: boolean,
): UseQueryResult<SocialCollectionWire> {
  const { isAuthenticated } = useAuth();
  return useQuery<SocialCollectionWire>({
    queryKey: queryKeys.social.collection(handle ?? ""),
    queryFn: () =>
      apiFetch<SocialCollectionWire>(
        ENDPOINTS.social.collection(handle as string),
      ),
    enabled: isAuthenticated && !!handle && canView,
    staleTime: 60_000,
  });
}

// ── Mutations ──

/** Claim or update my handle, bio, location, and privacy. */
export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation<SocialProfileWire, Error, SocialProfileUpsertWire>({
    mutationFn: (body) =>
      apiFetch<SocialProfileWire>(ENDPOINTS.social.me, {
        method: "PUT",
        json: body,
      }),
    onSuccess: () => {
      // Claiming a handle changes what every other surface shows about you
      // (suggestions exclude you, your own profile now resolves), so this
      // invalidates the whole namespace rather than guessing.
      void qc.invalidateQueries({ queryKey: queryKeys.social.all });
    },
  });
}

export function useFollowCollector() {
  const qc = useQueryClient();
  return useMutation<SocialFollowStateWire, Error, { handle: string; following: boolean }>({
    mutationFn: ({ handle, following }) =>
      apiFetch<SocialFollowStateWire>(ENDPOINTS.social.follow(handle), {
        method: following ? "DELETE" : "POST",
      }),
    onSuccess: (_data, { handle }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.social.profile(handle) });
      void qc.invalidateQueries({ queryKey: queryKeys.social.suggested() });
      // Follower counts moved on both sides of the edge.
      void qc.invalidateQueries({ queryKey: queryKeys.social.me() });
    },
  });
}

export function useLikeCollector() {
  const qc = useQueryClient();
  return useMutation<SocialLikeStateWire, Error, { handle: string; liked: boolean }>({
    mutationFn: ({ handle, liked }) =>
      apiFetch<SocialLikeStateWire>(ENDPOINTS.social.like(handle), {
        method: liked ? "DELETE" : "POST",
      }),
    onSuccess: (data, { handle }) => {
      // Write the server's own count back instead of refetching: the heart
      // and the number beside it must never disagree, even for one frame.
      qc.setQueryData<SocialProfileViewWire>(
        queryKeys.social.profile(handle),
        (prev) =>
          prev
            ? { ...prev, like_count: data.like_count, viewer_has_liked: data.liked }
            : prev,
      );
    },
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; accept: boolean }>({
    mutationFn: ({ id, accept }) =>
      apiFetch<void>(
        accept
          ? ENDPOINTS.social.acceptRequest(id)
          : ENDPOINTS.social.declineRequest(id),
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.social.requests() });
      void qc.invalidateQueries({ queryKey: queryKeys.social.me() });
    },
  });
}
