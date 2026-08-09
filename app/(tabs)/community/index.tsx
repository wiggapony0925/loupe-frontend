/**
 * Community — the feed.
 *
 * This page used to BE the directory of collectors. It isn't any more: a
 * social product's home is the stream, and the directory is where you go to
 * find someone specific. That page still exists, in full, at
 * `/community/people` — one tap away from the search bar and from the island
 * navbar's people slot.
 *
 * Layout, top to bottom:
 *
 *   search + bell + compose   pinned; the page's three verbs
 *   Following · For You
 *   #chips                    (For You only — discovery needs an entry point)
 *   posts                     the river
 *
 * Nothing here decides what a tab CONTAINS. `useFeed(tab)` asks the backend
 * and renders the answer, so web and native can never drift on what
 * "Following" means.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Plus, Search, Users, X } from "lucide-react-native";
import type { FeedTab } from "@/infrastructure/http";
import {
  useFeed,
  useSocialSearch,
  useTrendingHashtags,
} from "@/application/queries/social/useFeed";
import {
  useFollowCollector,
  useSocialMe,
} from "@/application/queries/social/useSocial";
import { useUnreadNotificationCount } from "@/application/notifications/useNotificationFeed";
import { ClaimUsernameCard } from "@/presentation/features/social/ClaimUsernameCard";
import { CollectorRow } from "@/presentation/features/social/CollectorRow";
import { FeedList } from "@/presentation/features/social/feed/FeedList";
import { FeedTabs } from "@/presentation/features/social/feed/FeedTabs";
import { HashtagChips } from "@/presentation/features/social/feed/HashtagChips";
import { StoryTray } from "@/presentation/features/social/stories/StoryTray";
import { StoryViewer } from "@/presentation/features/social/stories/StoryViewer";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { useScreenTransition } from "@/presentation/navigation/screenMotion";
import { useHomeOnReentry } from "@/presentation/navigation/useHomeOnReentry";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

const GUTTER = 20;

export default function CommunityFeedScreen() {
  const p = useThemedPalette();
  // Leaving the tab unwinds the community stack, so arriving here always
  // means arriving at the feed — never on a profile or permalink left over
  // from last time. See the hook for why it hangs off blur, not focus.
  useHomeOnReentry();
  const [tab, setTab] = useState<FeedTab>("following");
  // Whose reel is open, or null. A handle rather than a story id: the
  // viewer pages through everything that person has up.
  const [watching, setWatching] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useCommunityIslandPresence();

  const me = useSocialMe();
  const claimed = !!me.data?.profile;
  const searching = q.trim().length >= 2;

  const feed = useFeed(tab, claimed && !searching);
  const trending = useTrendingHashtags(claimed && tab === "foryou");
  const search = useSocialSearch(q);
  const follow = useFollowCollector();
  // Same motion as moving between pages — one definition, see screenMotion.
  const swap = useScreenTransition(searching ? "search" : tab);

  // Nothing below the search bar works without a handle — posting, following
  // and the feed all key off it — so the claim card replaces the page.
  if (me.isLoading || !claimed) {
    return (
      <View style={[styles.root, { backgroundColor: p.bg.base }]}>
        <SafeAreaView edges={["top"]} style={styles.safe}>
          <View style={styles.claim}>
            <Text style={[styles.title, { color: p.ink.default }]}>Community</Text>
            {me.isLoading ? (
              <ActivityIndicator color={p.ink.dim} style={styles.loading} />
            ) : (
              <ClaimUsernameCard />
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <FeedHeader q={q} onChangeQ={setQ} />

        {searching ? (
          <Animated.View style={[styles.safe, swap]}>
          <SearchResults
            query={q}
            results={search}
            onFollow={follow.mutate}
            followPending={follow.isPending}
          />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.safe, swap]}>
          <FeedList
            query={feed}
            header={
              <View>
                {/* The tray sits ABOVE the tabs, not inside one of them:
                    stories are the same set of people whichever feed you
                    are reading, and a row that vanished on switching tabs
                    would read as stories disappearing. */}
                <StoryTray
                  onOpen={setWatching}
                  onCompose={() => router.push(routes.communityStory())}
                />
                <FeedTabs value={tab} onChange={setTab} />
                {tab === "foryou" ? (
                  <View style={{ paddingHorizontal: GUTTER }}>
                    <HashtagChips tags={trending.data ?? []} gutter={GUTTER} />
                  </View>
                ) : null}
              </View>
            }
            emptyTitle={
              tab === "following"
                ? "Your feed is quiet"
                : "Nothing to discover yet"
            }
            emptyBody={
              tab === "following"
                ? "Follow some collectors and their posts land here."
                : "Be the first to post something."
            }
            emptyAction={
              <Pressable
                onPress={() =>
                  router.push(
                    tab === "following"
                      ? routes.communityPeople()
                      : routes.communityCompose(),
                  )
                }
                style={[styles.cta, { backgroundColor: p.accent.mint }]}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>
                  {tab === "following" ? "Find collectors" : "Create a post"}
                </Text>
              </Pressable>
            }
          />
          </Animated.View>
        )}
      </SafeAreaView>

      <StoryViewer handle={watching} onClose={() => setWatching(null)} />
    </View>
  );
}

