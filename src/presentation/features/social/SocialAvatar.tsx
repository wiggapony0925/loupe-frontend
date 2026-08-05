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
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { UserRound } from "lucide-react-native";
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
  const tint = `hsl(${hueFor(handle)}, 62%, 58%)`;
  const ring = isPro ? { borderWidth: 2, borderColor: p.accent.mint } : null;
  const resolved = absolutize(url);

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
      {/* Person glyph, the convention every social app trained users on —
          an initial reads as "logo", a silhouette reads as "no photo yet".
          The per-handle hue stays so rows remain tellable-apart at a glance. */}
      <UserRound
        size={size * 0.52}
        color={tint}
        strokeWidth={2.2}
        accessibilityElementsHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
