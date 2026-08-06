/**
 * PortfolioSheet — tap a binder tile on a profile, see what's inside.
 *
 * Same bottom-sheet shell as the follower/following popup, but the body is
 * the VAULT's own card row (CardSparkRow) — one list anatomy everywhere a
 * card list appears. Rows deep-link to the native card screen.
 */
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useCollectorPortfolio } from "@/application/queries/social/useSocial";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import { CardSparkRow } from "@/presentation/cards";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

function money(v: string | null): string | null {
  if (v == null) return null;
  return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function PortfolioSheet({
  handle,
  collectionId,
  onClose,
}: {
  /** Whose binder. */
  handle: string | null;
  /** Which binder — null keeps the sheet closed. */
  collectionId: string | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const q = useCollectorPortfolio(handle, collectionId);
  const binder = q.data ?? null;

  const openCard = (item: SocialCollectionItemWire) => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    router.push(routes.card(item.card_id));
  };

  const sub = binder
    ? [
        `${binder.count} ${binder.count === 1 ? "card" : "cards"}`,
        money(binder.estimated_value_usd),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Modal
      visible={collectionId != null}
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
          <View style={[styles.grabber, { backgroundColor: p.line.default }]} />
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={[styles.title, { color: p.ink.default }]}
              >
                {binder?.name ?? "Collection"}
              </Text>
              {sub ? (
                <Text numberOfLines={1} style={[styles.sub, { color: p.ink.dim }]}>
                  {sub}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: p.bg.elevated }]}
            >
              <X size={16} color={p.ink.dim} />
            </Pressable>
          </View>

          {q.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={p.accent.mint} />
            </View>
          ) : (
            <FlatList
              data={binder?.items ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: p.ink.dim }]}>
                  Nothing in this collection yet.
                </Text>
              }
              renderItem={({ item }) => {
                const grade = Number(item.grade);
                const hasGrade = Number.isFinite(grade) && grade > 0;
                return (
                  <CardSparkRow
                    thumbUri={item.card_image_url ?? undefined}
                    recyclingKey={item.id}
                    title={item.card_name ?? "Unknown card"}
                    badge={
                      hasGrade
                        ? {
                            label:
                              grade % 1 === 0 ? String(grade) : grade.toFixed(1),
                            tint: p.accent.mint,
                          }
                        : null
                    }
                    meta={[item.card_set_name, item.card_number && `#${item.card_number}`]
                      .filter(Boolean)
                      .join(" · ") || null}
                    priceUsd={
                      item.estimated_value_usd != null
                        ? Number(item.estimated_value_usd)
                        : null
                    }
                    priceLabel="Value"
                    onPress={() => openCard(item)}
                    accessibilityLabel={`${item.card_name ?? "Card"}, open card page`}
                  />
                );
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    maxHeight: "78%",
    minHeight: "45%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  sub: { fontSize: 12, marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { paddingVertical: 48, alignItems: "center" },
  empty: { textAlign: "center", paddingVertical: 40, fontSize: 13 },
});
