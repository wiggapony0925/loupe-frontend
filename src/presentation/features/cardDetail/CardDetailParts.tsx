/**
 * `card/[id].tsx` presentational helpers extracted out of the screen so the
 * route file can focus on data + composition.
 *
 * Pure rendering atoms (house chips, grade rows, stat tiles, the details
 * block) plus the two query-aware sections the screen composes:
 *
 *   - `LiveListingsSection` — the always-on "Marketplaces" carousel. Its tile
 *     mapping + carousel UI live in `./MarketplaceCarousel`; this section just
 *     wires the queries and the external-browser sheet.
 *   - `RecentCompsSection` — recent sold comps list.
 */
import React, { useMemo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Activity, Info } from "lucide-react-native";
import { openExternalUrl } from "@/shared/openExternalUrl";
import { Price } from "@/presentation/components/Price";
import { NoteCard } from "@/presentation/components/NoteCard";
import { SkeletonCompsList, SkeletonListingsCarousel } from "@/presentation/components/Skeletons";
import { spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardListings } from "@/application/queries/catalog/useCardListings";
import { useCardMarketplacePrices } from "@/application/queries/catalog/useCardMarketplacePrices";
import { useCardComps } from "@/application/queries/catalog/useCardComps";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import type {
  CardSearchResult,
  HouseBlockWire,
  HouseGradeRowWire,
  HouseId,
  SoldCompWire,
} from "@/infrastructure/http";
import {
  MarketplaceCarousel,
  buildMarketplaceTiles,
  marketplaceSummaryBadge,
} from "./MarketplaceCarousel";

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
        paddingHorizontal: 4,
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
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: withAlpha(p.ink.muted, 0.08),
            borderWidth: 1,
            borderColor: withAlpha(p.ink.muted, 0.12),
          }}
        >
          <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 10, fontWeight: "800" }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Always-on "Marketplaces" section. Composes live listings, per-marketplace
 * market prices, and shop deep-links into a single carousel (see
 * `MarketplaceCarousel`). Only collapses to a NoteCard in the true-empty case
 * (no card resolved / hard provider error with zero data).
 */
export function LiveListingsSection({
  cardId,
  card,
}: {
  cardId: string;
  card?: CardSearchResult | null;
}) {
  const listingsQ = useCardListings(cardId, { limit: 12 });
  const pricesQ = useCardMarketplacePrices(cardId, { limit: 50 });

  const isLoading = listingsQ.isLoading || pricesQ.isLoading;
  const providerError = listingsQ.isError || pricesQ.isError;

  // Card art + name so market/shop tiles read as marketplace product tiles
  // (the same card photo the hero shows) rather than bare icons.
  const cardName = card?.name ?? null;
  const cardImageUrl = pickCardImageUrl(card, "normal") ?? null;
  const cardBlurhash = pickCardBlurhash(card) ?? null;

  const tiles = useMemo(
    () =>
      buildMarketplaceTiles(
        listingsQ.data?.listings ?? [],
        pricesQ.data?.providers ?? [],
        pricesQ.data?.actions ?? [],
        { cardName, cardImageUrl, cardBlurhash },
      ),
    [listingsQ.data, pricesQ.data, cardName, cardImageUrl, cardBlurhash],
  );

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader label="Marketplaces" badge={marketplaceSummaryBadge(tiles, providerError)} />
      {isLoading ? (
        <SkeletonListingsCarousel count={3} />
      ) : tiles.length > 0 ? (
        <MarketplaceCarousel tiles={tiles} onOpen={(t) => openExternalUrl(t.url)} />
        ) : (
          <NoteCard
            variant={providerError ? "error" : "muted"}
            icon={Info}
            title={providerError ? "Marketplaces unavailable" : "No marketplace data yet"}
            body={
              providerError
                ? "Loupe couldn't reach a marketplace provider. Pull to refresh or try again shortly."
                : "No connected provider returned pricing or listings for this card right now."
            }
          />
        )}
    </View>
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
        <NoteCard
          variant="muted"
          icon={Activity}
          title="No recent comps in window"
          body="No completed sales were reported by connected providers in the last 90 days."
        />
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
