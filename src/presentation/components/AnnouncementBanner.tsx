import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { X } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import {
  useAnnouncement,
  type AnnouncementTone,
} from "@/application/queries/ops/useAnnouncement";

/** Remembers the last message the user dismissed, so it only reappears when
 *  the dashboard message itself changes (mirrors the web behaviour). */
const DISMISS_KEY = "loupe.announcement.dismissed.v1";

function toneStyle(
  tone: AnnouncementTone,
  p: ReturnType<typeof useThemedPalette>,
): { bg: string; fg: string } {
  switch (tone) {
    case "success":
      return { bg: p.accent.mint, fg: "#06140D" };
    case "warning":
      return { bg: p.accent.amber, fg: "#1A1300" };
    case "error":
      return { bg: p.accent.rose, fg: "#FFFFFF" };
    default:
      return { bg: p.accent.blue, fg: "#FFFFFF" };
  }
}

/**
 * Global announcement banner — the dev-dashboard announcement, shown in-app
 * using the same sticky top-banner treatment as the offline `NetworkBanner`.
 * Tone-coloured, tappable CTA (opens the link), and dismissible per-message.
 */
export function AnnouncementBanner() {
  const insets = useSafeAreaInsets();
  const p = useThemedPalette();
  const { data } = useAnnouncement();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  // Load the last-dismissed message once.
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => setDismissed(v))
      .catch(() => {});
  }, []);

  const message = data?.message?.trim() ?? "";
  const active = Boolean(data?.enabled) && message.length > 0 && message !== dismissed;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);

  if (!active || !data) return null;

  const { bg, fg } = toneStyle(data.tone, p);

  const dismiss = () => {
    AsyncStorage.setItem(DISMISS_KEY, message).catch(() => {});
    setDismissed(message);
  };
  const openCta = () => {
    if (data.cta_href) Linking.openURL(data.cta_href).catch(() => {});
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, backgroundColor: bg, paddingTop: insets.top + 6 },
      ]}
    >
      <View style={styles.row}>
        <Text style={[styles.message, { color: fg }]} numberOfLines={2}>
          {message}
        </Text>
        {data.cta_label && data.cta_href ? (
          <Pressable
            onPress={openCta}
            hitSlop={8}
            style={({ pressed }) => [
              styles.cta,
              { borderColor: fg, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: fg }]} numberOfLines={1}>
              {data.cta_label}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss announcement"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <X size={16} color={fg} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  cta: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
