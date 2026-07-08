import React from "react";
import { type DimensionValue } from "react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { pickCardImageUrl, type ImageVariant } from "@/shared/cardImage";
import type { IdentifyCandidate } from "@/infrastructure/repositories/identifyRepository";

/**
 * Stable identity for a candidate, used to de-dupe the batch stack so
 * scanning the same card twice doesn't queue it twice. Falls back to
 * name+number when neither catalog id is resolved yet.
 */
export function candidateKey(c: IdentifyCandidate): string {
  return (
    c.card_id ??
    c.upstream_id ??
    `${c.name.toLowerCase()}|${c.number ?? ""}`
  );
}

function upstreamProvider(candidate: IdentifyCandidate): string {
  const upstream = candidate.upstream_id ?? "";
  const colon = upstream.indexOf(":");
  if (colon > 0) return upstream.slice(0, colon).toLowerCase();
  return (candidate.tcg ?? "").toLowerCase();
}

function upstreamCardId(candidate: IdentifyCandidate): string | null {
  const upstream = candidate.upstream_id?.trim();
  if (!upstream) return null;
  const colon = upstream.indexOf(":");
  return colon >= 0 ? upstream.slice(colon + 1) : upstream;
}

function pokemonImageUrl(id: string, hires = false): string | undefined {
  const dash = id.indexOf("-");
  if (dash <= 0 || dash >= id.length - 1) return undefined;
  const setCode = id.slice(0, dash);
  const cardNumber = id.slice(dash + 1);
  const suffix = hires ? "_hires" : "";
  return `https://images.pokemontcg.io/${encodeURIComponent(setCode)}/${encodeURIComponent(cardNumber)}${suffix}.png`;
}

function derivedCandidateImageUrl(
  candidate: IdentifyCandidate,
  variant: ImageVariant,
  fallback = false,
): string | undefined {
  const provider = upstreamProvider(candidate);
  const id = upstreamCardId(candidate);
  if (!id) return undefined;

  if (provider.includes("pokemon") || provider.includes("pokemontcg")) {
    const preferHires = variant === "hero" || variant === "large" || variant === "normal";
    return pokemonImageUrl(id, fallback ? !preferHires : preferHires);
  }

  if (provider.includes("yugioh") || provider.includes("ygopro")) {
    return fallback
      ? `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(id)}.jpg`
      : `https://images.ygoprodeck.com/images/cards/${encodeURIComponent(id)}.jpg`;
  }

  if (provider.includes("magic") || provider.includes("scryfall")) {
    const version = variant === "thumb" || variant === "small" ? "small" : "normal";
    const fallbackVersion = version === "small" ? "normal" : "small";
    return `https://api.scryfall.com/cards/${encodeURIComponent(id)}?format=image&version=${fallback ? fallbackVersion : version}`;
  }

  return undefined;
}

function candidateImageUrls(candidate: IdentifyCandidate, variant: ImageVariant) {
  const derived = derivedCandidateImageUrl(candidate, variant);
  const derivedFallback = derivedCandidateImageUrl(candidate, variant, true);
  const uri = pickCardImageUrl(
    {
      image_url: candidate.image_url ?? derived,
      images: null,
      attributes: {},
    },
    variant,
  );
  const fallbackUri = pickCardImageUrl(
    {
      image_url: candidate.image_url ? derived ?? derivedFallback : derivedFallback,
      images: null,
      attributes: {},
    },
    variant,
  );
  return {
    uri,
    fallbackUri: fallbackUri && fallbackUri !== uri ? fallbackUri : undefined,
  };
}

/**
 * A candidate's card art, resolving the best per-provider image URL
 * (Pokémon / Yu-Gi-Oh! / Magic) with a graceful fallback source. Shared
 * by the session tray on both scanner surfaces.
 */
export function CandidateCardImage({
  candidate,
  variant = "small",
  width = "100%",
  height = "100%",
  rounded = 9,
  priority = "normal",
}: {
  candidate: IdentifyCandidate;
  variant?: ImageVariant;
  width?: DimensionValue;
  height?: DimensionValue;
  rounded?: number;
  priority?: "low" | "normal" | "high";
}) {
  const { uri, fallbackUri } = candidateImageUrls(candidate, variant);
  return (
    <CardImage
      uri={uri}
      fallbackUri={fallbackUri}
      width={width}
      height={height}
      rounded={rounded}
      priority={priority}
      recyclingKey={`${candidateKey(candidate)}:${uri ?? "missing"}`}
      alt={candidate.name}
      showSkeleton={false}
      loadTimeoutMs={4500}
      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
    />
  );
}