/** Search field, notifications, compose — the page's three verbs, pinned. */
function FeedHeader({
  q,
  onChangeQ,
}: {
  q: string;
  onChangeQ: (next: string) => void;
}) {
  const p = useThemedPalette();
  const unread = useUnreadNotificationCount();

  return (
    <View style={styles.header}>
      <View
        style={[
          styles.search,
          { borderColor: p.line.default, backgroundColor: p.bg.elevated },
        ]}
      >
        <Search size={16} color={p.ink.dim} />
        <TextInput
          value={q}
          onChangeText={onChangeQ}
          placeholder="Search users and hashtags"
          placeholderTextColor={p.ink.dim}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: p.ink.default }]}
          accessibilityLabel="Search collectors and hashtags"
        />
        {q.length > 0 ? (
          <Pressable
            onPress={() => onChangeQ("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={15} color={p.ink.dim} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.push(routes.notifications())}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        style={styles.iconButton}
      >
        <Bell size={21} color={p.ink.default} strokeWidth={2} />
        {unread > 0 ? (
          // A dot, not a number: the count is on the inbox itself, and a
          // two-digit badge on a 21pt icon is unreadable anyway.
          <View style={[styles.dot, { backgroundColor: p.accent.rose }]} />
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => router.push(routes.communityCompose())}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Create a post"
        style={({ pressed }) => [
          styles.compose,
          { backgroundColor: p.accent.mint, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Plus size={19} color="#06140d" strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

/** People and tags, in that order — a name is a more specific ask than a tag. */
function SearchResults({
  query,
  results,
  onFollow,
  followPending,
}: {
  query: string;
  results: ReturnType<typeof useSocialSearch>;
  onFollow: (next: { handle: string; following: boolean }) => void;
  followPending: boolean;
}) {
  const p = useThemedPalette();
  const data = results.data;
  const empty =
    !results.isLoading &&
    (data?.users.length ?? 0) === 0 &&
    (data?.hashtags.length ?? 0) === 0;

  return (
    <View style={styles.results}>
      {results.isLoading ? (
        <ActivityIndicator color={p.ink.dim} style={styles.loading} />
      ) : empty ? (
        <View style={styles.emptySearch}>
          <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
            Nothing matches “{query.trim()}”
          </Text>
          <Pressable
            onPress={() => router.push(routes.communityPeople())}
            style={styles.browseAll}
            accessibilityRole="button"
          >
            <Users size={15} color={p.accent.mint} strokeWidth={2.2} />
            <Text style={[styles.browseAllText, { color: p.accent.mint }]}>
              Browse all collectors
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {(data?.users.length ?? 0) > 0 ? (
            <>
              <Text style={[styles.resultsLabel, { color: p.ink.dim }]}>
                COLLECTORS
              </Text>
              {data!.users.map((user) => (
                <CollectorRow
                  key={user.user_id}
                  user={user}
                  onPress={() => router.push(routes.collector(user.username))}
                  onToggleFollow={onFollow}
                  pending={followPending}
                />
              ))}
            </>
          ) : null}

          {(data?.hashtags.length ?? 0) > 0 ? (
            <>
              <Text
                style={[
                  styles.resultsLabel,
                  { color: p.ink.dim, marginTop: 18 },
                ]}
              >
                HASHTAGS
              </Text>
              {data!.hashtags.map((tag) => (
                <Pressable
                  key={tag.tag}
                  onPress={() => router.push(routes.communityTag(tag.tag))}
                  accessibilityRole="button"
                  accessibilityLabel={`#${tag.tag}, ${tag.post_count} posts`}
                  style={styles.tagRow}
                >
                  <View
                    style={[
                      styles.tagGlyph,
                      { backgroundColor: withAlpha(p.accent.mint, 0.14) },
                    ]}
                  >
                    <Text style={[styles.tagHash, { color: p.accent.mint }]}>
                      #
                    </Text>
                  </View>
                  <View style={styles.tagText}>
                    <Text style={[styles.tagName, { color: p.ink.default }]}>
                      #{tag.tag}
                    </Text>
                    <Text style={[styles.tagMeta, { color: p.ink.dim }]}>
                      {tag.post_count.toLocaleString()}{" "}
                      {tag.post_count === 1 ? "post" : "posts"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  claim: { padding: GUTTER, gap: 16 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.9 },
  loading: { paddingVertical: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingBottom: 12,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 14.5, paddingVertical: 10 },
  iconButton: { width: 28, alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: -1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  results: { flex: 1, paddingHorizontal: GUTTER },
  resultsLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  emptySearch: { paddingVertical: 40, alignItems: "center", gap: 14 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  browseAll: { flexDirection: "row", alignItems: "center", gap: 7 },
  browseAllText: { fontSize: 14, fontWeight: "700" },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  tagGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tagHash: { fontSize: 19, fontWeight: "900" },
  tagText: { flex: 1, gap: 2 },
  tagName: { fontSize: 14.5, fontWeight: "700" },
  tagMeta: { fontSize: 12 },
  cta: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: { fontSize: 14, fontWeight: "800", color: "#06140d" },
});
