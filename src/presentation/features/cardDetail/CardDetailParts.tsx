/**
 * `card/[id].tsx` presentational helpers extracted out of the screen so the
 * route file can focus on data + composition. All pure rendering — no
 * data fetching here except the two query-aware section components at the
 * bottom (LiveListingsSection / RecentCompsSection), which were already
 * self-contained queries inside the route.
 */
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  Clock,
  ExternalLink,
  Gavel,
  Search,
  ShoppingBag,
  Tag,
  type LucideIcon,
} from "lucide-react-native";
import Svg, { Polyline } from "react-native-svg";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { SkeletonCompsList, SkeletonListingsRail } from "@/presentation/components/Skeletons";
import { radius, spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardListings } from "@/application/queries/catalog/useCardListings";
import { useCardComps } from "@/application/queries/catalog/useCardComps";
import { useProvidersStatus } from "@/application/queries/ops/useProvidersStatus";
import type {
  CardSearchResult,
  HouseBlockWire,
  HouseGradeRowWire,
  HouseId,
  ListingWire,
  SoldCompWire,
} from "@/infrastructure/http";

// ── house palette (single source of truth) ─────────────────────────────
export const HOUSE_LABEL: Record<string, string> = {
  psa: "PSA",
  cgc: "CGC",
  bgs: "BGS",
  sgc: "SGC",
  tag: "TAG",
};

export const HOUSE_ORDER: HouseId[] = ["psa", "cgc", "bgs", "sgc", "tag"];

export function houseColor(house: string, p: ReturnType<typeof useThemedPalette>) {
  switch (house) {
    case "psa":
      return p.accent.mint;
    case "cgc":
      return p.accent.blue;
    case "bgs":
      return p.accent.amber;
    case "sgc":
      return p.accent.purple;
    case "tag":
      return p.ink.default;
    default:
      return p.ink.muted;
  }
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTcgName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const labels: Record<string, string> = {
    pokemon: "Pokémon",
    pokemontcg: "Pokémon",
    mtg: "Magic: The Gathering",
    magic: "Magic: The Gathering",
    magicthegathering: "Magic: The Gathering",
    yugioh: "Yu-Gi-Oh!",
    onepiece: "One Piece",
    onepiecetcg: "One Piece",
    lorcana: "Disney Lorcana",
    sports: "Sports",
  };
  return labels[normalized] ?? titleCase(value);
}

function formatSourceLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const labels: Record<string, string> = {
    pokemontcgapi: "Pokémon TCG API",
    pokemontcg: "Pokémon TCG API",
    tcgplayer: "TCGplayer",
    scryfall: "Scryfall",
    ygoprodeck: "YGOPRODeck",
    sportsdb: "Sports catalog",
  };
  return labels[normalized] ?? titleCase(value);
}

export function flattenHouses(
  houses: HouseBlockWire[],
  filter: HouseId | "all",
): HouseGradeRowWire[] {
  const out: HouseGradeRowWire[] = [];
  for (const h of houses) {
    if (filter !== "all" && h.house !== filter) continue;
    for (const g of h.grades) out.push(g);
  }
  out.sort((a, b) => b.market.amount - a.market.amount);
  return out.slice(0, filter === "all" ? 24 : 16);
}

// ── small UI atoms ─────────────────────────────────────────────────────

export function IconBtn({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
    >
      {children}
    </Pressable>
  );
}

