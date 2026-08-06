/**
 * PortfolioSheet — tap a binder tile on a profile, see what's inside.
 *
 * Same bottom-sheet shell as the follower/following popup, but the body is
 * the VAULT's own card row (CardSparkRow) — one list anatomy everywhere a
 * card list appears. Rows deep-link to the native card screen.
 */
import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCollectorPortfolio } from "@/application/queries/social/useSocial";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import { CardSparkRow } from "@/presentation/cards";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
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
    <BottomSheet
      visible={collectionId != null}
      onClose={onClose}
      title={binder?.name ?? "Collection"}
      subtitle={sub || null}
      overlay
      minHeight="45%"
      maxHeight="78%"
    >
      {q.isLoading ? (
        // Card-row skeletons in the vault row's own shape.
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <View
                style={[styles.skeletonThumb, { backgroundColor: withAlpha(p.ink.dim, 0.12) }]}
              />
              <View style={{ flex: 1, gap: 7 }}>
                <View
                  style={[
                    styles.skeletonBar,
                    { width: "55%", backgroundColor: withAlpha(p.ink.dim, 0.12) },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonBar,
                    { width: "32%", backgroundColor: withAlpha(p.ink.dim, 0.08) },
                  ]}
                />
              </View>
            </View>
          ))}
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: "center" },
  empty: { textAlign: "center", paddingVertical: 40, fontSize: 13 },
  skeletons: { gap: 4, paddingTop: 6 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
  },
  skeletonThumb: { width: 42, height: 58, borderRadius: 8 },
  skeletonBar: { height: 10, borderRadius: 5 },
});
