/**
 * One hashtag's posts — where a #chip and a tapped word in a caption land.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useHashtagPosts } from "@/application/queries/social/useFeed";
import { FeedList } from "@/presentation/features/social/feed/FeedList";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function HashtagScreen() {
  const p = useThemedPalette();
  const params = useLocalSearchParams<{ tag?: string }>();
  const tag = (params.tag ?? "").replace(/^#/, "").toLowerCase();

  useCommunityIslandPresence();

  const posts = useHashtagPosts(tag || null);
  const count = posts.data?.pages[0]?.items.length ?? 0;

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
          <View style={styles.barText}>
            <Text numberOfLines={1} style={[styles.title, { color: p.ink.default }]}>
              #{tag}
            </Text>
          </View>
        </View>

        <FeedList
          query={posts}
          emptyTitle={`Nothing tagged #${tag}`}
          emptyBody={
            count === 0
              ? "Be the first — put the tag in a caption and it shows up here."
              : "No posts yet."
          }
        />
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
    paddingBottom: 12,
  },
  barText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.6 },
});
