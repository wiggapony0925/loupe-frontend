/**
 * Card image URL helpers.
 *
 * Centralizes the (sometimes messy) job of picking the right image URL
 * out of a `CardSearchResult` / `Card` wire object across the three
 * upstream catalogs (Pokémon TCG, Scryfall, YGOPRODeck). Each provider
 * exposes a different shape; the backend normalizes them onto the
 * `images: { small, normal, large, art_crop }` block but the legacy
 * flat `image_url` is still emitted as a fallback.
 *
 * Variants:
 *   - thumb / small  → small (list rows, grid tiles)
 *   - normal         → normal (default)
 *   - large / hero   → large → normal → art_crop (card detail)
 */
import { Image } from "expo-image";
import type { CardSearchResult, ImageSet } from "@/infrastructure/http";
import { getApiBaseUrl } from "@/infrastructure/http/client";

export type ImageVariant = "thumb" | "small" | "normal" | "large" | "hero";

type CardLike = Pick<CardSearchResult, "image_url" | "images" | "attributes">;

// ---------------------------------------------------------------------------
// Backend image proxy
// ---------------------------------------------------------------------------
// When EXPO_PUBLIC_IMAGE_PROXY=1 (or "true"), every upstream card image
// URL is routed through our backend's /v1/img endpoint. The backend has
// a stable network path to the upstream CDNs (pokemontcg.io, scryfall,
// ygoprodeck) and serves bytes with `Cache-Control: immutable, 30d` so
// expo-image's disk cache holds them forever. This eliminates the
// flaky-third-party-CDN class of image failures on cellular networks.
//
// Off by default so a misconfigured backend doesn't break image loading;
// turn it on after verifying the proxy is healthy in your environment.
const env = (process.env ?? {}) as Record<string, string | undefined>;
const IMAGE_PROXY_ENABLED =
  env.EXPO_PUBLIC_IMAGE_PROXY === "1" ||
  env.EXPO_PUBLIC_IMAGE_PROXY === "true";

// Upstream hosts the backend's /v1/img is willing to proxy. Keeping this
// list aligned with the backend allowlist means we never bother rewriting
// URLs the backend would reject — we just pass them through unchanged.
const PROXIED_HOSTS = new Set<string>([
  "images.pokemontcg.io",
  "assets.pokemontcg.io",
  "cards.scryfall.io",
  "c1.scryfall.com",
  "c2.scryfall.com",
  "images.ygoprodeck.com",
  "storage.googleapis.com",
  "tcgplayer-cdn.tcgplayer.com",
  "product-images.tcgplayer.com",
]);

function maybeProxy(url: string | undefined): string | undefined {
  if (!url || !IMAGE_PROXY_ENABLED) return url;
  // Already proxied (defensive — avoid double-wrapping).
  if (url.includes("/v1/img?")) return url;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
  if (!PROXIED_HOSTS.has(host)) return url;
  const base = getApiBaseUrl().replace(/\/+$/, "");
  return `${base}/v1/img?u=${encodeURIComponent(url)}`;
}

function pickFromSet(
  images: ImageSet | null | undefined,
  variant: ImageVariant,
): string | undefined {
  if (!images) return undefined;
  const small = images.small?.url;
  const normal = images.normal?.url;
  const large = images.large?.url;
  const art = images.art_crop?.url;
  switch (variant) {
    case "thumb":
    case "small":
      return small ?? normal ?? large ?? art ?? undefined;
    case "normal":
      return normal ?? large ?? small ?? art ?? undefined;
    case "large":
    case "hero":
      return large ?? normal ?? art ?? small ?? undefined;
  }
}

export function pickCardImageUrl(
  card: CardLike | null | undefined,
  variant: ImageVariant = "normal",
): string | undefined {
  if (!card) return undefined;
  const fromSet = pickFromSet(card.images, variant);
  return maybeProxy(fromSet ?? card.image_url ?? undefined);
}

/**
 * Optional blurhash for the card. Most providers don't expose one,
 * so we read `attributes.blurhash` if the backend ever attaches it
 * and otherwise return undefined.
 */
export function pickCardBlurhash(
  card: CardLike | null | undefined,
): string | undefined {
  const attrs = card?.attributes;
  if (!attrs || typeof attrs !== "object") return undefined;
  const v = (attrs as Record<string, unknown>).blurhash;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Warm the disk cache for a batch of cards. Fire-and-forget: callers
 * (list query hooks) should invoke this when results arrive so that
 * when tiles mount, expo-image hits the cache instead of doing a cold
 * round-trip to slow third-party CDNs (pokemontcg.io, ygoprodeck.com).
 *
 * Default variant is `small` because that's what every grid/row uses;
 * the detail screen prefetches `large` separately on navigate.
 */
export function prefetchCardImages(
  cards: readonly (CardLike | null | undefined)[],
  variant: ImageVariant = "small",
): void {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const u = pickCardImageUrl(c, variant);
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  if (urls.length === 0) return;
  // expo-image returns a promise we don't need to await; failures are
  // silent and surface later via the normal onError path.
  void Image.prefetch(urls, "memory-disk");
}
