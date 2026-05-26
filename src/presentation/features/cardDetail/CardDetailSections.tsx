/**
 * CardDetailSections — extra rows for the `/card/[id]` page powered by
 * the new `grade-summary` and `marketplace-prices` endpoints.
 *
 * Lives outside `app/card/[id].tsx` because that file is already 1k+
 * lines. Both sections render nothing on error and a tiny "no data"
 * label when empty, so they're safe to drop into any card view.
 */
import React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react-native";
import { Price } from "@/presentation/components/Price";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { useCardGradeSummary } from "@/application/queries/useCardGradeSummary";
import { useCardMarketplacePrices } from "@/application/queries/useCardMarketplacePrices";

// ─────────────────────────────────────────────────────────────────────
// MarketplaceChipsRow
// ─────────────────────────────────────────────────────────────────────

/**
 * Horizontal pill row: one chip per marketplace with the cheapest live
 * price + a deep link. Inspired by PriceCharting / Collectr's "eBay $X
 * · TCGplayer $Y · ..." strip.
 */
export function MarketplaceChipsRow({ cardId }: { cardId: string }) {
  const p = useThemedPalette();
  const q = useCardMarketplacePrices(cardId, { limit: 50 });
  const rows = q.data?.providers ?? [];

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Lowest Live Price
      </Text>
      {q.isLoading ? (
        <View
          style={{
            height: 56,
            borderRadius: 14,
            backgroundColor: p.bg.sunken,
          }}
        />
      ) : rows.length === 0 ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text className="text-[12px] text-ink-muted">
            No live listings yet
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {rows.map((r) => {
            const href = r.url ?? r.search_url;
            return (
              <Pressable
                key={r.source}
                onPress={() => {
                  if (href) Linking.openURL(href).catch(() => {});
                }}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  backgroundColor: p.bg.elevated,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  minWidth: 132,
                  gap: 4,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text className="text-[11px] font-semibold uppercase tracking-[2px] text-ink-dim">
                    {r.label}
                  </Text>
                  {href ? (
                    <ExternalLink
                      size={11}
                      color={p.ink.dim}
                      strokeWidth={2.25}
                    />
                  ) : null}
                </View>
                <Price
                  usd={r.price.amount}
                  className="text-[18px] font-bold text-ink"
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GradeSummaryPills
// ─────────────────────────────────────────────────────────────────────

interface GradeSummaryPillsProps {
  cardId: string;
  /** Currently-selected grade label. `null` = all/baseline. */
  value: string | null;
  onChange: (next: string | null) => void;
}

/**
 * Horizontal pivot row showing UNGRADED + each observed grade with the
 * most recent sale price and a 30d delta. Tapping a pill bubbles the
 * grade label up so callers can filter sold comps below.
 */
export function GradeSummaryPills({
  cardId,
  value,
  onChange,
}: GradeSummaryPillsProps) {
  const p = useThemedPalette();
  const q = useCardGradeSummary(cardId, { windowDays: 30 });
  const rows = q.data?.grades ?? [];

  if (q.isLoading) {
    return (
      <View
        style={{
          height: 72,
          borderRadius: 14,
          backgroundColor: p.bg.sunken,
        }}
      />
    );
  }
  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Price by Grade · 30d
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {rows.map((r) => {
          const isActive = value === r.grade;
          const delta = r.delta_pct;
          const deltaColor =
            delta == null
              ? p.ink.dim
              : delta >= 0
                ? p.accent.mint
                : p.accent.rose;
          const DeltaIcon = delta == null ? null : delta >= 0 ? TrendingUp : TrendingDown;
          return (
            <Pressable
              key={r.grade}
              onPress={() => onChange(isActive ? null : r.grade)}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isActive ? p.ink.default : p.line.default,
                backgroundColor: isActive ? p.ink.default : p.bg.elevated,
                paddingVertical: 10,
                paddingHorizontal: 14,
                minWidth: 132,
                gap: 4,
              }}
            >
              <Text
                style={{ color: isActive ? p.bg.elevated : p.ink.dim }}
                className="text-[11px] font-semibold uppercase tracking-[2px]"
              >
                {r.grade}
              </Text>
              <Price
                usd={r.last_sale?.amount ?? r.median_recent ?? 0}
                style={{ color: isActive ? p.bg.elevated : p.ink.default }}
                className="text-[18px] font-bold"
              />
              {delta != null && DeltaIcon ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <DeltaIcon
                    size={11}
                    color={isActive ? p.bg.elevated : deltaColor}
                    strokeWidth={2.25}
                  />
                  <Text
                    style={{
                      color: isActive ? p.bg.elevated : deltaColor,
                    }}
                    className="text-[11px] font-semibold"
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}% · {r.sales_count}
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] text-ink-dim">
                  {r.sales_count} sale{r.sales_count === 1 ? "" : "s"}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
