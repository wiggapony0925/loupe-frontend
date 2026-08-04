/**
 * MarketplaceTileCard — the one reusable tile for every marketplace surface:
 * live seller listings, per-marketplace market prices, shop deep-links, and
 * "Near You" Facebook listings.
 *
 * Two flat, minimal layouts (Robinhood-quote energy, no frosted chips or
 * full-bleed photo gimmicks):
 *
 *   `brand` — a price quote card: brand dot + name up top, the price BIG,
 *             kind caption underneath. Used when the tile has no photo of
 *             its own (market prices, shop links, photo-less listings).
 *
 *   `photo` — a horizontal listing card: the listing's real photo as a
 *             clean left thumbnail, then title / meta / price. Used for
 *             Facebook nearby listings and seller rows with photos.
 *
 * Purely presentational: callers pass normalized props, so the same tile
 * renders an eBay auction, a Cardmarket price, or a nearby FB listing.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowUpRight, type LucideIcon } from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { radius, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Quote-card width (dp) — drives carousel sizing for brand tiles. */
export const MARKETPLACE_TILE_WIDTH = 148;
/** Horizontal photo-card width (dp) — nearby/photo listings. */
export const MARKETPLACE_PHOTO_TILE_WIDTH = 250;

export interface MarketplaceTileCardProps {
  /** Force a layout. Defaults to `photo` when `imageUrl` is set, else `brand`. */
  layout?: "brand" | "photo";
  /** Listing photo (photo layout only). */
  imageUrl?: string | null;
  blurhash?: string | null;
  /** Icon shown in the photo slot when the image fails/absent. */
  fallbackIcon: LucideIcon;
  /** Source brand tone (resolved palette color). */
  accent: string;
  /** Source brand label ("eBay", "Cardmarket", "Facebook"…). */
  sourceLabel: string;
  /** Primary line — the card or listing name (photo layout). */
  title: string;
  /** Kind caption ("Buy now", "Auction", "Market", "Search"…). */
  caption: string;
  /** Formatted price. `null` ⇒ a deep-link/shop tile (renders a CTA instead). */
  priceText?: string | null;
  condition?: string | null;
  /** Small trailing chip (auction timer / distance). */
  statusOverlay?: { icon: LucideIcon; label: string } | null;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  recyclingKey?: string;
}

export function MarketplaceTileCard(props: MarketplaceTileCardProps) {
  const layout = props.layout ?? (props.imageUrl ? "photo" : "brand");
  return layout === "photo" ? <PhotoTile {...props} /> : <BrandTile {...props} />;
}

