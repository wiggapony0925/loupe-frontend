/**
 * BottomSheet — the one modal-sheet primitive.
 *
 * Centralizes the chrome every sheet in the app repeated by hand: the
 * platform-correct `Modal` presentation (iOS pageSheet / Android bottom
 * overlay), the dimmed tap-to-dismiss backdrop, the drag handle, the
 * safe-area insets, and the header (eyebrow + title + optional subtitle +
 * close button). Feature sheets (ExternalBrowserSheet, PriceAlertSheet)
 * supply only their body via `children`.
 *
 * Theme-token driven via `useThemedPalette`, so it tracks Light/Dark.
 */

import React from "react";
import { Modal, Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { radius, spacing, useThemedPalette } from "@/presentation/theme/tokens";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Small uppercase eyebrow above the title (e.g. "Open Marketplace"). */
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  /** Cap the Android sheet height as a fraction of the screen. Default "82%". */
  maxHeight?: ViewStyle["maxHeight"];
  children: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  eyebrow,
  title,
  subtitle,
  maxHeight = "82%",
  children,
}: BottomSheetProps) {
  const p = useThemedPalette();
  const isIOS = Platform.OS === "ios";

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={isIOS ? "pageSheet" : "overFullScreen"}
      transparent={!isIOS}
    >
      <View
        style={{
          flex: 1,
          justifyContent: isIOS ? "flex-start" : "flex-end",
          backgroundColor: isIOS ? p.bg.base : "rgba(0,0,0,0.45)",
        }}
      >
        {!isIOS ? <Pressable style={{ flex: 1 }} onPress={onClose} /> : null}

        <SafeAreaView
          edges={isIOS ? ["top"] : ["bottom"]}
          style={{
            flex: isIOS ? 1 : undefined,
            maxHeight: isIOS ? undefined : maxHeight,
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl,
            backgroundColor: p.bg.base,
            borderTopLeftRadius: isIOS ? 0 : radius.xl,
            borderTopRightRadius: isIOS ? 0 : radius.xl,
          }}
        >
          {!isIOS ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <View
                style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: p.line.default }}
              />
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              {eyebrow ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: p.ink.dim,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 2.4,
                    textTransform: "uppercase",
                  }}
                >
                  {eyebrow}
                </Text>
              ) : null}
              <Text
                numberOfLines={2}
                style={{ color: p.ink.default, fontSize: 20, fontWeight: "900", lineHeight: 25 }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 12 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: p.line.default,
                backgroundColor: p.bg.elevated,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <X size={16} color={p.ink.muted} strokeWidth={2.4} />
            </Pressable>
          </View>

          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
