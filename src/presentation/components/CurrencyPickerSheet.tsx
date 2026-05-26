import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Search, X } from "lucide-react-native";
import { CURRENCIES, type CurrencyMeta } from "@/shared/currency";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface CurrencyPickerSheetProps {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

/**
 * Bottom sheet currency picker.
 *
 * Uses React Native's built-in `Modal` with `presentationStyle="pageSheet"`
 * on iOS — this maps to UIKit's `UIModalPresentationPageSheet`, the same
 * native SwiftUI `.sheet` modifier presentation (with the grabber, swipe-
 * down dismissal, and the half-screen detent on iPhone). On Android the
 * Modal slides up over the screen with a translucent scrim.
 */
export function CurrencyPickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: CurrencyPickerSheetProps) {
  const p = useThemedPalette();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    );
  }, [query]);

  const sections = useMemo(() => {
    const fiat = filtered.filter((c) => c.kind === "fiat");
    const crypto = filtered.filter((c) => c.kind === "crypto");
    type Row = { type: "header"; title: string } | { type: "row"; item: CurrencyMeta };
    const rows: Row[] = [];
    if (fiat.length) {
      rows.push({ type: "header", title: "Fiat" });
      fiat.forEach((item) => rows.push({ type: "row", item }));
    }
    if (crypto.length) {
      rows.push({ type: "header", title: "Crypto" });
      crypto.forEach((item) => rows.push({ type: "row", item }));
    }
    return rows;
  }, [filtered]);

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
      transparent={Platform.OS !== "ios"}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: Platform.OS === "ios" ? p.bg.base : "rgba(0,0,0,0.45)",
          justifyContent: Platform.OS === "ios" ? "flex-start" : "flex-end",
        }}
      >
        {/* Android scrim tap-to-dismiss */}
        {Platform.OS !== "ios" ? (
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        ) : null}

        <SafeAreaView
          edges={Platform.OS === "ios" ? ["top"] : ["bottom"]}
          style={{
            backgroundColor: p.bg.base,
            borderTopLeftRadius: Platform.OS === "ios" ? 0 : 24,
            borderTopRightRadius: Platform.OS === "ios" ? 0 : 24,
            maxHeight: Platform.OS === "ios" ? undefined : "85%",
            flex: Platform.OS === "ios" ? 1 : undefined,
          }}
        >
          {/* Drag handle (Android only — iOS pageSheet provides its own) */}
          {Platform.OS !== "ios" ? (
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: p.line.default,
                }}
              />
            </View>
          ) : null}

          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5"
            style={{ paddingTop: 16, paddingBottom: 8 }}
          >
            <View>
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Display currency
              </Text>
              <Text className="mt-1 text-xl font-bold text-ink">
                Choose your currency
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full border border-line"
              style={{ backgroundColor: p.bg.elevated }}
            >
              <X size={16} color={p.ink.muted} />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-5 pb-3 pt-2">
            <View
              className="flex-row items-center gap-2.5 rounded-2xl border border-line px-3"
              style={{ backgroundColor: p.bg.elevated, height: 44 }}
            >
              <Search size={16} color={p.ink.muted} strokeWidth={2.4} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search 20+ currencies"
                placeholderTextColor={p.ink.dim}
                style={{ flex: 1, color: p.ink.default, fontSize: 14 }}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={14} color={p.ink.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* List */}
          <FlatList
            data={sections}
            keyExtractor={(row, i) =>
              row.type === "header" ? `h-${row.title}-${i}` : `r-${row.item.code}`
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item: row }) => {
              if (row.type === "header") {
                return (
                  <Text className="mt-3 px-5 pb-2 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    {row.title}
                  </Text>
                );
              }
              const c = row.item;
              const active = c.code === selected;
              const tint = c.kind === "crypto" ? p.accent.amber : p.accent.mint;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(c.code);
                    onClose();
                  }}
                  className="mx-3 mb-1.5 flex-row items-center gap-3 rounded-2xl px-3 py-3"
                  style={({ pressed }) => ({
                    backgroundColor: active
                      ? withAlpha(tint, 0.12)
                      : pressed
                        ? p.bg.elevated
                        : "transparent",
                    borderWidth: 1,
                    borderColor: active ? withAlpha(tint, 0.35) : "transparent",
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: withAlpha(tint, 0.14),
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{c.flag}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[15px] font-bold text-ink">
                        {c.code}
                      </Text>
                      <Text className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: c.kind === "crypto" ? p.accent.amber : p.ink.dim }}
                      >
                        {c.kind === "crypto" ? "CRYPTO" : c.symbol}
                      </Text>
                    </View>
                    <Text numberOfLines={1} className="mt-0.5 text-[12px] text-ink-muted">
                      {c.name}
                    </Text>
                  </View>
                  <Text className="text-[11px] font-medium text-ink-dim">
                    {c.kind === "crypto"
                      ? `1 USD ≈ ${c.ratePerUsd.toFixed(c.decimals)}`
                      : `1 USD = ${c.ratePerUsd.toFixed(2)}`}
                  </Text>
                  {active ? (
                    <Check size={18} color={tint} strokeWidth={2.6} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
