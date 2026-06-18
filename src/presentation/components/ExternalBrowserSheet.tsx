import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Check, Compass, Copy, ExternalLink, type LucideIcon } from "lucide-react-native";
import { BottomSheet } from "@/presentation/components/BottomSheet";
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      eyebrow="Open Marketplace"
      title={target?.title ?? "Marketplace"}
      subtitle={target?.subtitle ?? null}
    >
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
    </BottomSheet>
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