/** Shared flat container — hairline border, no shadow, gentle press state. */
function TileShell({
  width,
  onPress,
  disabled,
  accessibilityLabel,
  children,
}: {
  width: number;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityLabel={accessibilityLabel}
      // Layout in a StyleSheet, colours inline. A plain object returned from
      // `style={({pressed}) => ({...})}` loses its layout props under this
      // project's NativeWind transform — so `width` and `overflow: "hidden"`
      // never applied and every tile grew to fit its text. That's why one
      // long Facebook Marketplace description stretched a tile far past its
      // neighbours and made the whole rail ragged.
      style={[
        shellStyles.tile,
        {
          width,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * A marketplace's initial on its own brand colour — eBay's "e", Facebook's
 * "f", TCGplayer's "T".
 *
 * Deliberately NOT their real logos. Scraping marketplace artwork and shipping
 * it inside an App Store binary is a trademark decision, not a styling one,
 * and it rots the moment they rebrand. A monogram in the brand's own colour
 * reads as that marketplace instantly, ships nothing that isn't ours, and
 * degrades gracefully for a source we've never seen.
 */
const BRAND_COLORS: Record<string, string> = {
  ebay: "#E53238",
  facebook: "#1877F2",
  "facebook marketplace": "#1877F2",
  tcgplayer: "#F0A93B",
  cardmarket: "#012169",
  mercari: "#EE3B3B",
  whatnot: "#FFC629",
  pricecharting: "#2E7D32",
  catalog: "#6B7280",
};

function MarketplaceBadge({
  sourceLabel,
  accent,
}: {
  sourceLabel: string;
  accent: string;
}) {
  const key = sourceLabel.trim().toLowerCase();
  const brand = BRAND_COLORS[key] ?? accent;
  const initial = (sourceLabel.trim()[0] ?? "?").toUpperCase();
  return (
    <View style={[shellStyles.badge, { backgroundColor: brand }]}>
      <Text style={shellStyles.badgeText}>{initial}</Text>
    </View>
  );
}

/** Brand row: brand badge + source name + trailing external-link affordance. */
function BrandRow({
  accent,
  sourceLabel,
  showLink,
  trailing,
}: {
  accent: string;
  sourceLabel: string;
  showLink: boolean;
  trailing?: React.ReactNode;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <MarketplaceBadge sourceLabel={sourceLabel} accent={accent} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: p.ink.muted,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.3,
        }}
      >
        {sourceLabel}
      </Text>
      {trailing}
      {showLink ? <ArrowUpRight size={13} color={p.ink.dim} strokeWidth={2.5} /> : null}
    </View>
  );
}

function StatusChip({
  accent,
  icon: Icon,
  label,
}: {
  accent: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: withAlpha(accent, 0.12),
      }}
    >
      <Icon size={9} color={accent} strokeWidth={2.5} />
      <Text numberOfLines={1} style={{ color: accent, fontSize: 9, fontWeight: "800" }}>
        {label}
      </Text>
    </View>
  );
}

// ─── brand layout — the price quote card ────────────────────────────────

function BrandTile({
  accent,
  sourceLabel,
  caption,
  priceText,
  condition,
  statusOverlay,
  onPress,
  disabled,
  accessibilityLabel,
}: MarketplaceTileCardProps) {
  const p = useThemedPalette();
  const StatusIcon = statusOverlay?.icon;
  return (
    <TileShell
      width={MARKETPLACE_TILE_WIDTH}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ padding: 12, gap: 8 }}>
        <BrandRow
          accent={accent}
          sourceLabel={sourceLabel}
          showLink={!disabled}
          trailing={
            statusOverlay && StatusIcon ? (
              <StatusChip accent={accent} icon={StatusIcon} label={statusOverlay.label} />
            ) : undefined
          }
        />

        {priceText ? (
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.default,
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: -0.5,
              fontVariant: ["tabular-nums"],
            }}
          >
            {priceText}
          </Text>
        ) : (
          <Text
            numberOfLines={1}
            style={{ color: accent, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 }}
          >
            Browse →
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.dim,
              fontSize: 9,
              fontWeight: "800",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {caption}
          </Text>
          {condition ? (
            <>
              <View
                style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: p.ink.dim }}
              />
              <Text numberOfLines={1} style={{ color: p.ink.dim, fontSize: 9, fontWeight: "700" }}>
                {condition}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </TileShell>
  );
}

// ─── photo layout — the horizontal listing card ─────────────────────────

const PHOTO_W = 66;
const PHOTO_H = 88;

function PhotoTile({
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
  const StatusIcon = statusOverlay?.icon;
  return (
    <TileShell
      width={MARKETPLACE_PHOTO_TILE_WIDTH}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ flexDirection: "row", padding: 10, gap: 10 }}>
        <View
          style={{
            width: PHOTO_W,
            height: PHOTO_H,
            borderRadius: radius.md,
            overflow: "hidden",
            backgroundColor: withAlpha(accent, 0.08),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {imageUrl ? (
            <CardImage
              uri={imageUrl}
              blurhash={blurhash ?? undefined}
              width={PHOTO_W}
              height={PHOTO_H}
              rounded={0}
              contentFit="cover"
              priority="low"
              recyclingKey={recyclingKey ?? imageUrl}
              alt={title}
            />
          ) : (
            <FallbackIcon size={24} color={withAlpha(accent, 0.55)} strokeWidth={1.75} />
          )}
        </View>

        <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 1 }}>
          <View style={{ gap: 4 }}>
            <BrandRow
              accent={accent}
              sourceLabel={sourceLabel}
              showLink={!disabled}
              trailing={
                statusOverlay && StatusIcon ? (
                  <StatusChip accent={accent} icon={StatusIcon} label={statusOverlay.label} />
                ) : undefined
              }
            />
            <Text
              numberOfLines={2}
              style={{
                color: p.ink.default,
                fontSize: 12.5,
                fontWeight: "700",
                lineHeight: 16,
              }}
            >
              {title}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            {priceText ? (
              <Text
                numberOfLines={1}
                style={{
                  color: p.ink.default,
                  fontSize: 16,
                  fontWeight: "800",
                  letterSpacing: -0.4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {priceText}
              </Text>
            ) : (
              <Text style={{ color: accent, fontSize: 13, fontWeight: "800" }}>Browse →</Text>
            )}
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                color: p.ink.dim,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              {caption}
              {condition ? ` · ${condition}` : ""}
            </Text>
          </View>
        </View>
      </View>
    </TileShell>
  );
}


/**
 * Tile chrome. `minHeight` is what keeps a rail of mixed content aligned:
 * without it a one-line title and a two-line one produce tiles of different
 * heights sitting side by side.
 */
const shellStyles = StyleSheet.create({
  tile: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 112,
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12,
  },
});
