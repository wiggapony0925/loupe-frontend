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
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useFollowCollector } from "@/application/queries/social/useSocial";
import type { SocialUserCardWire } from "@/infrastructure/http";
import { CollectorRow } from "@/presentation/features/social/CollectorRow";
import { radius, spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
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
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
    >
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <SafeAreaView
          edges={["bottom"]}
          style={[styles.sheet, { backgroundColor: p.bg.base }]}
        >
          <View style={styles.handleRow}>
            <View
              style={[styles.handle, { backgroundColor: withAlpha(p.ink.dim, 0.3) }]}
            />
          </View>
          <Text style={[styles.title, { color: p.ink.default }]}>{title}</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.ink.dim} />
            </View>
          ) : !rows || rows.length === 0 ? (
            <View style={styles.center}>
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
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "72%",
    minHeight: "38%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xs,
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  title: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center",
    paddingBottom: spacing.sm,
  },
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
