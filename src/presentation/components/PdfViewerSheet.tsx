/**
 * PdfViewerSheet — an in-app PDF popup (iOS page-sheet modal + WebView).
 *
 * iOS WKWebView renders PDFs natively, including local `file://` documents,
 * so statements stream from the authenticated endpoint into cache and open
 * right here — no Safari bounce, no presigned URL required. A share button
 * hands the same file to the system sheet (Save to Files / AirDrop / print).
 *
 * Android's WebView can't render PDFs; callers should fall back to the
 * share-sheet flow there (see `ReportsSection.onView`).
 */
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Sharing from "expo-sharing";
import { Share2, X } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";

export interface PdfViewerSheetProps {
  visible: boolean;
  /** Local `file://` URI (or https URL) of the PDF to display. */
  uri: string | null;
  title: string;
  onClose: () => void;
}

export function PdfViewerSheet({ visible, uri, title, onClose }: PdfViewerSheetProps) {
  const p = useThemedPalette();

  const onShare = async () => {
    if (!uri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: title,
        });
      }
    } catch {
      /* user dismissed the sheet — nothing to do */
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
        {/* Header — title centered, share + done affordances */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: p.line.default,
            gap: 10,
          }}
        >
          <Pressable
            onPress={onShare}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Share PDF"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <Share2 size={15} color={p.ink.muted} strokeWidth={2.25} />
          </Pressable>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              color: p.ink.default,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <X size={16} color={p.ink.muted} />
          </Pressable>
        </View>

        {uri ? (
          <WebView
            source={{ uri }}
            originWhitelist={["*"]}
            allowFileAccess
            allowingReadAccessToURL={uri}
            style={{ flex: 1, backgroundColor: p.bg.base }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
