import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Check, Compass, Copy, ExternalLink } from "lucide-react-native";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import {
  SheetChoiceGroup,
  SheetChoiceRow,
} from "@/presentation/components/SheetChoice";
import { spacing, useThemedPalette } from "@/presentation/theme/tokens";

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
      <SheetChoiceGroup>
        <SheetChoiceRow
          icon={Compass}
          title="Open in app"
          subtitle="Use the native browser popup"
          accent={p.accent.mint}
          onPress={openInApp}
        />
        <SheetChoiceRow
          icon={ExternalLink}
          title="Open in browser"
          subtitle="Leave Loupe and open the marketplace"
          accent={p.accent.blue}
          onPress={openExternal}
        />
        <SheetChoiceRow
          icon={copied ? Check : Copy}
          title={copied ? "Copied" : "Copy link"}
          subtitle={copied ? "Marketplace URL copied" : "Save the URL to your clipboard"}
          accent={copied ? p.accent.mint : p.ink.muted}
          onPress={copyUrl}
          isLast
        />
      </SheetChoiceGroup>

      <View style={{ paddingTop: spacing.md }}>
        <Text numberOfLines={2} style={{ color: p.ink.dim, fontSize: 11, lineHeight: 16 }}>
          {url}
        </Text>
      </View>
    </BottomSheet>
  );
}
