import React from "react";
import { FlatList, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Layers, X } from "lucide-react-native";
import {
  useCollectionsOverview,
  type CollectionSummary,
} from "@/application/queries/collection/useCollectionsOverview";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface PortfolioPickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

function money(usd: number): string {
  return `$${Math.round(usd).toLocaleString()}`;
}

/**
 * Bottom-sheet portfolio picker — the sibling of {@link CurrencyPickerSheet}.
 *
 * Lists the synthetic **All** portfolio plus each collection (with its card
 * count + value) from `/v1/collections/overview`. Selecting one sets the active
 * collection; every value surface then re-scopes because the backend does the
 * scoping and the client just passes the id. Uses RN's `Modal` with iOS
 * `pageSheet` presentation (the native `.sheet` look) — same as the currency
 * picker.
 */
export function PortfolioPickerSheet({
  visible,
  onClose,
}: PortfolioPickerSheetProps) {
  const p = useThemedPalette();
  const { collectionId, setCollectionId } = useActiveCollection();
  const { data } = useCollectionsOverview();
  const rows: CollectionSummary[] = data ?? [];

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
          backgroundColor:
            Platform.OS === "ios" ? p.bg.base : "rgba(0,0,0,0.45)",
          justifyContent: Platform.OS === "ios" ? "flex-start" : "flex-end",
        }}
      >
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
                Portfolio
              </Text>
              <Text className="mt-1 text-xl font-bold text-ink">
                Choose a portfolio
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close portfolio picker"
              className="h-9 w-9 items-center justify-center rounded-full border border-line"
              style={{ backgroundColor: p.bg.elevated }}
            >
              <X size={16} color={p.ink.muted} />
            </Pressable>
          </View>

          {/* List */}
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id ?? "all"}
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
            renderItem={({ item }) => {
              const active = (item.id ?? null) === (collectionId ?? null);
              const tint = item.is_all ? p.accent.mint : p.accent.blue;
              const dot = item.color ?? tint;
              return (
                <Pressable
                  onPress={() => {
                    setCollectionId(item.id);
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
                      backgroundColor: withAlpha(dot, 0.16),
                    }}
                  >
                    <Layers size={16} color={dot} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-[15px] font-bold text-ink">
                      {item.name}
                    </Text>
                    <Text className="mt-0.5 text-[12px] text-ink-muted">
                      {item.card_count} {item.card_count === 1 ? "card" : "cards"}
                      {" · "}
                      {money(item.total_value_usd)}
                    </Text>
                  </View>
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
