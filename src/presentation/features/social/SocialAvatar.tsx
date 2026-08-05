/**
 * SocialAvatar — a collector's picture, or a readable stand-in.
 *
 * Most accounts have no uploaded picture, so the fallback is the common case
 * rather than the edge one. A generic grey silhouette repeated down a list
 * makes every row look identical; a monogram tinted by a hash of the handle
 * gives each collector a stable, recognisable colour — you learn to spot the
 * same person in a list without reading.
 */
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Stable per-handle hue. Same handle → same colour, on every device. */
function hueFor(handle: string): number {
  let h = 0;
  for (let i = 0; i < handle.length; i += 1) {
    h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export interface SocialAvatarProps {
  handle: string;
  url?: string | null;
  size?: number;
  /** Mint ring for Pro collectors — the only status marker in a list row. */
  isPro?: boolean;
}

export function SocialAvatar({
  handle,
  url,
  size = 44,
  isPro = false,
}: SocialAvatarProps) {
  const p = useThemedPalette();
  const [failed, setFailed] = useState(false);
  const initial = (handle || "?").trim().charAt(0).toUpperCase();
  const tint = `hsl(${hueFor(handle)}, 62%, 58%)`;
  const ring = isPro ? { borderWidth: 2, borderColor: p.accent.mint } : null;

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          ring,
        ]}
        contentFit="cover"
        transition={120}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(tint, 0.22),
        },
        ring,
      ]}
    >
      <Text style={[styles.initial, { color: tint, fontSize: size * 0.4 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { fontWeight: "700" },
});
