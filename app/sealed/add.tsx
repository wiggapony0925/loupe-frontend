/**
 * Add Sealed — search-driven picker + lightweight cost-basis form.
 *
 * Two-pane flow inside a single screen:
 *   1. Search the catalog (`/v1/sealed/search`).
 *   2. Tap a product → it becomes the "selected" pill at the top, and
 *      the form (quantity + purchase price + date + notes) becomes
 *      submittable. Save → invalidates `useMySealedHoldings` and
 *      router.back()s to the My Sealed list.
 *
 * Intentionally no separate modal — keeps the UI footprint small and
 * lets the back button do the right thing on iOS.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Check, ChevronLeft, Search, X } from "lucide-react-native";
import {
  useCreateSealedHolding,
  useSealedProduct,
  useSealedSearch,
} from "@/application/queries/collection/useSealed";
import type {
  SealedHoldingCreateWire,
  SealedProductType,
  SealedProductWire,
} from "@/infrastructure/http";
import { CardImage } from "@/presentation/components/CardImage";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const PRODUCT_TYPE_FILTERS: {
  key: SealedProductType | null;
  label: string;
}[] = [
  { key: null, label: "All" },
  { key: "booster_box", label: "Boxes" },
  { key: "etb", label: "ETBs" },
  { key: "premium_collection", label: "Premium" },
  { key: "tin", label: "Tins" },
  { key: "bundle", label: "Bundles" },
];

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

export default function AddSealedScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SealedProductType | null>(null);
  const [selected, setSelected] = useState<SealedProductWire | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");

  const search = useSealedSearch(q, { productType: filter });
  const createMut = useCreateSealedHolding();
  // Deep-link pre-select: when arriving from the search rail with a
  // `productId`, hydrate `selected` straight from the per-id endpoint
  // so the form is one tap from save even when the product isn't in
  // the default catalog page.
  const deepLinked = useSealedProduct(productId);

  useEffect(() => {
    if (selected != null) return;
    if (deepLinked.data) setSelected(deepLinked.data);
  }, [deepLinked.data, selected]);

  const canSubmit = useMemo(() => {
    if (selected == null) return false;
    const qty = parseInt(quantity, 10);
    return Number.isFinite(qty) && qty >= 1;
  }, [selected, quantity]);

  const onSubmit = useCallback(async () => {
    if (selected == null) return;
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      Alert.alert("Invalid quantity", "Quantity must be at least 1.");
      return;
    }
    const payload: SealedHoldingCreateWire = {
      product_id: selected.id,
      quantity: qty,
    };
    if (price.trim().length > 0) {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert("Invalid price", "Purchase price must be a positive number.");
        return;
      }
      payload.purchase_price_usd = n.toFixed(2);
    }
    if (date.trim().length > 0) {
      // Accept the user's literal YYYY-MM-DD string; the backend validator
      // rejects future dates / pre-1990 typos, so we don't double-check.
      payload.purchase_date = date.trim();
    }
    try {
      await createMut.mutateAsync(payload);
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again.");
    }
  }, [createMut, date, price, quantity, router, selected]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
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
        <Text
          style={{
            flex: 1,
            color: p.ink.default,
            fontSize: 17,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          Add Sealed
        </Text>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit || createMut.isPending}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Save sealed item"
          style={{
            padding: 8,
            opacity: canSubmit && !createMut.isPending ? 1 : 0.3,
          }}
        >
          <Check size={22} color={p.accent.mint} />
        </Pressable>
      </View>

      <FlatList
        data={selected != null ? [] : search.data ?? []}
        keyExtractor={(prod) => prod.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 48, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 12 }}>
            {/* Search input — hidden once a product is selected. */}
            {selected == null ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: p.bg.elevated,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: p.line.default,
                }}
              >
                <Search size={16} color={p.ink.dim} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search Booster Boxes, ETBs, Tins…"
                  placeholderTextColor={p.ink.dim}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={{
                    flex: 1,
                    color: p.ink.default,
                    fontSize: 15,
                    padding: 0,
                  }}
                />
                {q.length > 0 ? (
                  <Pressable
                    onPress={() => setQ("")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <X size={16} color={p.ink.dim} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Filter chips — hidden once a product is selected. */}
            {selected == null ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {PRODUCT_TYPE_FILTERS.map((opt) => {
                  const active = filter === opt.key;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => setFilter(opt.key)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? p.accent.mint : p.line.default,
                        backgroundColor: active
                          ? withAlpha(p.accent.mint, 0.15)
                          : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: active ? p.accent.mint : p.ink.muted,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Selected product pill + cost-basis form. */}
            {selected != null ? (
              <View style={{ gap: 12 }}>
                <SelectedProductCard
                  product={selected}
                  onClear={() => setSelected(null)}
                />
                <FormField
                  label="Quantity"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholder="1"
                />
                <FormField
                  label="Purchase price (USD)"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  hint="Per unit. Leave blank if you don't remember."
                />
                <FormField
                  label="Purchase date"
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  hint="Optional. Used for hold-time analytics."
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <SearchResultRow product={item} onSelect={() => setSelected(item)} />
        )}
        ListEmptyComponent={
          selected != null ? null : search.isLoading ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 72, borderRadius: 12 }} />
              ))}
            </View>
          ) : (
            <View style={{ paddingTop: 32, alignItems: "center", gap: 4 }}>
              <Text style={{ color: p.ink.muted, fontSize: 14 }}>
                {q.trim().length > 0
                  ? "No matches. Try a different keyword."
                  : "Search to find sealed products."}
              </Text>
            </View>
          )
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SearchResultRow({
  product,
  onSelect,
}: {
  product: SealedProductWire;
  onSelect: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: p.bg.elevated,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: p.line.default,
      }}
    >
      <CardImage
        uri={product.image_url}
        style={{ width: 40, height: 56, borderRadius: 6 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{ color: p.ink.default, fontSize: 14, fontWeight: "600" }}
        >
          {product.name}
        </Text>
        <Text style={{ color: p.ink.dim, fontSize: 11, marginTop: 2 }}>
          {PRODUCT_LABEL[product.product_type]}
          {product.msrp_usd ? ` · MSRP $${Number(product.msrp_usd).toFixed(2)}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function SelectedProductCard({
  product,
  onClear,
}: {
  product: SealedProductWire;
  onClear: () => void;
}) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        backgroundColor: withAlpha(p.accent.mint, 0.08),
        borderRadius: 12,
        borderWidth: 1,
        borderColor: withAlpha(p.accent.mint, 0.35),
      }}
    >
      <CardImage
        uri={product.image_url}
        style={{ width: 48, height: 64, borderRadius: 6 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}
        >
          {product.name}
        </Text>
        <Text style={{ color: p.accent.mint, fontSize: 11, marginTop: 2, fontWeight: "600" }}>
          {PRODUCT_LABEL[product.product_type]}
        </Text>
      </View>
      <Pressable
        onPress={onClear}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Clear selected product"
        style={{ padding: 6 }}
      >
        <X size={16} color={p.ink.dim} />
      </Pressable>
    </View>
  );
}

function FormField({
  label,
  hint,
  ...input
}: {
  label: string;
  hint?: string;
} & React.ComponentProps<typeof TextInput>) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={p.ink.dim}
        {...input}
        style={[
          {
            backgroundColor: p.bg.elevated,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: p.line.default,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: p.ink.default,
            fontSize: 15,
          },
          input.style,
        ]}
      />
      {hint ? (
        <Text style={{ color: p.ink.dim, fontSize: 11 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
