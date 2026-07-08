import React from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Sparkles } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { IdentifyTcgHint } from "@/infrastructure/repositories/identifyRepository";
import { TCG_OPTIONS } from "./constants";

/**
 * TCG hint picker (bottom sheet). Rides on top of the camera surface via
 * a transparent Modal — iOS gets the native slide + swipe-to-dismiss,
 * Android gets a rounded bottom sheet with a scrim. Shared by both
 * scanner surfaces so "what am I scanning?" behaves identically.
 */
export function TcgPickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
  themed,
}: {
  visible: boolean;
  selected: IdentifyTcgHint;
  onSelect: (t: IdentifyTcgHint) => void;
  onClose: () => void;
  themed: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss picker"
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
      >
        {/* Stop propagation: tapping inside the sheet shouldn't dismiss. */}
        <Pressable onPress={() => {}}>
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: themed.bg.elevated,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 10,
              paddingBottom: Platform.OS === "ios" ? 8 : 16,
              borderTopWidth: 1,
              borderColor: themed.line.default,
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", paddingBottom: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: withAlpha(themed.ink.default, 0.22),
                }}
              />
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
              <Text
                style={{
                  color: themed.ink.dim,
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                }}
              >
                Game
              </Text>
              <Text
                style={{
                  color: themed.ink.default,
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 4,
                }}
              >
                Identify cards from
              </Text>
            </View>

            <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
              {TCG_OPTIONS.map((o) => {
                const active = o.key === selected;
                const optionColor = themed.accent[o.accent];
                return (
                  <Pressable
                    key={String(o.key)}
                    onPress={() => onSelect(o.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      marginVertical: 2,
                      borderRadius: 14,
                      backgroundColor: active
                        ? withAlpha(optionColor, 0.14)
                        : pressed
                          ? withAlpha(themed.ink.default, 0.05)
                          : "transparent",
                      borderWidth: 1,
                      borderColor: active
                        ? withAlpha(optionColor, 0.4)
                        : themed.line.default,
                    })}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active
                          ? optionColor
                          : withAlpha(themed.ink.default, 0.08),
                      }}
                    >
                      {active ? (
                        <Check size={16} color="#0B0B0D" strokeWidth={3} />
                      ) : (
                        <Sparkles size={14} color={withAlpha(themed.ink.default, 0.55)} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: themed.ink.default,
                          fontSize: 15,
                          fontWeight: active ? "700" : "600",
                        }}
                      >
                        {o.label}
                      </Text>
                      {o.key === null ? (
                        <Text
                          style={{
                            color: themed.ink.muted,
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          Let Loupe decide from the frame
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
