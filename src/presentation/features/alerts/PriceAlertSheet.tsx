/**
 * `PriceAlertSheet` — modal for setting a price alert on a card.
 *
 * Lives in a stripped-down RN `Modal` (no bottom-sheet dep in the
 * project yet). User picks above/below + threshold + optional note,
 * we POST `/v1/alerts`. Existing alerts for this card show as
 * deletable chips at the top so the user can see what they already
 * have wired up without leaving the screen.
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import {
  useCreatePriceAlert,
  useDeletePriceAlert,
  usePriceAlerts,
} from "@/application/queries/alerts/usePriceAlerts";
import {
  palette,
  useThemedPalette,
  withAlpha,
} from "@/presentation/theme/tokens";

export interface PriceAlertSheetProps {
  cardId: string;
  cardName?: string | null;
  currentPriceUsd?: number | null;
  visible: boolean;
  onClose: () => void;
}

export function PriceAlertSheet({
  cardId,
  cardName,
  currentPriceUsd,
  visible,
  onClose,
}: PriceAlertSheetProps) {
  const p = useThemedPalette();
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const list = usePriceAlerts({ pending: false });
  const createMut = useCreatePriceAlert();
  const deleteMut = useDeletePriceAlert();

  const myAlerts = useMemo(
    () => (list.data ?? []).filter((a) => a.card_id === cardId),
    [list.data, cardId],
  );

  const thresholdNum = parseFloat(threshold);
  const canSubmit =
    Number.isFinite(thresholdNum) && thresholdNum > 0 && !createMut.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      await createMut.mutateAsync({
        card_id: cardId,
        condition,
        threshold_usd: thresholdNum,
        note: note.trim() || null,
      });
      setThreshold("");
      setNote("");
    } catch {
      // Validation / network errors surface via createMut.error; sheet stays open.
    }
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View style={{ flex: 1 }} />
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: p.bg.elevated,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: p.line.default,
          paddingBottom: 32,
          maxHeight: "85%",
        }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 2 }}>
                Price alert
              </Text>
              <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 18, fontWeight: "700", marginTop: 4 }}>
                {cardName ?? "Card"}
              </Text>
              {currentPriceUsd != null ? (
                <Text style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}>
                  Current ${currentPriceUsd.toFixed(2)}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <X size={20} color={p.ink.muted} />
            </Pressable>
          </View>

          {/* Existing alerts for this card */}
          {list.isLoading ? (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: p.ink.dim,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                }}
              >
                Active
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 92,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: withAlpha(p.ink.dim, 0.12),
                    }}
                  />
                ))}
              </View>
            </View>
          ) : myAlerts.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: p.ink.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>
                Active
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {myAlerts.map((a) => {
                  const fired = Boolean(a.triggered_at);
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => deleteMut.mutate(a.id)}
                      accessibilityLabel={`Remove ${a.condition} ${a.threshold_usd} alert`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: fired
                          ? withAlpha(palette.accent.mint, 0.5)
                          : p.line.default,
                        backgroundColor: fired
                          ? withAlpha(palette.accent.mint, 0.12)
                          : p.bg.base,
                      }}
                    >
                      <Text style={{ color: p.ink.default, fontSize: 12, fontWeight: "600" }}>
                        {a.condition} ${parseFloat(String(a.threshold_usd)).toFixed(2)}
                      </Text>
                      <X size={12} color={p.ink.muted} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Condition toggle */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: p.ink.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>
              When price goes
            </Text>
            <View
              style={{
                flexDirection: "row",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: p.line.default,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {(["above", "below"] as const).map((opt) => {
                const active = condition === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setCondition(opt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      backgroundColor: active ? withAlpha(palette.accent.blue, 0.18) : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? palette.accent.blue : p.ink.muted,
                        fontWeight: active ? "700" : "500",
                        textTransform: "capitalize",
                      }}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Threshold */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: p.ink.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Threshold (USD)
            </Text>
            <TextInput
              value={threshold}
              onChangeText={setThreshold}
              placeholder="0.00"
              placeholderTextColor={p.ink.dim}
              keyboardType="decimal-pad"
              style={{
                paddingHorizontal: 14,
                paddingVertical: 14,
                fontSize: 18,
                color: p.ink.default,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: p.line.default,
                borderRadius: 10,
                backgroundColor: p.bg.base,
              }}
            />
          </View>

          {/* Note */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: p.ink.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Note (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Why this price?"
              placeholderTextColor={p.ink.dim}
              maxLength={280}
              multiline
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: p.ink.default,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: p.line.default,
                borderRadius: 10,
                backgroundColor: p.bg.base,
                minHeight: 64,
                textAlignVertical: "top",
              }}
            />
          </View>

          {createMut.error ? (
            <Text style={{ color: palette.accent.rose, fontSize: 12 }}>
              {createMut.error.message}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            style={{
              marginTop: 4,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: canSubmit ? palette.accent.blue : withAlpha(palette.accent.blue, 0.35),
            }}
          >
            {createMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                Create alert
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
