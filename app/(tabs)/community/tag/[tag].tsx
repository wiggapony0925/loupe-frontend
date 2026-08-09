/**
 * A hashtag's page — where a chip, a tapped caption word and a search
 * result all land.
 *
 * Shaped like every tag page people already know: a header stating what
 * the tag is and how big it is, a Top ⇄ Recent switch, then a three-column
 * grid. The grid is the important part — a tag page is for scanning, not
 * reading, and a feed of full cards shows four posts per screen where the
 * grid shows fifteen.
 *
 * Top is the default. Arriving on #pokemon and seeing whatever was posted
 * ninety seconds ago tells you nothing about the tag; the best of it does.
 * The ordering is the SERVER's (see hashtags.tag_feed) so this page and the
 * web one can't disagree about what "top" means.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Hash } from "lucide-react-native";
import { feedPosts, useHashtagPosts } from "@/application/queries/social/useFeed";
import { PostGrid } from "@/presentation/features/social/feed/PostGrid";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { useScreenTransition } from "@/presentation/navigation/screenMotion";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

type Sort = "top" | "recent";

const SORTS: { key: Sort; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "recent", label: "Recent" },
];

export default function HashtagScreen() {
  const p = useThemedPalette();
  const params = useLocalSearchParams<{ tag?: string }>();
  const tag = (params.tag ?? "").replace(/^#/, "").toLowerCase();
  const [sort, setSort] = useState<Sort>("top");

  useCommunityIslandPresence();
  const swap = useScreenTransition(sort);

  const posts = useHashtagPosts(tag || null, sort);
  const rows = feedPosts(posts.data);

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={p.ink.default} strokeWidth={2.2} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.barTitle, { color: p.ink.default }]}>
            #{tag}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const nearEnd =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;
            if (nearEnd && posts.hasNextPage && !posts.isFetchingNextPage) {
              void posts.fetchNextPage();
            }
          }}
          scrollEventThrottle={200}
        >
          {/* Identity: the glyph and the size, so the page says what it is
              before any content loads. */}
          <View style={styles.head}>
            <View
              style={[
                styles.glyph,
                { backgroundColor: withAlpha(p.accent.mint, 0.14) },
              ]}
            >
              <Hash size={26} color={p.accent.mint} strokeWidth={2.6} />
            </View>
            <View style={styles.headText}>
              <Text style={[styles.title, { color: p.ink.default }]}>#{tag}</Text>
              <Text style={[styles.count, { color: p.ink.dim }]}>
                {rows.length === 0 && posts.isLoading
                  ? "Loading…"
                  : `${rows.length}${posts.hasNextPage ? "+" : ""} ${
                      rows.length === 1 ? "post" : "posts"
                    }`}
              </Text>
            </View>
          </View>

          <View style={[styles.tabs, { borderBottomColor: p.line.default }]}>
            {SORTS.map((entry) => {
              const active = entry.key === sort;
              return (
                <Pressable
                  key={entry.key}
                  onPress={() => {
                    if (active) return;
                    Haptics.selectionAsync().catch(() => {});
                    setSort(entry.key);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={styles.tab}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: active ? p.ink.default : p.ink.dim,
                        fontWeight: active ? "800" : "600",
                      },
                    ]}
                  >
                    {entry.label}
                  </Text>
                  <View
                    style={[
                      styles.tabRule,
                      { backgroundColor: active ? p.accent.mint : "transparent" },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          <Animated.View style={swap}>
            <PostGrid
              posts={rows}
              loading={posts.isLoading}
              onOpen={(post) => router.push(routes.communityPost(post.id))}
              empty={
                <View style={styles.empty}>
                  <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
                    Nothing tagged #{tag} yet
                  </Text>
                  <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
                    Put the tag in a caption and your post shows up here.
                  </Text>
                  <Pressable
                    onPress={() => router.push(routes.communityCompose())}
                    accessibilityRole="button"
                    style={[styles.cta, { backgroundColor: p.accent.mint }]}
                  >
                    <Text style={styles.ctaText}>Create a post</Text>
                  </Pressable>
                </View>
              }
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  barTitle: { flex: 1, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  content: { paddingBottom: 130 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  glyph: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, gap: 3 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.6 },
  count: { fontSize: 13 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  tab: { flex: 1, alignItems: "center", gap: 8, paddingTop: 4 },
  tabLabel: { fontSize: 15, letterSpacing: -0.2 },
  tabRule: {
    height: 2.5,
    alignSelf: "stretch",
    marginHorizontal: 28,
    borderRadius: 2,
  },
  empty: { paddingVertical: 48, paddingHorizontal: 32, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  emptyBody: { fontSize: 13.5, textAlign: "center", lineHeight: 19 },
  cta: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: { fontSize: 14, fontWeight: "800", color: "#06140d" },
});
