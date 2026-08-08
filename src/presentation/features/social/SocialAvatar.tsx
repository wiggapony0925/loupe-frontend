/**
 * SocialAvatar — a collector's picture, or a readable stand-in.
 *
 * Most accounts have no uploaded picture, so the fallback is the common case
 * rather than the edge one: a MONOGRAM — the first letter of the collector's
 * name — on NEUTRAL GREY, the way every mainstream social app does it.
 *
 * It used to hash a hue from the handle, which gave a directory of strangers
 * a different saturated colour per row. That reads as decoration, competes
 * with the card art the app is actually about, and makes a list look like a
 * chart. Grey lets the letter — and any real uploaded picture — carry the
 * identity.
 */
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { getApiBaseUrl } from "@/infrastructure/http/client";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/**
 * The backend hands avatar URLs RELATIVE (`/v1/social/avatar/…`) because the
 * web tier proxies /v1 — but React Native's Image needs an absolute URL and
 * fails silently on a bare path, which made every uploaded picture invisible
 * on mobile while "working" everywhere else.
 *
 * Resolved against `getApiBaseUrl()` — the base the HTTP client is actually
 * using — and NOT `config.apiUrl`. Those differ in the case that produced
 * "the photo applies, then reverts to the blank avatar seconds later":
 *
 *   • client.ts hardens its base: env var, else in dev localhost, else a
 *     hardcoded production URL. So API calls work in a release build even
 *     when EXPO_PUBLIC_API_URL wasn't baked in.
 *   • config.apiUrl had no such fallback and became `http://localhost:8000`.
 *
 * So the app worked everywhere except here: the upload succeeded, the screen
 * swapped the local preview for the server URL, that URL pointed at
 * localhost, the load failed, and SocialAvatar fell back to the monogram.
 * getApiBaseUrl() also tracks the runtime sticky-switch to the fallback base.
 */
export function absolutize(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${getApiBaseUrl()}${url}` : url;
}

export interface SocialAvatarProps {
  handle: string;
  /** Display name — its first letter is the monogram (falls back to handle). */
  name?: string | null;
  url?: string | null;
  size?: number;
  /** Mint ring for Pro collectors — the only status marker in a list row. */
  isPro?: boolean;
  /**
   * Called when the picture URL fails to load. A silent fall back to the
   * monogram is right in a list, but on the settings screen it is
   * indistinguishable from "my photo didn't save", so that screen needs to
   * know the difference.
   */
  onLoadFailed?: () => void;
}

export function SocialAvatar({
  handle,
  name,
  url,
  size = 44,
  isPro = false,
  onLoadFailed,
}: SocialAvatarProps) {
  const p = useThemedPalette();
  const [failed, setFailed] = useState(false);
  // Neutral, theme-aware: a quiet surface with the letter in muted ink.
  const tint = p.ink.muted;
  const ring = isPro ? { borderWidth: 2, borderColor: p.accent.mint } : null;
  const resolved = absolutize(url);
  const initial = (name?.trim() || handle).charAt(0).toUpperCase();

  // A failed load must not poison the component forever: when the URL
  // changes (a fresh upload bumps ?v=N), try the image again.
  React.useEffect(() => {
    setFailed(false);
  }, [resolved]);

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
        onError={() => {
          setFailed(true);
          onLoadFailed?.();
        }}
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
          backgroundColor: withAlpha(p.ink.default, 0.11),
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
