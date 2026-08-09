/**
 * Your story archive — everything you've posted, including what's expired.
 *
 * Stories are the one thing in this app designed to disappear, which is
 * exactly why there has to be somewhere they don't. The server keeps the
 * row past its 24 hours and only ever hands it back to the person who
 * posted it; this is the screen that reads it.
 *
 * A grid, not a reel: you're looking for a specific day, not watching in
 * order. Live cards are marked, because "which of these are still up?" is
 * the question people come here with.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ChevronLeft, Clock, Play, Trash2 } from "lucide-react-native";
import type { StoryWire } from "@/infrastructure/http/wire/social";
import {
  useDeleteStory,
  useStoryArchive,
} from "@/application/queries/social/useStories";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const COLUMNS = 3;
const GAP = 2;

export default function StoryArchiveScreen() {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();
  const archive = useStoryArchive();
  const remove = useDeleteStory();
  const [selected, setSelected] = useState<StoryWire | null>(null);

  const size = (width - 40 - GAP * (COLUMNS - 1)) / COLUMNS;
  const rows = useMemo(() => archive.data ?? [], [archive.data]);

  // "Still up" is a client-side read of a server-sent timestamp rather than
  // a flag, so it stays honest between refetches — a card that expires
  // while this screen is open stops being marked live on the next render.
  const now = Date.now();
  const live = useMemo(
    () => new Set(rows.filter((s) => Date.parse(s.expires_at) > now).map((s) => s.id)),
    [rows, now],
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <View className="flex-row items-center gap-1 px-2 pt-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color={p.ink.default} />
        </Pressable>
      </View>

      <View className="px-5 pb-4">
        <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Only you can see this
        </Text>
        <Text className="mt-1 text-[28px] font-bold tracking-tight text-ink">
          Story archive
        </Text>
        <Text className="mt-1 text-[13px] text-ink-muted">
          Every story you've posted. They disappear from Community after 24
          hours — they stay here.
        </Text>
      </View>

      {archive.isLoading ? (
        <ActivityIndicator color={p.ink.dim} style={styles.loading} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
            Nothing here yet
          </Text>
          <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
            Stories you post show up here, and stay after they expire.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.grid}>
            {rows.map((story) => (
              <Pressable
                key={story.id}
                onPress={() => setSelected(selected?.id === story.id ? null : story)}
                accessibilityRole="button"
                accessibilityLabel={`Story from ${new Date(story.created_at).toLocaleDateString()}`}
                style={({ pressed }) => [
                  styles.tile,
                  { width: size, height: size * 1.4 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Image
                  source={{ uri: absolutize(story.url) ?? undefined }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                  accessibilityIgnoresInvertColors
                />
                {story.kind === "video" ? (
                  <View style={styles.playBadge} pointerEvents="none">
                    <Play size={12} color="#fff" fill="#fff" />
                  </View>
                ) : null}
                {live.has(story.id) ? (
                  <View
                    style={[styles.liveBadge, { backgroundColor: p.accent.mint }]}
                    pointerEvents="none"
                  >
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                ) : null}
                <View style={styles.tileFoot} pointerEvents="none">
                  <Text style={styles.tileDate}>
                    {new Date(story.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.tileViews}>
                    {story.view_count} {story.view_count === 1 ? "view" : "views"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Selecting a tile reveals its actions inline rather than pushing a
          screen: the only thing to do with an archived story is delete it,
          and a whole route for one destructive button is a route too many. */}
      {selected ? (
        <View
          style={[
            styles.actions,
            { backgroundColor: p.bg.elevated, borderTopColor: p.line.default },
          ]}
        >
          <View style={styles.actionsText}>
            <Text style={[styles.actionsTitle, { color: p.ink.default }]}>
              {new Date(selected.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
            <View style={styles.actionsMeta}>
              <Clock size={12} color={p.ink.dim} />
              <Text style={[styles.actionsSub, { color: p.ink.dim }]}>
                {live.has(selected.id)
                  ? "Still visible in Community"
                  : "Expired — only you can see it"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() =>
              remove.mutate(
                { storyId: selected.id },
                { onSuccess: () => setSelected(null) },
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Delete this story permanently"
            style={[
              styles.delete,
              { backgroundColor: withAlpha(p.accent.rose, 0.14) },
            ]}
          >
            <Trash2 size={15} color={p.accent.rose} />
            <Text style={[styles.deleteText, { color: p.accent.rose }]}>
              Delete
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 50 },
  empty: { paddingHorizontal: 34, paddingVertical: 44, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyBody: { fontSize: 13.5, lineHeight: 19, textAlign: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { borderRadius: 6, overflow: "hidden", marginBottom: GAP },
  playBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  liveBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  liveText: { color: "#06140d", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
  tileFoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  tileDate: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  tileViews: { color: "rgba(255,255,255,0.8)", fontSize: 9.5, fontWeight: "600" },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionsText: { flex: 1, gap: 3 },
  actionsTitle: { fontSize: 14.5, fontWeight: "800" },
  actionsMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionsSub: { fontSize: 12, fontWeight: "600" },
  delete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  deleteText: { fontSize: 13.5, fontWeight: "800" },
});
