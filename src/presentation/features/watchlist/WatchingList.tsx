/**
 * `WatchingList` — reusable price-alert index extracted from the old
 * Watch tab. Rendered in two places now:
 *
 *   1. The Notifications screen behind the bell, under a
 i *      `[Inbox | Favorites]` segmented header.
 *   2. The standalone `/watchlist` route, kept around for deep links
 *      (e.g. push notifications that say "your $X alert fired").
 *
 * The Watch tab was retired in favor of a center-pinned Scan tab — the
 * primary verb of the app deserves the slot more than a management
 * screen most users won't configure. Behind the bell, this list still
 * answers "what am I watching?" without burning global navigation.
 */
import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowDownRight, ArrowUpRight, Bell, Heart, Trash2 } from "lucide-react-native";
import { useDeletePriceAlert, usePriceAlerts } from "@/application/queries/alerts/usePriceAlerts";
import {
  useRemoveFromWatchlist,
  useWatchlist,
} from "@/application/queries/collection/useWatchlist";
import type { PriceAlertWire, WatchlistItemWire } from "@/infrastructure/http";
import { CardImage } from "@/presentation/components/CardImage";
import { useMoney } from "@/presentation/components/Price";
import { EmptyState } from "@/presentation/components/EmptyState";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";


interface RowProps {
  alert: PriceAlertWire;
  onPress: () => void;
  onDelete: () => void;
}

function WatchRow({ alert, onPress, onDelete }: RowProps) {
  const { format: __money } = useMoney();
  const formatUsd = (value: string | null | undefined): string => {
    if (value == null) return "—";
    const n = Number(value);
    return Number.isFinite(n) ? __money(n, { compact: false }) : "—";
  };
  const p = useThemedPalette();
  const isAbove = alert.condition === "above";
  const triggered = alert.triggered_at != null;
  const directionColor = isAbove ? p.accent.mint : p.accent.rose;
  const Arrow = isAbove ? ArrowUpRight : ArrowDownRight;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: p.bg.elevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: triggered ? withAlpha(p.accent.mint, 0.4) : p.line.default,
      }}
    >
      <CardImage
        uri={alert.card_image_url}
        style={{ width: 44, height: 60, borderRadius: 6 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: p.ink.default,
            fontSize: 14,
            fontWeight: "600",
            marginBottom: 4,
          }}
        >
          {alert.card_name ?? "Unknown card"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Arrow size={12} color={directionColor} />
          <Text
            style={{
              color: directionColor,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.4,
            }}
          >
            {isAbove ? "ABOVE" : "BELOW"} {formatUsd(alert.threshold_usd)}
          </Text>
          {triggered ? (
            <Text
              style={{
                color: p.accent.mint,
                fontSize: 11,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              · Hit at {formatUsd(alert.triggered_price_usd)}
            </Text>
          ) : null}
        </View>
        {alert.note ? (
          <Text
            numberOfLines={1}
            style={{ color: p.ink.dim, fontSize: 11, marginTop: 2 }}
          >
            {alert.note}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Delete price alert"
        style={{ padding: 6, borderRadius: 8 }}
      >
        <Trash2 size={16} color={p.ink.dim} />
      </Pressable>
    </Pressable>
  );
}

function PinnedCardsRail({
  items,
  onPress,
  onUnpin,
}: {
  items: WatchlistItemWire[];
  onPress: (cardId: string) => void;
  onUnpin: (item: WatchlistItemWire) => void;
}) {
  const p = useThemedPalette();
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 6,
          marginBottom: 8,
        }}
      >
        <Heart size={12} color={p.accent.rose} fill={p.accent.rose} />
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Favorites · {items.length}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 6 }}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onPress(item.card_id)}
            onLongPress={() => onUnpin(item)}
            style={{ width: 84 }}
          >
            <CardImage
              uri={item.card_image_url}
              style={{
                width: 84,
                height: 116,
                borderRadius: 8,
                backgroundColor: p.bg.elevated,
              }}
            />
            <Text
              numberOfLines={2}
              style={{
                color: p.ink.default,
                fontSize: 11,
                fontWeight: "600",
                marginTop: 6,
                lineHeight: 14,
              }}
            >
              {item.card_name ?? "Unknown"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export interface WatchingListProps {
  /**
   * When true, the component renders its own header (eyebrow + count).
   * The Notifications screen passes `false` since the segmented control
   * already serves as the section header.
   */
  showHeader?: boolean;
}

export function WatchingList({ showHeader = true }: WatchingListProps) {
  const p = useThemedPalette();
  const router = useRouter();
  const alerts = usePriceAlerts({});
  const deleteMut = useDeletePriceAlert();
  const watchlist = useWatchlist();
  const unpinMut = useRemoveFromWatchlist();
  const pinned = watchlist.data ?? [];

  // Tap = do it (house style). Both actions are trivially reversible —
  // re-favorite from the card screen, re-create the alert in two taps — so
  // no confirm popups; a light haptic acknowledges the removal instead.
  const onUnpin = useCallback(
    (item: WatchlistItemWire) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      void unpinMut.mutateAsync(item.card_id);
    },
    [unpinMut],
  );

  const onDelete = useCallback(
    (alert: PriceAlertWire) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      void deleteMut.mutateAsync(alert.id);
    },
    [deleteMut],
  );

  const rows = alerts.data ?? [];

  return (
    <View style={{ flex: 1 }}>
      {showHeader ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 11,
              fontWeight: "600",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Favorites & Alerts
          </Text>
          <Text style={{ color: p.ink.default, fontSize: 24, fontWeight: "700" }}>
            {pinned.length > 0 || rows.length > 0
              ? `${pinned.length} favorite${pinned.length === 1 ? "" : "s"} · ${rows.length} alert${rows.length === 1 ? "" : "s"}`
              : "Nothing saved yet"}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={alerts.isLoading ? [] : rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: 48,
          gap: 8,
        }}
        ListHeaderComponent={
          <PinnedCardsRail
            items={pinned}
            onPress={(cardId) => router.push(routes.card(cardId))}
            onUnpin={onUnpin}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={
              (alerts.isFetching && !alerts.isLoading) ||
              (watchlist.isFetching && !watchlist.isLoading)
            }
            onRefresh={() => {
              void alerts.refetch();
              void watchlist.refetch();
            }}
            tintColor={p.ink.muted}
          />
        }
        ListEmptyComponent={
          alerts.isLoading ? (
            <View style={{ paddingHorizontal: 0, gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 84, borderRadius: 14 }} />
              ))}
            </View>
          ) : alerts.isError ? (
            <EmptyState
              icon={Bell}
              title="Couldn't load favorites"
              message={alerts.error?.message ?? "Pull to retry."}
            />
          ) : (
            <EmptyState
              icon={Bell}
              title="No alerts yet"
              message="Tap a heart to save favorite cards, or tap the bell on a card to add a price alert."
              secondaryActionLabel="Browse cards"
              onSecondaryAction={() => router.push("/search")}
            />
          )
        }
        renderItem={({ item }) => (
          <WatchRow
            alert={item}
            onPress={() => router.push(routes.card(item.card_id))}
            onDelete={() => onDelete(item)}
          />
        )}
      />
    </View>
  );
}
