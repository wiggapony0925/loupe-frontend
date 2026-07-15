/**
 * useAiSearch — the Loupe Pro "describe it" search (`/v1/cards/search/ai`).
 *
 * Deliberately on-demand (`enabled: asked`): the model call costs real money,
 * so nothing fires until the user explicitly taps "Ask Loupe AI". Answers are
 * cached client-side per question (and server-side for a week), so re-asking
 * the same thing is instant. A 402 surfaces via `error` — the caller opens
 * the paywall with the `ai_search` story.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { AiSearchResponse } from "@/infrastructure/http";
import { useAppConfig } from "@/application/queries/ops/useAppConfig";
import { queryKeys } from "../queryKeys";

/** Offline fallback for the description limit — the LIVE value rides
 *  `/v1/app/config` (`useAiSearchLimits`), so a backend change reaches
 *  installed clients on the next config refresh, no release. */
export const AI_QUERY_MAX_CHARS = 200;

/** The backend-served AI search limits + availability.

 *  `enabled` is STRICT opt-in: the feature only shows when the backend
 *  explicitly says so — an old backend (no endpoint), a spent API key, or a
 *  provider outage all read as "hide the sparkle button / slash command
 *  entirely" instead of surfacing broken states. */
export function useAiSearchLimits(): {
  queryMaxChars: number;
  enabled: boolean;
} {
  const { data } = useAppConfig();
  return {
    queryMaxChars: data?.aiSearch?.queryMaxChars ?? AI_QUERY_MAX_CHARS,
    enabled: data?.aiSearch?.enabled === true,
  };
}

export function useAiSearch(q: string, asked: boolean, game?: string) {
  const { queryMaxChars } = useAiSearchLimits();
  const trimmed = q.trim().slice(0, queryMaxChars);
  // The active game tag rides along — "the user is mostly describing a
  // Pokémon card" — so the model biases toward what they're browsing.
  const tcg = game && game !== "all" ? game : undefined;
  return useQuery<AiSearchResponse>({
    queryKey: [...queryKeys.cards.aiSearch(trimmed), tcg ?? "all"],
    queryFn: () =>
      apiFetch<AiSearchResponse>(ENDPOINTS.publicCatalog.searchAi, {
        query: { q: trimmed, tcg },
      }),
    enabled: asked && trimmed.length >= 3,
    staleTime: 30 * 60_000,
    retry: false, // a 402 must open the paywall, not retry
  });
}
