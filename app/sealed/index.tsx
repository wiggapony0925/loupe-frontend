/**
 * My Sealed — the user's sealed-product vault.
 *
 * Sealed (booster boxes, ETBs, tins) is a separate destination from the
 * graded-card vault because it has different shape: quantity-based,
 * cost-basis-centric, no per-card-grade column. Sits beside the main
 * vault as a peer rather than competing for tab real estate.
 *
 * Reuses (no duplication):
 *   - `useMySealedHoldings` / `useDeleteSealedHolding` (queries hooks).
 *   - `CardImage` for thumbnails so caching is shared with vault / search.
 *   - `EmptyState` + `Skeleton` so loading + empty UX matches the rest.
 */
import React, { useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Package, Plus, Trash2 } from "lucide-react-native";
import {
  useDeleteSealedHolding,
  useMySealedHoldings,
} from "@/application/queries/collection/useSealed";
import type { SealedHoldingWire, SealedProductType } from "@/infrastructure/http";
import { fullUsd } from "@/shared/format";
import { CardImage } from "@/presentation/components/CardImage";
import { EmptyState } from "@/presentation/components/EmptyState";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const PRODUCT_LABEL: Record<SealedProductType, string> = {
  booster_box: "Booster Box",
  booster_pack: "Booster Pack",
  etb: "Elite Trainer Box",
  collection_box: "Collection Box",
  premium_collection: "Premium Collection",
  tin: "Tin",
  blister: "Blister",
  bundle: "Bundle",
  case: "Case",
  other: "Other",
};

interface RowProps {
  holding: SealedHoldingWire;
  onDelete: () => void;
}

function HoldingRow({ holding, onDelete }: RowProps) {
  const p = useThemedPalette();
  const opened = holding.opened_at != null;
  const productType = holding.product_type
    ? PRODUCT_LABEL[holding.product_type]
    : "Sealed";
  // Cost basis × quantity — the headline "what did I pay total" number.
  // Falls back to MSRP-less display (em-dash) when no cost was recorded.
  const totalCost = useMemo(() => {
    if (holding.purchase_price_usd == null) return null;
    const each = Number(holding.purchase_price_usd);
    if (!Number.isFinite(each)) return null;
    return each * holding.quantity;
  }, [holding.purchase_price_usd, holding.quantity]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: p.bg.elevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: opened ? withAlpha(p.accent.amber, 0.3) : p.line.default,
        opacity: opened ? 0.7 : 1,
      }}
    >
      <CardImage
        uri={holding.product_image_url}
        style={{ width: 48, height: 60, borderRadius: 6 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            color: p.ink.default,
            fontSize: 14,
            fontWeight: "600",
            marginBottom: 4,
          }}
        >
          {holding.product_name ?? "Sealed product"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 11,
              fontWeight: "600",
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {productType}
          </Text>
          <Text style={{ color: p.ink.dim, fontSize: 11 }}>
            · ×{holding.quantity}
          </Text>
          {opened ? (
            <Text
              style={{
                color: p.accent.amber,
                fontSize: 10,
                fontWeight: "700",
                marginLeft: 4,
              }}
            >
              OPENED
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "600" }}>
          {totalCost != null ? fullUsd(totalCost) : "—"}
        </Text>
        <Text style={{ color: p.ink.dim, fontSize: 10 }}>cost basis</Text>
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Delete sealed item"
        style={{ padding: 6, borderRadius: 8 }}
      >
        <Trash2 size={16} color={p.ink.dim} />
      </Pressable>
    </View>
  );
}

export default function MySealedScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const holdings = useMySealedHoldings({});
  const deleteMut = useDeleteSealedHolding();

  const onDelete = useCallback(
    (h: SealedHoldingWire) => {
      Alert.alert(
        "Remove sealed?",
        `Remove ${h.product_name ?? "this product"} (×${h.quantity}) from your vault?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              void deleteMut.mutateAsync(h.id);
            },
          },
        ],
      );
    },
    [deleteMut],
  );

  const rows = useMemo(() => holdings.data ?? [], [holdings.data]);

  // Totals — cost-basis sum across the whole vault. Skips rows without a
  // recorded purchase price so the headline isn't misleadingly low.
  const totalCost = useMemo(() => {
    return rows.reduce((acc, h) => {
      if (h.purchase_price_usd == null) return acc;
      const each = Number(h.purchase_price_usd);
      if (!Number.isFinite(each)) return acc;
      return acc + each * h.quantity;
    }, 0);
  }, [rows]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingTop: 4,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ padding: 8 }}
        >
          <ChevronLeft size={22} color={p.ink.default} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push("/sealed/add")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.15),
          }}
        >
          <Plus size={14} color={p.accent.mint} />
          <Text
            style={{ color: p.accent.mint, fontSize: 13, fontWeight: "700" }}
          >
            Add Sealed
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
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
          Sealed Vault
        </Text>
        <Text style={{ color: p.ink.default, fontSize: 24, fontWeight: "700" }}>
          {rows.length > 0
            ? `${rows.length} sealed holding${rows.length === 1 ? "" : "s"}`
            : "Track sealed product"}
        </Text>
        {rows.length > 0 ? (
          <Text style={{ color: p.ink.muted, fontSize: 13, marginTop: 4 }}>
            Total cost basis · {fullUsd(totalCost)}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={holdings.isLoading ? [] : rows}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: 48,
          gap: 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={holdings.isFetching && !holdings.isLoading}
            onRefresh={() => void holdings.refetch()}
            tintColor={p.ink.muted}
          />
        }
        ListEmptyComponent={
          holdings.isLoading ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 84, borderRadius: 14 }} />
              ))}
            </View>
          ) : holdings.isError ? (
            <EmptyState
              icon={Package}
              title="Couldn't load sealed"
              message={holdings.error?.message ?? "Pull to retry."}
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No sealed product yet"
              message="Track booster boxes, ETBs, and tins alongside your singles. Hold for the long term, watch them appreciate."
              secondaryActionLabel="Add your first"
              onSecondaryAction={() => router.push("/sealed/add")}
            />
          )
        }
        renderItem={({ item }) => (
          <HoldingRow holding={item} onDelete={() => onDelete(item)} />
        )}
      />
    </SafeAreaView>
  );
}
