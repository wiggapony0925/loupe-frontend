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
  /** Allow longer helper copy under the title. Default 1. */
  subtitleLines?: number;
  /** Cap the Android sheet height as a fraction of the screen. Default "82%". */
  maxHeight?: ViewStyle["maxHeight"];
  /** Disable the close control while a mutation is in flight. */
  closeDisabled?: boolean;
  /**
   * Hug content height instead of filling the iOS page sheet.
   * Use for short confirms (remove card) so the sheet isn't mostly empty.
   */
  compact?: boolean;
  children: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  eyebrow,
  title,
  subtitle,
  subtitleLines = 1,
  maxHeight = "82%",
  closeDisabled = false,
  compact = false,
  children,
}: BottomSheetProps) {
  const p = useThemedPalette();
  // Compact confirms always present as a bottom overlay so height hugs content.
  const sheetFromBottom = Platform.OS !== "ios" || compact;

  return (
    <Modal
      visible={visible}
      onRequestClose={closeDisabled ? () => {} : onClose}
      animationType="slide"
      presentationStyle={sheetFromBottom ? "overFullScreen" : "pageSheet"}
      transparent={sheetFromBottom}
    >
      <View
        style={{
          flex: 1,
          justifyContent: sheetFromBottom ? "flex-end" : "flex-start",
          backgroundColor: sheetFromBottom ? "rgba(0,0,0,0.45)" : p.bg.base,
        }}
      >
        {sheetFromBottom ? (
          <Pressable
            style={{ flex: 1 }}
            onPress={closeDisabled ? undefined : onClose}
          />
        ) : null}

        <SafeAreaView
          edges={sheetFromBottom ? ["bottom"] : ["top"]}
          style={{
            flex: sheetFromBottom ? undefined : 1,
            maxHeight: sheetFromBottom ? maxHeight : undefined,
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl,
            backgroundColor: p.bg.base,
            borderTopLeftRadius: sheetFromBottom ? radius.xl : 0,
            borderTopRightRadius: sheetFromBottom ? radius.xl : 0,
          }}
        >
          {sheetFromBottom ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <View
                style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: p.line.default }}
              />
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4, paddingRight: spacing.sm }}>
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
                <Text
                  numberOfLines={subtitleLines}
                  style={{ color: p.ink.muted, fontSize: 13, lineHeight: 18 }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={closeDisabled ? undefined : onClose}
              disabled={closeDisabled}
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
                opacity: closeDisabled ? 0.4 : pressed ? 0.72 : 1,
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
