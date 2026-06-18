/**
 * MarketplaceTileCard — the one reusable carousel tile for every marketplace
 * surface: live seller listings, per-marketplace market prices, shop
 * deep-links, and "Near You" Facebook listings.
 *
 * Photo-forward, App-Store-"Shop" / Robinhood-marketplace styling: a full-bleed
 * image (the listing's own photo, or the card art as a fallback), a frosted
 * source chip over the image, an optional status chip (auction timer / distance),
 * then a tight body with the name, a kind caption, and the price. No top accent
 * strip — the source chip carries the brand tone instead.
 *
 * Purely presentational: callers pass normalized props, so the same tile renders
 * an eBay auction, a Cardmarket price, a Google search link, or a nearby listing.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { ExternalLink, type LucideIcon } from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { radius, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Carousel tile width (dp). Drives the parent ScrollView's snap interval. */
export const MARKETPLACE_TILE_WIDTH = 150;
const IMAGE_HEIGHT = 116;

export interface MarketplaceTileCardProps {
  /** Listing/card photo. Falls back to the icon block when absent. */
  imageUrl?: string | null;
  blurhash?: string | null;
  /** Icon shown when there's no image. */
  fallbackIcon: LucideIcon;
  /** Source brand tone (resolved palette color). */
  accent: string;
  /** Source brand label shown in the frosted chip ("eBay", "Cardmarket"…). */
  sourceLabel: string;
  /** Primary line — the card or listing name. */
  title: string;
  /** Kind caption ("Buy now", "Auction", "Market", "Search"…). */
  caption: string;
  /** Formatted price. `null` ⇒ a deep-link/shop tile (renders a CTA instead). */
  priceText?: string | null;
  condition?: string | null;
  /** Small chip over the image (auction timer / distance). */
  statusOverlay?: { icon: LucideIcon; label: string } | null;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  recyclingKey?: string;
}

export function MarketplaceTileCard({
  imageUrl,
  blurhash,
  fallbackIcon: FallbackIcon,
  accent,
  sourceLabel,
  title,
  caption,
  priceText,
  condition,
  statusOverlay,
  onPress,
  disabled,
  accessibilityLabel,
  recyclingKey,
}: MarketplaceTileCardProps) {
  const p = useThemedPalette();
  const hasImage = !!imageUrl;
  const StatusIcon = statusOverlay?.icon;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: MARKETPLACE_TILE_WIDTH,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 2,
        },
        pressed && {
          opacity: 0.92,
          transform: [{ scale: 0.97 }],
          backgroundColor: p.bg.sunken,
        },
      ]}
    >
      {/* ── media ── */}
      <View
        style={{
          height: IMAGE_HEIGHT,
          backgroundColor: hasImage ? p.bg.sunken : withAlpha(accent, 0.08),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hasImage ? (
          <CardImage
            uri={imageUrl}
            blurhash={blurhash ?? undefined}
            width={MARKETPLACE_TILE_WIDTH}
            height={IMAGE_HEIGHT}
            rounded={0}
            contentFit="cover"
            priority="low"
            recyclingKey={recyclingKey ?? imageUrl ?? sourceLabel}
            alt={title}
          />
        ) : (
          <FallbackIcon size={34} color={withAlpha(accent, 0.5)} strokeWidth={1.75} />
        )}

        {/* Frosted source chip — dark scrim over photos, accent-tinted on the
            icon block so it stays legible in both themes. */}
        <View
          style={{
            position: "absolute",
            top: 7,
            left: 7,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: hasImage ? "rgba(0,0,0,0.55)" : withAlpha(accent, 0.14),
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />
          <Text
            numberOfLines={1}
            style={{
              color: hasImage ? "#fff" : accent,
              fontSize: 9,
              fontWeight: "800",
              letterSpacing: 0.3,
            }}
          >
            {sourceLabel}
          </Text>
        </View>

        {/* Status chip — auction timer / distance. */}
        {statusOverlay && StatusIcon ? (
          <View
            style={{
              position: "absolute",
              bottom: 7,
              right: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: withAlpha(accent, 0.95),
              maxWidth: MARKETPLACE_TILE_WIDTH - 28,
            }}
          >
            <StatusIcon size={9} color="#fff" strokeWidth={2.5} />
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
              {statusOverlay.label}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── body ── */}
      <View style={{ padding: 11, gap: 5 }}>
        <Text numberOfLines={2} style={{ color: p.ink.default, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
          {title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <Text
            style={{
              color: accent,
              fontSize: 9,
              fontWeight: "800",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {caption}
          </Text>
          {condition ? (
            <>
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: p.ink.dim }} />
              <Text numberOfLines={1} style={{ color: p.ink.dim, fontSize: 9, fontWeight: "700" }}>
                {condition}
              </Text>
            </>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 1,
          }}
        >
          {priceText ? (
            <Text style={{ color: p.ink.default, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 }}>
              {priceText}
            </Text>
          ) : (
            <Text style={{ color: accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.2 }}>
              Open
            </Text>
          )}
          {!disabled ? <ExternalLink size={13} color={p.ink.dim} strokeWidth={2.25} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
