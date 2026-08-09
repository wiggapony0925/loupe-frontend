/**
 * Who watched your story. Author only — the server 403s anyone else, and
 * the sheet is only reachable from your own reel.
 *
 * Newest first, because "who just saw it" is the question being asked.
 */
import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "react-native";
import type { StoryWire } from "@/infrastructure/http/wire/social";
import { useStoryViewers } from "@/application/queries/social/useStories";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";
import { routes } from "@/shared/routes";

export function StoryViewersSheet({
  story,
  onClose,
}: {
  story: StoryWire | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const viewers = useStoryViewers(story?.id ?? null, Boolean(story));
  const rows = viewers.data ?? [];

  return (
    <BottomSheet
      visible={Boolean(story)}
      onClose={onClose}
      title="Viewers"
      subtitle={
        rows.length > 0
          ? `${rows.length} ${rows.length === 1 ? "person" : "people"} watched`
          : "Nobody yet"
      }
      overlay
      minHeight="45%"
      maxHeight="85%"
      flush
    >
      {viewers.isLoading ? (
        <ActivityIndicator color={p.ink.dim} style={styles.loading} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.viewer.user_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: p.ink.dim }]}>
              Nobody has opened this one yet.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onClose();
                router.push(routes.collector(item.viewer.username));
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open @${item.viewer.username}`}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <SocialAvatar
                handle={item.viewer.username}
                name={item.viewer.display_name}
                url={item.viewer.avatar_url}
                size={38}
                isPro={item.viewer.is_pro}
              />
              <View style={styles.ident}>
                <Text style={[styles.name, { color: p.ink.default }]} numberOfLines={1}>
                  {item.viewer.display_name?.trim() || `@${item.viewer.username}`}
                </Text>
                <Text style={[styles.handle, { color: p.ink.dim }]} numberOfLines={1}>
                  @{item.viewer.username}
                </Text>
              </View>
              <Text style={[styles.when, { color: p.ink.dim }]}>
                {relativeTime(item.viewed_at)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  empty: { fontSize: 13.5, textAlign: "center", paddingVertical: 34 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  ident: { flex: 1, minWidth: 0 },
  name: { fontSize: 14.5, fontWeight: "700" },
  handle: { fontSize: 12.5, fontWeight: "600" },
  when: { fontSize: 11.5, fontWeight: "600" },
});
