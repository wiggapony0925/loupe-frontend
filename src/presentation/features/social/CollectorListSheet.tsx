/**
 * CollectorListSheet — THE reusable people-list popup.
 *
 * One sheet serves every "list of collectors" moment, exactly like
 * Instagram's follower modal: profile follower/following lists (with
 * Remove on your own followers), and the "who owns this card" list on
 * card detail. Tapping a row closes the sheet and opens that profile;
 * follow buttons work inline and rows never vanish mid-scroll (the
 * follow mutation patches caches instead of refetching).
 *
 * Presentational by design: callers hand it `rows` (+ loading/empty text),
 * so any future list — likers, request senders, trade partners — reuses it
 * by just fetching differently.
 */
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Users } from "lucide-react-native";
import { router } from "expo-router";
import { useFollowCollector } from "@/application/queries/social/useSocial";
import type { SocialUserCardWire } from "@/infrastructure/http";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { CollectorRow } from "@/presentation/features/social/CollectorRow";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

export interface CollectorListSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  rows: SocialUserCardWire[] | undefined;
  loading?: boolean;
  emptyText?: string;
  /** Shown under a row's name (keyed by username) — e.g. "owns 2 copies". */
  noteFor?: (user: SocialUserCardWire) => string | null;
  /** Instagram's "Remove" on MY followers list; replaces the follow button. */
  onRemove?: (handle: string) => void;
  removePendingHandle?: string | null;
}

export function CollectorListSheet({
  visible,
  onClose,
  title,
  rows,
  loading = false,
  emptyText = "Nobody here yet.",
  noteFor,
  onRemove,
  removePendingHandle,
}: CollectorListSheetProps) {
  const p = useThemedPalette();
  const follow = useFollowCollector();

  const openProfile = (handle: string) => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    router.push(routes.collector(handle));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={rows ? `${rows.length} ${rows.length === 1 ? "person" : "people"}` : null}
      // The popover this always was: floats over the profile, never a
      // full page-sheet takeover.
      overlay
      minHeight="45%"
      maxHeight="78%"
    >
      {loading ? (
        // Skeleton rows, not a spinner — the sheet keeps its shape while
        // the list arrives, so nothing jumps when it lands.
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <View
                style={[styles.skeletonAvatar, { backgroundColor: withAlpha(p.ink.dim, 0.12) }]}
              />
              <View style={{ flex: 1, gap: 7 }}>
                <View
                  style={[
                    styles.skeletonBar,
                    { width: "45%", backgroundColor: withAlpha(p.ink.dim, 0.12) },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonBar,
                    { width: "28%", backgroundColor: withAlpha(p.ink.dim, 0.08) },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : !rows || rows.length === 0 ? (
        <View style={styles.center}>
          <Users size={22} color={p.ink.dim} strokeWidth={2} />
          <Text style={[styles.empty, { color: p.ink.muted }]}>{emptyText}</Text>
        </View>
      ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {rows.map((user) => {
                const note = noteFor?.(user) ?? null;
                return (
                  <View key={user.user_id}>
                    <CollectorRow
                      user={user}
                      onPress={() => openProfile(user.username)}
                      onToggleFollow={
                        onRemove ? undefined : (next) => follow.mutate(next)
                      }
                      pending={follow.isPending}
                      trailing={
                        onRemove && user.relationship !== "self" ? (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              ).catch(() => {});
                              onRemove(user.username);
                            }}
                            disabled={removePendingHandle === user.username}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove @${user.username} from your followers`}
                            hitSlop={6}
                            style={[
                              styles.remove,
                              {
                                borderColor: withAlpha(p.accent.rose, 0.5),
                                opacity:
                                  removePendingHandle === user.username ? 0.5 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.removeText, { color: p.accent.rose }]}>
                              Remove
                            </Text>
                          </Pressable>
                        ) : undefined
                      }
                    />
                    {note ? (
                      <Text style={[styles.note, { color: p.ink.muted }]}>{note}</Text>
                    ) : null}
                  </View>
                );
              })}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  skeletons: { gap: 4, paddingTop: 6 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22 },
  skeletonBar: { height: 10, borderRadius: 5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { fontSize: 13, textAlign: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  remove: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeText: { fontSize: 12, fontWeight: "800" },
  note: { fontSize: 11, marginTop: -6, marginBottom: 6, marginLeft: 56 },
});
