/**
 * CardImage — canonical card art primitive.
 *
 * Wraps `expo-image` with:
 *   • themed shimmer skeleton while loading (suppressed when a blurhash
 *     placeholder is provided; the blurhash IS the skeleton)
 *   • one-shot fallback to a secondary URL on first error
 *   • themed `ImageOff` broken-card fallback when both fail
 *   • memory + disk cache, 250ms cross-fade, normal contentFit
 *   • `priority` pass-through for FlatList virtualization
 *     (off-screen items → "low", visible → "normal", hero → "high")
 *   • optional Sentry breadcrumb at 10% sample on image failure
 */
import React, { useCallback, useState } from "react";
import { Text, View, type DimensionValue, type ViewStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { SkeletonImage } from "@/components/ui/Skeletons";
import { captureMessage } from "@/lib/sentry";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

// 1×1 transparent PNG — keeps expo-image happy when no blurhash is given.
const TINY_TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export interface CardImageProps {
  uri?: string | null;
  fallbackUri?: string | null;
  blurhash?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  /** Card aspect ratio when only `width` is provided (default 0.714 ≈ 5:7). */
  aspectRatio?: number;
  rounded?: number;
  contentFit?: ImageContentFit;
  priority?: "low" | "normal" | "high";
  recyclingKey?: string;
  showSkeleton?: boolean;
  alt?: string;
  style?: ViewStyle;
}

export function CardImage({
  uri,
  fallbackUri,
  blurhash,
  width = "100%",
  height,
  aspectRatio = 0.714,
  rounded = 8,
  contentFit = "cover",
  priority = "normal",
  recyclingKey,
  showSkeleton = true,
  alt,
  style,
}: CardImageProps) {
  const p = useThemedPalette();
  const [activeUri, setActiveUri] = useState<string | null>(uri ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(uri));
  const [errored, setErrored] = useState<boolean>(!uri);
  const [triedFallback, setTriedFallback] = useState<boolean>(false);

  // Reset internal state when caller swaps the URI (e.g., list recycling).
  React.useEffect(() => {
    setActiveUri(uri ?? null);
    setLoading(Boolean(uri));
    setErrored(!uri);
    setTriedFallback(false);
  }, [uri]);

  // Dev-only: surface URLs that take >3s to first-paint so we can see
  // which CDN/variant combos are the offenders without shipping any
  // logging in production.
  React.useEffect(() => {
    if (!__DEV__ || !activeUri || !loading) return;
    const started = Date.now();
    const t = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        `[CardImage] slow load (${Date.now() - started}ms still pending): ${activeUri}`,
      );
    }, 3000);
    return () => clearTimeout(t);
  }, [activeUri, loading]);

  const onLoad = useCallback(() => {
    setLoading(false);
    setErrored(false);
  }, []);

  const onError = useCallback(() => {
    if (!triedFallback && fallbackUri && fallbackUri !== activeUri) {
      setTriedFallback(true);
      setActiveUri(fallbackUri);
      setLoading(true);
      return;
    }
    setLoading(false);
    setErrored(true);
    // 10% sample so we get signal without noise.
    if (Math.random() < 0.1) {
      captureMessage(`card_image_failed: ${uri ?? "(none)"}`, "warning");
    }
  }, [activeUri, fallbackUri, triedFallback, uri]);

  const containerStyle: ViewStyle = {
    width,
    height,
    aspectRatio: height === undefined ? aspectRatio : undefined,
    borderRadius: rounded,
    overflow: "hidden",
    backgroundColor: p.bg.sunken,
    ...style,
  };

  // Hard fallback — no URL or both URLs failed.
  if (errored || !activeUri) {
    return (
      <View style={containerStyle}>
        <BrokenFallback />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {loading && showSkeleton && !blurhash ? (
        <View style={{ position: "absolute", inset: 0 }}>
          <SkeletonImage width="100%" height="100%" radius={rounded} />
        </View>
      ) : null}
      <Image
        source={{ uri: activeUri }}
        placeholder={
          blurhash ? { blurhash } : { uri: TINY_TRANSPARENT_PIXEL }
        }
        placeholderContentFit="cover"
        contentFit={contentFit}
        transition={250}
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={recyclingKey}
        accessibilityLabel={alt}
        onLoad={onLoad}
        onError={onError}
        style={{ width: "100%", height: "100%", backgroundColor: withAlpha(p.bg.sunken, 1) }}
      />
    </View>
  );
}

function BrokenFallback() {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(p.ink.muted, 0.08),
        gap: 6,
        padding: 6,
      }}
    >
      <ImageOff size={20} color={p.ink.dim} strokeWidth={2} />
      <Text
        numberOfLines={1}
        style={{
          color: p.ink.dim,
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        Unavailable
      </Text>
    </View>
  );
}
