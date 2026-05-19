/**
 * CardImage — canonical card art primitive.
 *
 * Wraps `expo-image` with:
 *   • themed shimmer skeleton while loading (suppressed when a blurhash
 *     placeholder is provided; the blurhash IS the skeleton)
 *   • one-shot fallback to a secondary URL on first error OR on timeout
 *     (expo-image on iOS can hang indefinitely on slow third-party CDNs;
 *     a hard client-side timeout converts the hang into a real onError
 *     so the fallback URL / broken-state branch actually runs)
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
import { SkeletonImage } from "@/presentation/components/Skeletons";
import { captureMessage } from "@/infrastructure/observability/sentry";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

// 1×1 transparent PNG — keeps expo-image happy when no blurhash is given.
const TINY_TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

// Hard ceiling on how long we'll wait for a single URL to first-paint
// before treating it as failed and trying the fallback. Tuned to be
// generous enough for cold-cache 3G but tight enough that a hung
// NSURLSession request doesn't sit on screen as a skeleton forever.
const DEFAULT_LOAD_TIMEOUT_MS = 12_000;

// Dev-only: dedupe slow-load warnings so a single hot URL (e.g. the
// trending Charizard rendered in 6 different rails) only emits once
// per session per URL. Keeps the Metro console readable.
const __slowWarnedUrls = new Set<string>();

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
  /** Hard timeout (ms) before treating a hung load as an error. */
  loadTimeoutMs?: number;
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
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
}: CardImageProps) {
  const p = useThemedPalette();
  const [activeUri, setActiveUri] = useState<string | null>(uri ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(uri));
  const [errored, setErrored] = useState<boolean>(!uri);
  const [triedFallback, setTriedFallback] = useState<boolean>(false);
  const loadedRef = React.useRef<boolean>(false);

  // Reset internal state when caller swaps the URI (e.g., list recycling).
  React.useEffect(() => {
    setActiveUri(uri ?? null);
    setLoading(Boolean(uri));
    setErrored(!uri);
    setTriedFallback(false);
    loadedRef.current = false;
  }, [uri]);

  const onLoad = useCallback(() => {
    loadedRef.current = true;
    setLoading(false);
    setErrored(false);
  }, []);

  const onError = useCallback(() => {
    if (!triedFallback && fallbackUri && fallbackUri !== activeUri) {
      setTriedFallback(true);
      setActiveUri(fallbackUri);
      setLoading(true);
      loadedRef.current = false;
      return;
    }
    setLoading(false);
    setErrored(true);
    // 10% sample so we get signal without noise.
    if (Math.random() < 0.1) {
      captureMessage(`card_image_failed: ${uri ?? "(none)"}`, "warning");
    }
  }, [activeUri, fallbackUri, triedFallback, uri]);

  // Hard timeout: expo-image on iOS does not enforce a per-request
  // ceiling — slow third-party CDNs (pokemontcg.io, ygoprodeck.com)
  // can leave a request "pending" indefinitely with no onError ever
  // firing. We surface that as a real error so the fallback URL /
  // broken-state UI actually renders instead of an eternal skeleton.
  React.useEffect(() => {
    if (!activeUri || !loading || loadTimeoutMs <= 0) return;
    const t = setTimeout(() => {
      if (loadedRef.current) return;
      if (__DEV__ && !__slowWarnedUrls.has(activeUri)) {
        __slowWarnedUrls.add(activeUri);
        // eslint-disable-next-line no-console
        console.warn(
          `[CardImage] load exceeded ${loadTimeoutMs}ms, treating as error: ${activeUri}`,
        );
      }
      onError();
    }, loadTimeoutMs);
    return () => clearTimeout(t);
  }, [activeUri, loading, loadTimeoutMs, onError]);

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