export function BigPrice({
  amount,
  changePct,
  subLabel,
}: {
  amount: number | null;
  changePct: number | null;
  subLabel: string;
}) {
  const p = useThemedPalette();
  const positive = (changePct ?? 0) >= 0;
  const color = positive ? p.accent.mint : p.accent.rose;
  return (
    <View>
      {amount !== null ? (
        <Price usd={amount} className="text-5xl font-bold text-ink" />
      ) : (
        <Text className="text-5xl font-bold text-ink-muted">—</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
        {changePct !== null ? (
          <Text style={{ color, fontSize: 13, fontWeight: "700" }}>
            {positive ? "+" : ""}
            {changePct.toFixed(2)}%
          </Text>
        ) : null}
        <Text className="text-[11px] text-ink-dim">{subLabel}</Text>
      </View>
    </View>
  );
}

export function Sparkline({
  points,
  changePct,
  disabled,
}: {
  points: number[];
  changePct: number | null;
  disabled: boolean;
}) {
  const p = useThemedPalette();
  const W = 320;
  const H = 140;
  const PAD = 8;

  if (disabled) {
    return (
      <View
        style={{
          height: H,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="text-[11px] text-ink-dim">Intraday history coming soon</Text>
      </View>
    );
  }

  if (points.length < 2) {
    return (
      <View
        style={{
          height: H,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="text-[11px] text-ink-muted">No history available</Text>
      </View>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stride = (W - PAD * 2) / (points.length - 1);
  const coords = points
    .map((v, i) => `${PAD + i * stride},${H - PAD - ((v - min) / range) * (H - PAD * 2)}`)
    .join(" ");

  const positive = (changePct ?? 0) >= 0;
  const color = positive ? p.accent.mint : p.accent.rose;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        padding: 12,
      }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline
          points={coords}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <Text className="text-[10px] text-ink-dim">
          ${min.toFixed(2)} – ${max.toFixed(2)}
        </Text>
        {changePct !== null ? (
          <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
            {positive ? "+" : ""}
            {changePct.toFixed(2)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function StatTile({
  label,
  amount,
  text,
  showDivider = false,
}: {
  label: string;
  amount: number | null;
  text?: string;
  /** Render a thin vertical hairline on the left edge (Robinhood-style strip). */
  showDivider?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 4,
        paddingHorizontal: 12,
        gap: 4,
        borderLeftWidth: showDivider ? 1 : 0,
        borderLeftColor: withAlpha(p.line.default, 0.6),
      }}
    >
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {amount !== null ? (
        <Price
          usd={amount}
          style={{
            color: p.ink.default,
            fontSize: 15,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        />
      ) : (
        <Text
          style={{
            color: p.ink.default,
            fontSize: 15,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {text ?? "—"}
        </Text>
      )}
    </View>
  );
}

export function HouseChip({
  id,
  label,
  color,
  active,
  onPress,
}: {
  id: string;
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  // Robinhood-style underline tab — monochrome text, 2px accent
  // underline when active. House `color` (when provided) tints only
  // the underline so the row stays visually quiet.
  const accent = color ?? p.ink.default;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        paddingHorizontal: 4,
        paddingTop: 6,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: active ? accent : "transparent",
      }}
      accessibilityLabel={`Filter by ${id}`}
    >
      <Text
        style={{
          color: active ? p.ink.default : p.ink.muted,
          fontSize: 11,
          fontWeight: active ? "800" : "700",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GradeRow({
  row,
  isLast,
  onPress,
  active = false,
}: {
  row: HouseGradeRowWire;
  isLast: boolean;
  onPress?: () => void;
  active?: boolean;
}) {
  const p = useThemedPalette();
  const accent = houseColor(row.house, p);
  const positive = row.change_pct >= 0;
  const changeColor = positive ? p.accent.mint : p.accent.rose;
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
        backgroundColor: active ? withAlpha(accent, 0.1) : "transparent",
      }}
    >
      {/* Tiny house dot + monochrome label — Robinhood keeps row
          chrome quiet so values dominate the eye. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flex: 1,
          minWidth: 0,
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            color: p.ink.default,
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.4,
            flexShrink: 1,
          }}
        >
          {HOUSE_LABEL[row.house] ?? row.house.toUpperCase()} {row.grade_label}
        </Text>
      </View>
      <Text className="min-w-[54px] text-right text-[11px] text-ink-muted">
        {row.population.toLocaleString()} pop
      </Text>
      {row.source === "synthesized" ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: p.bg.base,
            borderWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <Text style={{ color: p.ink.dim, fontSize: 9, fontWeight: "700" }}>est</Text>
        </View>
      ) : null}
      <Text
        style={{
          color: changeColor,
          fontSize: 11,
          fontWeight: "700",
          minWidth: 50,
          textAlign: "right",
        }}
      >
        {positive ? "+" : ""}
        {row.change_pct.toFixed(1)}%
      </Text>
      <Price
        usd={row.market.amount}
        className="text-sm font-semibold text-ink"
        style={{ minWidth: 64, textAlign: "right" }}
      />
    </Wrapper>
  );
}

export function CardDetailsBlock({ card }: { card: CardSearchResult }) {
  const p = useThemedPalette();
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label, value: String(value) });
  };
  push("Collector number", card.number);
  push("Rarity", card.rarity);
  push("Release year", card.year);
  push("Set", card.set_name);
  push("Trading card game", formatTcgName(card.tcg));
  push("Data source", formatSourceLabel(card.source));

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: p.line.default,
              gap: 12,
            }}
          >
            <Text className="w-[118px] text-[11px] uppercase tracking-wider text-ink-dim">
              {r.label}
            </Text>
            <Text
              className="flex-1 text-right text-[12px] leading-5 text-ink"
              numberOfLines={4}
              ellipsizeMode="tail"
            >
              {r.value}
            </Text>
          </View>
        ))}
      </View>
      {card.tags && card.tags.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {card.tags.map((t) => (
            <View
              key={t}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: p.line.default,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: p.ink.muted,
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                {titleCase(t)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── section headers + query-aware sections ────────────────────────────

export function SectionHeader({ label, badge }: { label: string; badge?: string | null }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {badge ? (
        <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 11, flexShrink: 1 }}>
          {badge}
        </Text>
      ) : null}
    </View>
  );
}

type MarketplaceFallback = {
  label: string;
  title: string;
  url: string;
  tone: "mint" | "amber" | "blue" | "purple";
  icon: LucideIcon;
};

function buildListingQuery(card: CardSearchResult | null | undefined): string {
  if (!card) return "trading card";
  return (
    [card.name, card.set_name, card.number ? `#${card.number}` : null]
      .filter(Boolean)
      .join(" ")
      .trim() || "trading card"
  );
}

function marketplaceFallbacks(query: string): MarketplaceFallback[] {
  const q = encodeURIComponent(query);
  return [
    {
      label: "Active",
      title: "eBay",
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_BIN=1`,
      tone: "mint",
      icon: ShoppingBag,
    },
    {
      label: "Auctions",
      title: "eBay bids",
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Auction=1&_sop=1`,
      tone: "amber",
      icon: Gavel,
    },
    {
      label: "Market",
      title: "TCGplayer",
      url: `https://www.tcgplayer.com/search/all/product?q=${q}&view=grid`,
      tone: "blue",
      icon: Search,
    },
    {
      label: "Guide",
      title: "PriceCharting",
      url: `https://www.pricecharting.com/search-products?q=${q}&type=prices`,
      tone: "purple",
      icon: Tag,
    },
  ];
}

function formatListingSource(value: string | null | undefined): string {
  if (!value) return "Marketplace";
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const labels: Record<string, string> = {
    ebay: "eBay",
    tcgplayer: "TCGplayer",
    cardmarket: "Cardmarket",
    pricecharting: "PriceCharting",
  };
  return labels[normalized] ?? titleCase(value);
}

function sourceBadge(listings: ListingWire[]): string {
  if (listings.length === 0) return "Search marketplaces";
  const sources = Array.from(new Set(listings.map((l) => formatListingSource(l.source))));
  const sourceText =
    sources.length <= 2
      ? sources.join(" + ")
      : `${sources.slice(0, 2).join(" + ")} +${sources.length - 2}`;
  return `${listings.length} · ${sourceText}`;
}

function liveListingsBadge({
  listings,
  isError,
  ebayConfigured,
}: {
  listings: ListingWire[];
  isError: boolean;
  ebayConfigured: boolean | null;
}): string {
  if (isError) return "Unavailable";
  if (listings.length > 0) return sourceBadge(listings);
  if (ebayConfigured === false) return "eBay not connected";
  return sourceBadge(listings);
}

function formatTimeLeft(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds <= 0) return "ending";
  const days = Math.floor(seconds / 86_400);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(seconds / 3_600);
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `${minutes}m left`;
}

export function LiveListingsSection({
  cardId,
  card,
}: {
  cardId: string;
  card?: CardSearchResult | null;
}) {
  const p = useThemedPalette();
  const q = useCardListings(cardId, { limit: 12 });
  const providersQ = useProvidersStatus();
  const listings = q.data?.listings ?? [];
  const fallbackQuery = q.data?.query?.trim() || buildListingQuery(card);
  const fallbacks = marketplaceFallbacks(fallbackQuery);
  const ebayConfigured =
    providersQ.data?.providers.find((provider) => provider.id === "ebay")?.configured ?? null;

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        label="Live Listings"
        badge={liveListingsBadge({
          listings,
          isError: q.isError,
          ebayConfigured,
        })}
      />
      {q.isLoading ? (
        <SkeletonListingsRail rows={3} />
      ) : listings.length === 0 ? (
        <MarketplaceFallbackRail
          query={fallbackQuery}
          links={fallbacks}
          providerError={q.isError}
          ebayConfigured={ebayConfigured}
        />
      ) : (
        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            overflow: "hidden",
          }}
        >
          {listings.map((l, i) => (
            <ListingRow
              key={`${l.source}:${l.url || i}`}
              listing={l}
              isLast={i === listings.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function MarketplaceFallbackRail({
  query,
  links,
  providerError,
  ebayConfigured,
}: {
  query: string;
  links: MarketplaceFallback[];
  providerError: boolean;
  ebayConfigured: boolean | null;
}) {
  const p = useThemedPalette();
  const providerMissing = ebayConfigured === false;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
          {providerError
            ? "Live listings unavailable"
            : providerMissing
              ? "Connect eBay to show live listings"
              : "No active listings returned"}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
          {providerMissing
            ? "The production eBay provider is off, so Loupe cannot fetch live listing rows yet."
            : "Search the marketplaces directly for this exact card."}
        </Text>
        <Text numberOfLines={1} style={{ color: p.ink.dim, fontSize: 11, lineHeight: 16 }}>
          {query}
        </Text>
      </View>
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          overflow: "hidden",
        }}
      >
        {links.map((link, index) => (
          <MarketplaceFallbackRow
            key={link.title}
            link={link}
            isLast={index === links.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function MarketplaceFallbackRow({
  link,
  isLast,
}: {
  link: MarketplaceFallback;
  isLast: boolean;
}) {
  const p = useThemedPalette();
  const accent = p.accent[link.tone];
  const Icon = link.icon;
  return (
    <Pressable
      onPress={() => Linking.openURL(link.url).catch(() => undefined)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${link.title}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 54,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
        backgroundColor: pressed ? withAlpha(p.ink.default, 0.04) : "transparent",
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: withAlpha(accent, 0.12),
        }}
      >
        <Icon size={15} color={accent} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
          {link.title}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 11, fontWeight: "600" }}>{link.label}</Text>
      </View>
      <Text style={{ color: accent, fontSize: 12, fontWeight: "800" }}>Open</Text>
      <ExternalLink size={14} color={accent} strokeWidth={2.25} />
    </Pressable>
  );
}

function ListingMetaPill({
  label,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  icon?: LucideIcon;
  tone?: "muted" | "mint" | "amber";
}) {
  const p = useThemedPalette();
  const color = tone === "mint" ? p.accent.mint : tone === "amber" ? p.accent.amber : p.ink.muted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: withAlpha(color, 0.12),
        maxWidth: "100%",
      }}
    >
      {Icon ? <Icon size={10} color={color} strokeWidth={2.25} /> : null}
      <Text numberOfLines={1} style={{ color, fontSize: 10, fontWeight: "800" }}>
        {label}
      </Text>
    </View>
  );
}

function ListingRow({ listing, isLast }: { listing: ListingWire; isLast: boolean }) {
  const p = useThemedPalette();
  const timeLeft = listing.is_auction ? formatTimeLeft(listing.time_left_seconds) : null;
  const onPress = () => {
    if (listing.url) Linking.openURL(listing.url).catch(() => undefined);
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={!listing.url}
      accessibilityRole={listing.url ? "link" : undefined}
      accessibilityLabel={`Open ${listing.title || "marketplace listing"}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
        backgroundColor: pressed ? withAlpha(p.ink.default, 0.04) : "transparent",
        opacity: pressed ? 0.82 : 1,
      })}
    >
      {listing.image_url ? (
        <CardImage
          uri={listing.image_url}
          width={54}
          height={54}
          rounded={radius.md}
          contentFit="cover"
          priority="low"
          recyclingKey={listing.image_url ?? listing.url}
          alt={listing.title ?? "listing"}
        />
      ) : (
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: radius.md,
            backgroundColor: p.bg.sunken,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShoppingBag size={18} color={p.ink.dim} strokeWidth={2.25} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text
          numberOfLines={2}
          style={{ color: p.ink.default, fontSize: 13, fontWeight: "800", lineHeight: 18 }}
        >
          {listing.title || "Marketplace listing"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <ListingMetaPill label={formatListingSource(listing.source)} />
          {listing.condition ? (
            <ListingMetaPill label={listing.condition} icon={Tag} tone="mint" />
          ) : null}
          {listing.is_auction ? <ListingMetaPill label="Auction" icon={Gavel} tone="amber" /> : null}
          {timeLeft ? <ListingMetaPill label={timeLeft} icon={Clock} tone="amber" /> : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6, minWidth: 72 }}>
        <Price
          usd={listing.price.amount}
          compact={false}
          style={{ color: p.ink.default, fontSize: 15, fontWeight: "900" }}
        />
        {listing.url ? (
          <ExternalLink size={15} color={p.ink.dim} strokeWidth={2.25} />
        ) : (
          <Text style={{ color: p.ink.dim, fontSize: 10, fontWeight: "700" }}>LIVE</Text>
        )}
      </View>
    </Pressable>
  );
}

export function RecentCompsSection({ cardId }: { cardId: string }) {
  const p = useThemedPalette();
  const q = useCardComps(cardId, { days: 90, limit: 12 });
  const comps = q.data?.comps ?? [];

  return (
    <View style={{ gap: 4 }}>
      <SectionHeader label="Recent Sold Comps" badge="90d" />
      {q.isLoading ? (
        <SkeletonCompsList rows={4} />
      ) : comps.length === 0 ? (
        <View
          style={{
            padding: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            alignItems: "center",
          }}
        >
          <Text className="text-[12px] text-ink-muted">No recent comps in window</Text>
        </View>
      ) : (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            overflow: "hidden",
          }}
        >
          {comps.map((c, i) => (
            <CompRow
              key={`${c.source}:${c.url || c.sold_at}:${i}`}
              comp={c}
              isLast={i === comps.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CompRow({ comp, isLast }: { comp: SoldCompWire; isLast: boolean }) {
  const p = useThemedPalette();
  const onPress = () => {
    if (comp.url) Linking.openURL(comp.url).catch(() => undefined);
  };
  const date = comp.sold_at ? new Date(comp.sold_at) : null;
  const dateLabel =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : "—";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 12, fontWeight: "600" }}>
          {comp.title}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 10 }}>
          {comp.source.toUpperCase()} · {dateLabel}
        </Text>
      </View>
      {comp.grade ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.15),
          }}
        >
          <Text style={{ color: p.accent.mint, fontSize: 10, fontWeight: "700" }}>
            {(comp.house ?? "").toUpperCase()} {comp.grade}
          </Text>
        </View>
      ) : null}
      <Price usd={comp.price.amount} className="text-[13px] font-semibold text-ink" />
    </Pressable>
  );
}
