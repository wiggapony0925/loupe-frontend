/**
 * CardImage — canonical card art primitive.
 *
 * Wraps `expo-image` with:
 *   • themed shimmer skeleton while loading (suppressed when a blurhash
 *     placeholder is provided; the blurhash IS the skeleton)
 *   • per-URL automatic retry with ~600ms backoff before giving up
 *     (most "image failed" events in the wild are transient — NSURLSession
 *     flake, a momentary 5xx from pokemontcg.io / scryfall, a brief Wi-Fi
 *     hiccup — and disappear on a single retry)
 *   • one-shot fallback to a secondary URL on persistent error OR on
 *     timeout (expo-image on iOS can hang indefinitely on slow third-party
 *     CDNs; a hard client-side timeout converts the hang into a real
 *     onError so the retry / fallback / broken-state branches actually run)
 *   • themed `ImageOff` broken-card fallback only after BOTH urls have
 *     each been retried once
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

// One automatic retry per URL before swapping to the fallback or showing
// the broken state. Most "image failed" events are transient (NSURLSession
// flake, a momentary 5xx, a brief Wi-Fi blip); a single retry recovers
// them silently. Kept short so the user never sees a perceptible delay.
const RETRY_BACKOFF_MS = 600;

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
  // Bumped on retry to force expo-image to re-attempt the same URL
  // (it otherwise treats an unchanged source as already-loaded and
  // won't refire onLoad/onError).
  const [retryNonce, setRetryNonce] = useState<number>(0);
  // Track which URL has already burned its one retry, so we don't loop.
  const retriedUrlRef = React.useRef<string | null>(null);
  const loadedRef = React.useRef<boolean>(false);

  // Reset internal state when caller swaps the URI (e.g., list recycling).
  React.useEffect(() => {
    setActiveUri(uri ?? null);
    setLoading(Boolean(uri));
    setErrored(!uri);
    setTriedFallback(false);
    setRetryNonce(0);
    retriedUrlRef.current = null;
    loadedRef.current = false;
  }, [uri]);

  const onLoad = useCallback(() => {
    loadedRef.current = true;
    setLoading(false);
    setErrored(false);
  }, []);

  const onError = useCallback(() => {
    // 1) First failure on this URL → schedule a single retry. Most
    //    image errors are transient (CDN blip, NSURLSession flake) and
    //    recover silently on the next attempt.
    if (activeUri && retriedUrlRef.current !== activeUri) {
      retriedUrlRef.current = activeUri;
      setTimeout(() => {
        if (loadedRef.current) return;
        setLoading(true);
        setRetryNonce((n) => n + 1);
      }, RETRY_BACKOFF_MS);
      return;
    }
    // 2) Retry also failed → swap to the fallback URL (if any) and
    //    let it have its own one retry.
    if (!triedFallback && fallbackUri && fallbackUri !== activeUri) {
      setTriedFallback(true);
      setActiveUri(fallbackUri);
      retriedUrlRef.current = null;
      setLoading(true);
      loadedRef.current = false;
      return;
    }
    // 3) Both URLs exhausted → broken state.
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
        <BrokenFallback alt={alt} />
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
        // Include the retry nonce so a re-attempt on the same URL
        // forces expo-image to refire load/error (otherwise it short-
        // circuits as "same source, already errored").
        recyclingKey={
          recyclingKey
            ? `${recyclingKey}:${retryNonce}`
            : `${activeUri}:${retryNonce}`
        }
        accessibilityLabel={alt}
        onLoad={onLoad}
        onError={onError}
        style={{ width: "100%", height: "100%", backgroundColor: withAlpha(p.bg.sunken, 1) }}
      />
    </View>
  );
}

function BrokenFallback({ alt }: { alt?: string }) {
  const p = useThemedPalette();
  // Prefer the card name (alt) as the empty-state label so a missing
  // image still tells the user *which* card they're looking at. Falls
  // back to a generic "Unavailable" badge only when no alt is supplied
  // (e.g. set logos, anonymous thumbnails).
  const label = (alt ?? "").trim();
  const hasName = label.length > 0;
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(p.ink.muted, 0.08),
        gap: 8,
        padding: 8,
      }}
    >
      <ImageOff size={hasName ? 16 : 20} color={p.ink.dim} strokeWidth={2} />
      {hasName ? (
        <Text
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            color: p.ink.muted,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.2,
            textAlign: "center",
            lineHeight: 14,
          }}
        >
          {label}
        </Text>
      ) : (
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
      )}
    </View>
  );
}
