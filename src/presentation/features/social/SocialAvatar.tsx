/**
 * SocialAvatar — a collector's picture, or a readable stand-in.
 *
 * Most accounts have no uploaded picture, so the fallback is the common case
 * rather than the edge one: a MONOGRAM — the first letter of the collector's
 * name — on a hue hashed from the handle. The letter makes the row about a
 * person (an anonymous silhouette repeated down a list says nothing); the
 * stable per-handle colour means you learn to spot the same collector
 * without reading.
 */
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { config } from "@/shared/config";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/**
 * The backend hands avatar URLs RELATIVE (`/v1/social/avatar/…`) because the
 * web tier proxies /v1 — but React Native's Image needs an absolute URL and
 * fails silently on a bare path, which made every uploaded picture invisible
 * on mobile while "working" everywhere else. Resolve against the API origin.
 */
function absolutize(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${config.apiUrl}${url}` : url;
}

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
  /** Display name — its first letter is the monogram (falls back to handle). */
  name?: string | null;
  url?: string | null;
  size?: number;
  /** Mint ring for Pro collectors — the only status marker in a list row. */
  isPro?: boolean;
}

export function SocialAvatar({
  handle,
  name,
  url,
  size = 44,
  isPro = false,
}: SocialAvatarProps) {
  const p = useThemedPalette();
  const [failed, setFailed] = useState(false);
  const tint = `hsl(${hueFor(handle)}, 62%, 58%)`;
  const ring = isPro ? { borderWidth: 2, borderColor: p.accent.mint } : null;
  const resolved = absolutize(url);
  const initial = (name?.trim() || handle).charAt(0).toUpperCase();

  if (resolved && !failed) {
    return (
      <Image
        source={{ uri: resolved }}
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
      <Text
        accessibilityElementsHidden
        style={{
          color: tint,
          fontSize: size * 0.42,
          fontWeight: "800",
          // Optical centering — glyph metrics sit a hair low otherwise.
          marginTop: -size * 0.02,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
