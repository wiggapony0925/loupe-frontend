/**
 * `card/[id].tsx` presentational helpers extracted out of the screen so the
 * route file can focus on data + composition. All pure rendering — no
 * data fetching here except the two query-aware section components at the
 * bottom (LiveListingsSection / RecentCompsSection), which were already
 * self-contained queries inside the route.
 */
import React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import {
  SkeletonCompsList,
  SkeletonListingsRail,
} from "@/presentation/components/Skeletons";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardListings } from "@/application/queries/catalog/useCardListings";
import { useCardComps } from "@/application/queries/catalog/useCardComps";
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

export function houseColor(
  house: string,
  p: ReturnType<typeof useThemedPalette>,
) {
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
        <Text className="text-[11px] text-ink-dim">
          Intraday history coming soon
        </Text>
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
    .map(
      (v, i) =>
        `${PAD + i * stride},${H - PAD - ((v - min) / range) * (H - PAD * 2)}`,
    )
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
        backgroundColor: active ? withAlpha(accent, 0.10) : "transparent",
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
          <Text style={{ color: p.ink.dim, fontSize: 9, fontWeight: "700" }}>
            est
          </Text>
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

export function SectionHeader({
  label,
  badge,
}: {
  label: string;
  badge?: string | null;
}) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
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
        <Text style={{ color: p.ink.muted, fontSize: 11 }}>· {badge}</Text>
      ) : null}
    </View>
  );
}

type MarketplaceFallback = {
  label: string;
  title: string;
  subtitle: string;
  url: string;
  tone: "mint" | "amber" | "blue" | "purple";
};

function buildListingQuery(card: CardSearchResult | null | undefined): string {
  if (!card) return "trading card";
  return [
    card.name,
    card.set_name,
    card.number ? `#${card.number}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "trading card";
}

function marketplaceFallbacks(query: string): MarketplaceFallback[] {
  const q = encodeURIComponent(query);
  return [
    {
      label: "Active",
      title: "eBay live search",
      subtitle: "Buy-it-now listings for this card",
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_BIN=1`,
      tone: "mint",
    },
    {
      label: "Bids",
      title: "eBay auctions",
      subtitle: "Auction results ending soon",
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Auction=1&_sop=1`,
      tone: "amber",
    },
    {
      label: "Market",
      title: "TCGplayer search",
      subtitle: "Seller inventory and market asks",
      url: `https://www.tcgplayer.com/search/all/product?q=${q}&view=grid`,
      tone: "blue",
    },
    {
      label: "Comps",
      title: "PriceCharting search",
      subtitle: "Price guide and marketplace context",
      url: `https://www.pricecharting.com/search-products?q=${q}&type=prices`,
      tone: "purple",
    },
  ];
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
  const listings = q.data?.listings ?? [];
  const fallbackQuery = q.data?.query?.trim() || buildListingQuery(card);
  const fallbacks = marketplaceFallbacks(fallbackQuery);

  return (
    <View style={{ gap: 4 }}>
      <SectionHeader
        label="Live Listings"
        badge={listings.length > 0 ? `${listings.length}` : "Search"}
      />
      {q.isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SkeletonListingsRail rows={4} />
        </ScrollView>
      ) : listings.length === 0 ? (
        <MarketplaceFallbackRail
          query={fallbackQuery}
          links={fallbacks}
          providerError={q.isError}
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 10, paddingRight: 12 }}>
            {listings.map((l, i) => (
              <ListingCard key={`${l.source}:${l.url || i}`} listing={l} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function MarketplaceFallbackRail({
  query,
  links,
  providerError,
}: {
  query: string;
  links: MarketplaceFallback[];
  providerError: boolean;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 17 }}>
        {providerError
          ? "Listing providers are unavailable. Open live marketplace searches instead."
          : "No API listings came back. Open live marketplace searches for current asks, auctions, and bids."}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 10, paddingRight: 12 }}>
          {links.map((link) => (
            <MarketplaceFallbackCard key={link.title} link={link} query={query} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MarketplaceFallbackCard({
  link,
  query,
}: {
  link: MarketplaceFallback;
  query: string;
}) {
  const p = useThemedPalette();
  const accent = p.accent[link.tone];
  return (
    <Pressable
      onPress={() => Linking.openURL(link.url).catch(() => undefined)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${link.title}`}
      style={({ pressed }) => ({
        width: 178,
        padding: 12,
        borderRadius: 14,
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: withAlpha(accent, 0.28),
        gap: 10,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: withAlpha(accent, 0.14),
        }}
      >
        <Text style={{ color: accent, fontSize: 10, fontWeight: "800" }}>
          {link.label}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 13, fontWeight: "800" }}>
          {link.title}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 11, lineHeight: 15 }}>
          {link.subtitle}
        </Text>
      </View>
      <Text numberOfLines={2} style={{ color: p.ink.dim, fontSize: 10, lineHeight: 14 }}>
        {query}
      </Text>
      <Text style={{ color: accent, fontSize: 11, fontWeight: "800" }}>
        Open live results
      </Text>
    </Pressable>
  );
}

function ListingCard({ listing }: { listing: ListingWire }) {
  const p = useThemedPalette();
  const onPress = () => {
    if (listing.url) Linking.openURL(listing.url).catch(() => undefined);
  };
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 168,
        padding: 10,
        borderRadius: 14,
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: p.line.default,
        gap: 8,
      }}
    >
      {listing.image_url ? (
        <CardImage
          uri={listing.image_url}
          width={148}
          height={120}
          rounded={10}
          contentFit="cover"
          priority="low"
          recyclingKey={listing.image_url ?? listing.url}
          alt={listing.title ?? "listing"}
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 120,
            borderRadius: 10,
            backgroundColor: p.bg.sunken,
          }}
        />
      )}
      <Text
        numberOfLines={2}
        style={{ color: p.ink.default, fontSize: 11, fontWeight: "600" }}
      >
        {listing.title}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Price
          usd={listing.price.amount}
          className="text-[13px] font-semibold text-ink"
        />
        {listing.is_auction ? (
          <Text style={{ color: p.accent.amber, fontSize: 10, fontWeight: "700" }}>
            AUCTION
          </Text>
        ) : null}
      </View>
      {listing.condition ? (
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.15),
          }}
        >
          <Text style={{ color: p.accent.mint, fontSize: 10, fontWeight: "700" }}>
            {listing.condition.toUpperCase()}
          </Text>
        </View>
      ) : null}
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
          <Text className="text-[12px] text-ink-muted">
            No recent comps in window
          </Text>
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
        <Text
          numberOfLines={1}
          style={{ color: p.ink.default, fontSize: 12, fontWeight: "600" }}
        >
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
