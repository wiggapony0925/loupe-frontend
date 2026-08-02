/**
 * useHeroCards — the pre-auth hero's card feed, with last-good persistence.
 *
 * The welcome screen is the first thing a launch renders, so an empty hero is
 * the first thing a new user sees. The live trending feed is quick (~250ms) but
 * it is still a network round trip, and on a cold or flaky connection that gap
 * is the whole first impression.
 *
 * So: the last successful trio is written to AsyncStorage and replayed on the
 * next launch. The screen paints real cards immediately and swaps in fresh ones
 * when they land, which turns "wait, then cards" into "cards, quietly updated".
 *
 * Only the three cards the hero can actually show are persisted — the full feed
 * is ~45KB of JSON and none of the tail is ever rendered here.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CardSearchResult } from "@/infrastructure/http";
import { useMixedTrending } from "./useMixedTrending";

const CACHE_KEY = "loupe.hero.cards.v1";
const KEEP = 3;

/** Persisted shape is just `CardSearchResult[]`; version lives in the key. */
async function readCache(): Promise<CardSearchResult[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as CardSearchResult[];
  } catch {
    // A corrupt or unreadable cache is not worth surfacing — the live query
    // is already on its way and will fill the hero regardless.
    return null;
  }
}

async function writeCache(cards: readonly CardSearchResult[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cards.slice(0, KEEP)));
  } catch {
    /* Cache writes are best-effort. */
  }
}

export function useHeroCards() {
  const live = useMixedTrending("value", { perTcg: 6 });
  const [cached, setCached] = useState<CardSearchResult[] | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const written = useRef(false);

  useEffect(() => {
    let alive = true;
    void readCache().then((cards) => {
      if (!alive) return;
      setCached(cards);
      setCacheChecked(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist the first good result of the session, not every render.
  useEffect(() => {
    if (written.current || live.cards.length === 0) return;
    written.current = true;
    void writeCache(live.cards);
  }, [live.cards]);

  const hasLive = live.cards.length > 0;
  const cards = hasLive ? live.cards : (cached ?? []);

  const refetch = useCallback(() => {
    written.current = false;
    live.refetch();
  }, [live]);

  return {
    cards,
    /**
     * Only true while there is genuinely nothing to draw. Once the cache has
     * been read and the network has answered, this goes false even if both
     * came back empty — that's `isEmpty`'s job, not a spinner's.
     */
    isLoading: cards.length === 0 && (!cacheChecked || live.isLoading),
    /** Settled with nothing: show the resting state, not a skeleton. */
    isEmpty: cacheChecked && !live.isLoading && cards.length === 0,
    isError: live.isError,
    refetch,
  };
}
