import React, { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Compass, Copy, ExternalLink, X, type LucideIcon } from "lucide-react-native";
import { radius, spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export interface ExternalBrowserTarget {
  title: string;
  subtitle?: string | null;
  url: string;
}

interface ExternalBrowserSheetProps {
  visible: boolean;
  target: ExternalBrowserTarget | null;
  onClose: () => void;
}

export function ExternalBrowserSheet({ visible, target, onClose }: ExternalBrowserSheetProps) {
  const p = useThemedPalette();
  const [copied, setCopied] = useState(false);
  const url = target?.url ?? "";

  useEffect(() => {
    if (visible) setCopied(false);
  }, [visible, target?.url]);

  const openInApp = async () => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      await Linking.openURL(url).catch(() => undefined);
    }
  };

  const openExternal = async () => {
    if (!url) return;
    await Linking.openURL(url).catch(() => undefined);
  };

  const copyUrl = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url).catch(() => undefined);
    setCopied(true);
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
          justifyContent: Platform.OS === "ios" ? "flex-start" : "flex-end",
          backgroundColor: Platform.OS === "ios" ? p.bg.base : "rgba(0,0,0,0.45)",
        }}
      >
        {Platform.OS !== "ios" ? <Pressable style={{ flex: 1 }} onPress={onClose} /> : null}

        <SafeAreaView
          edges={Platform.OS === "ios" ? ["top"] : ["bottom"]}
          style={{
            flex: Platform.OS === "ios" ? 1 : undefined,
            maxHeight: Platform.OS === "ios" ? undefined : "82%",
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl,
            backgroundColor: p.bg.base,
            borderTopLeftRadius: Platform.OS === "ios" ? 0 : radius.xl,
            borderTopRightRadius: Platform.OS === "ios" ? 0 : radius.xl,
          }}
        >
          {Platform.OS !== "ios" ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <View
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: p.line.default,
                }}
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
                Open Marketplace
              </Text>
              <Text
                numberOfLines={2}
                style={{ color: p.ink.default, fontSize: 20, fontWeight: "900", lineHeight: 25 }}
              >
                {target?.title ?? "Marketplace"}
              </Text>
              {target?.subtitle ? (
                <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 12 }}>
                  {target.subtitle}
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

          <View
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              overflow: "hidden",
            }}
          >
            <SheetAction
              icon={Compass}
              title="Open in app"
              subtitle="Use the native browser popup"
              accent={p.accent.mint}
              onPress={openInApp}
            />
            <SheetAction
              icon={ExternalLink}
              title="Open in browser"
              subtitle="Leave Loupe and open the marketplace"
              accent={p.accent.blue}
              onPress={openExternal}
            />
            <SheetAction
              icon={copied ? Check : Copy}
              title={copied ? "Copied" : "Copy link"}
              subtitle={copied ? "Marketplace URL copied" : "Save the URL to your clipboard"}
              accent={copied ? p.accent.mint : p.ink.muted}
              onPress={copyUrl}
              isLast
            />
          </View>

          <View style={{ paddingTop: spacing.md }}>
            <Text numberOfLines={2} style={{ color: p.ink.dim, fontSize: 11, lineHeight: 16 }}>
              {url}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SheetAction({
  icon: Icon,
  title,
  subtitle,
  accent,
  onPress,
  isLast = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 64,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
        backgroundColor: pressed ? withAlpha(p.ink.default, 0.04) : "transparent",
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(accent, 0.13),
        }}
      >
        <Icon size={16} color={accent} strokeWidth={2.35} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 12 }}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
