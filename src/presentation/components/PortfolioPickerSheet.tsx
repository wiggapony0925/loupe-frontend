import React, { useState } from "react";
import { FlatList, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Layers, Pencil, Plus, Trash2, X } from "lucide-react-native";
import {
  useCollectionsOverview,
  type CollectionSummary,
} from "@/application/queries/collection/useCollectionsOverview";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import {
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from "@/application/queries/collection/useCollectionMutations";
import { CollectionPromptModal, type PromptMode } from "./CollectionPromptModal";

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

  const [isManaging, setIsManaging] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode | null>(null);
  const [promptCollection, setPromptCollection] = useState<CollectionSummary | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);

  const createCol = useCreateCollection();
  const updateCol = useUpdateCollection();
  const deleteCol = useDeleteCollection();

  const handlePromptSubmit = async (value: string) => {
    setPromptBusy(true);
    setPromptError(null);
    try {
      if (promptMode === "create") {
        await createCol.mutateAsync({ name: value });
      } else if (promptMode === "rename" && promptCollection?.id) {
        await updateCol.mutateAsync({ id: promptCollection.id, payload: { name: value } });
      } else if (promptMode === "delete" && promptCollection?.id) {
        await deleteCol.mutateAsync(promptCollection.id);
        if (collectionId === promptCollection.id) {
          setCollectionId(null);
        }
      }
      setPromptMode(null);
      setPromptCollection(null);
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPromptBusy(false);
    }
  };

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                onPress={() => setIsManaging(!isManaging)}
                hitSlop={10}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: isManaging ? p.ink.default : p.bg.elevated,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: isManaging ? p.bg.base : p.ink.default, fontWeight: "600", fontSize: 13 }}>
                  {isManaging ? "Done" : "Manage"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsManaging(false);
                  onClose();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close portfolio picker"
                className="h-9 w-9 items-center justify-center rounded-full border border-line"
                style={{ backgroundColor: p.bg.elevated }}
              >
                <X size={16} color={p.ink.muted} />
              </Pressable>
            </View>
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
                    if (isManaging) return;
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
                  
                  {isManaging ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {item.deletable ? (
                        <Pressable
                          onPress={() => {
                            setPromptError(null);
                            setPromptCollection(item);
                            setPromptMode("delete");
                          }}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
                        >
                          <Trash2 size={18} color={p.accent.rose} />
                        </Pressable>
                      ) : null}
                      {item.id ? (
                        <Pressable
                          onPress={() => {
                            setPromptError(null);
                            setPromptCollection(item);
                            setPromptMode("rename");
                          }}
                          hitSlop={8}
                          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
                        >
                          <Pencil size={18} color={p.ink.muted} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : active ? (
                    <Check size={18} color={tint} strokeWidth={2.6} />
                  ) : null}
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable
                onPress={() => {
                  setPromptError(null);
                  setPromptCollection(null);
                  setPromptMode("create");
                }}
                className="mx-3 mt-4 flex-row items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-3"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? p.bg.elevated : "transparent",
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: p.bg.elevated,
                  }}
                >
                  <Plus size={16} color={p.ink.default} strokeWidth={2.4} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: p.ink.default }}>
                  New Collection
                </Text>
              </Pressable>
            }
          />
        </SafeAreaView>
      </View>
      
      <CollectionPromptModal
        visible={promptMode !== null}
        mode={promptMode}
        subjectName={promptCollection?.name}
        busy={promptBusy}
        error={promptError}
        onClose={() => {
          if (promptBusy) return;
          setPromptMode(null);
          setPromptError(null);
        }}
        onSubmit={handlePromptSubmit}
      />
    </Modal>
  );
}
