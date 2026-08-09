/**
 * Optimistic likes across overlapping feeds.
 *
 * The property being defended: the SAME post can be cached in several lists
 * at once — For You and Following overlap by design, and a profile grid or
 * hashtag page can hold it too. Patching only the list that was tapped
 * leaves the same post showing two different like counts one swipe apart.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { FeedWire, PostWire } from "@/infrastructure/http";
import { queryKeys } from "../../queryKeys";
import { useLikePost } from "../useFeed";

// `mock`-prefixed so babel-plugin-jest-hoist allows the factory below to
// close over it — jest.mock is hoisted above every other declaration.
const mockApiFetch = jest.fn();

jest.mock("@/infrastructure/http/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getApiBaseUrl: () => "https://api.test",
}));
jest.mock("@/presentation/providers/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

function post(over: Partial<PostWire> = {}): PostWire {
  return {
    id: "p1",
    author: {
      user_id: "u1",
      username: "ash",
      display_name: null,
      avatar_url: null,
      is_pro: false,
      is_admin: false,
      relationship: "none",
    },
    body: "hi",
    media: [],
    card: null,
    created_at: "2026-08-08T00:00:00Z",
    like_count: 4,
    comment_count: 0,
    viewer_has_liked: false,
    hashtags: [],
    mentions: [],
    edited_at: null,
    can_delete: false,
    can_edit: false,
    ...over,
  };
}

function page(items: PostWire[]): { pages: FeedWire[]; pageParams: unknown[] } {
  return { pages: [{ items, next_cursor: null }], pageParams: [null] };
}

function setup() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  // The same post, cached in two different feeds.
  qc.setQueryData(queryKeys.social.feed("following"), page([post()]));
  qc.setQueryData(queryKeys.social.feed("foryou"), page([post()]));
  qc.setQueryData(queryKeys.social.hashtagPosts("pokemon"), page([post()]));

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

const countIn = (qc: QueryClient, key: readonly unknown[]) => {
  const data = qc.getQueryData(key) as { pages: FeedWire[] } | undefined;
  return data?.pages[0]?.items[0];
};

beforeEach(() => mockApiFetch.mockReset());

describe("useLikePost", () => {
  it("moves the count in EVERY feed holding the post, not just one", async () => {
    mockApiFetch.mockResolvedValue({ liked: true, like_count: 5 });
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useLikePost(), { wrapper });

    await act(async () => {
      result.current.mutate({ postId: "p1", liked: false });
    });

    await waitFor(() => {
      for (const key of [
        queryKeys.social.feed("following"),
        queryKeys.social.feed("foryou"),
        queryKeys.social.hashtagPosts("pokemon"),
      ]) {
        expect(countIn(qc, key)?.like_count).toBe(5);
        expect(countIn(qc, key)?.viewer_has_liked).toBe(true);
      }
    });
  });

  it("rolls the count back everywhere when the request fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("offline"));
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useLikePost(), { wrapper });

    await act(async () => {
      result.current.mutate({ postId: "p1", liked: false });
    });

    await waitFor(() => {
      expect(countIn(qc, queryKeys.social.feed("foryou"))?.like_count).toBe(4);
      expect(
        countIn(qc, queryKeys.social.feed("foryou"))?.viewer_has_liked,
      ).toBe(false);
    });
  });

  it("never renders a negative count when a stale page unlikes twice", async () => {
    mockApiFetch.mockResolvedValue({ liked: false, like_count: 0 });
    const qc = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    qc.setQueryData(
      queryKeys.social.feed("mine"),
      page([post({ like_count: 0, viewer_has_liked: true })]),
    );
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLikePost(), { wrapper });

    await act(async () => {
      result.current.mutate({ postId: "p1", liked: true });
    });

    await waitFor(() => {
      expect(countIn(qc, queryKeys.social.feed("mine"))?.like_count).toBe(0);
    });
  });
});
