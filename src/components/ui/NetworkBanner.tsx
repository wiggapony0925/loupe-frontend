/**
 * NetworkBanner — sticky top banner that surfaces offline / back-online
 * state across the app. Rendered once near the root.
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wifi, WifiOff } from "lucide-react-native";
import { useIsOnline } from "@/lib/network";
import { COPY } from "@/lib/copy";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

export function NetworkBanner() {
  const online = useIsOnline();
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);
  const translate = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBackOnline(false);
      Animated.timing(translate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowBackOnline(true);
      Animated.timing(translate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
      const t = setTimeout(() => {
        Animated.timing(translate, {
          toValue: -80,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setShowBackOnline(false));
      }, 1800);
      return () => clearTimeout(t);
    }
    return;
  }, [online, translate]);

  const visible = !online || showBackOnline;
  if (!visible) return null;

  const accent = online ? p.accent.mint : p.accent.amber;
  const Icon = online ? Wifi : WifiOff;
  const copy = online ? COPY.backOnline : COPY.offline;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingTop: insets.top,
        transform: [{ translateY: translate }],
      }}
    >
      <View
        style={{
          marginHorizontal: 12,
          marginTop: 6,
          padding: 10,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: withAlpha(accent, 0.14),
          borderWidth: 1,
          borderColor: withAlpha(accent, 0.45),
        }}
      >
        <Icon size={14} color={accent} />
        <Text style={{ color: accent, fontSize: 12, fontWeight: "700" }}>
          {copy.title}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 11 }} numberOfLines={1}>
          {copy.message}
        </Text>
      </View>
    </Animated.View>
  );
}
