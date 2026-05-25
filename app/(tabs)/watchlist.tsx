/**
 * Watchlist tab — surfaces existing `price_alerts` as a first-class destination.
 *
 * Why this exists:
 *   The backend has had `/v1/alerts` (Bell icon on card detail → `PriceAlertSheet`)
 *   for a while, but users had no way to see *all* the cards they're watching
 *   without browsing into each one. This tab is the index view: every active
 *   threshold, the card it watches, and a path back to the card detail.
 *
 * Reuses (no duplication):
 *   - `usePriceAlerts({})` for the list query (already invalidation-wired).
 *   - `useDeletePriceAlert()` for swipe-to-cancel.
 *   - `CardImage` for the thumbnail so caching is shared with vault / search.
 *   - `Skeleton` + `EmptyState` primitives so loading / empty UX matches the
 *     rest of the app.
 *
 * Triggered alerts (`triggered_at != null`) get a "Hit at $X" pill so the user
 * can act on real movement without digging into a notification feed.
 */
import React, { useCallback } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowDownRight, ArrowUpRight, Bell, Trash2 } from "lucide-react-native";

import { useDeletePriceAlert, usePriceAlerts } from "@/application/queries/usePriceAlerts";
import type { PriceAlertWire } from "@/infrastructure/http";
import { CardImage } from "@/presentation/components/CardImage";
import { EmptyState } from "@/presentation/components/EmptyState";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

function formatUsd(value: string | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RowProps {
  alert: PriceAlertWire;
  onPress: () => void;
  onDelete: () => void;
}

function WatchRow({ alert, onPress, onDelete }: RowProps) {
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
        style={{ padding: 6, borderRadius: 8 }}
      >
        <Trash2 size={16} color={p.ink.dim} />
      </Pressable>
    </Pressable>
  );
}

export default function WatchlistScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const alerts = usePriceAlerts({});
  const deleteMut = useDeletePriceAlert();

  const onDelete = useCallback(
    (alert: PriceAlertWire) => {
      Alert.alert(
        "Cancel alert?",
        `Stop watching ${alert.card_name ?? "this card"}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel alert",
            style: "destructive",
            onPress: () => {
              void deleteMut.mutateAsync(alert.id);
            },
          },
        ],
      );
    },
    [deleteMut],
  );

  const rows = alerts.data ?? [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
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
          Watchlist
        </Text>
        <Text style={{ color: p.ink.default, fontSize: 24, fontWeight: "700" }}>
          {rows.length > 0
            ? `${rows.length} card${rows.length === 1 ? "" : "s"} on watch`
            : "Quiet on the wire"}
        </Text>
      </View>

      <FlatList
        data={alerts.isLoading ? [] : rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: 48,
          gap: 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={alerts.isFetching && !alerts.isLoading}
            onRefresh={() => void alerts.refetch()}
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
              title="Couldn't load watchlist"
              message={alerts.error?.message ?? "Pull to retry."}
            />
          ) : (
            <EmptyState
              icon={Bell}
              title="No alerts yet"
              message="Tap the bell on any card to start watching its price."
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
    </SafeAreaView>
  );
}
