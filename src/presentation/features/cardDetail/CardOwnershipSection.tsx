/**
 * CardOwnershipSection — "Your position" in this card, from the
 * server-composed `GET /v1/cards/{id}/ownership` (auth).
 *
 * Robinhood-position-panel treatment:
 *   • Hero panel (statement metal-card aesthetic): position value big,
 *     colored P/L, and a cost-basis · copies · top-grade stat strip.
 *   • Grade tiers as a compact, dense list (no repeated card art — the
 *     grade carries the identity by color): colored grade · ×count ·
 *     value. Capped to VISIBLE_TIERS with a "Show all" toggle so a deep
 *     position stays skimmable. Single-copy tiers open the holding editor
 *     directly; multi-copy tiers expand into per-copy rows.
 *
 * Copies are CONSOLIDATED by tier: graded → (house, grade, condition);
 * raw → condition only (a placeholder grade on an ungraded card must
 * never splinter the list). Renders nothing for guests/non-owners.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  PencilLine,
  Plus,
  ScanLine,
  Upload,
} from "lucide-react-native";
import { useThemedPalette, withAlpha, gradeColor } from "@/presentation/theme/tokens";
import { Price, useMoney } from "@/presentation/components/Price";
import { useCardOwnership } from "@/application/queries/collection/useCardOwnership";
import { routes } from "@/shared/routes";
import type { AcquisitionSource, CardHoldingWire } from "@/infrastructure/http";

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function tierLabel(house: string, grade: string, condition: string | null): string {
  if (house === "loupe") return `Raw${condition ? ` · ${condition.toUpperCase()}` : ""}`;
  const n = Number(grade);
  const g = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${house.toUpperCase()} ${g}`;
}

const ACQUIRED: Record<AcquisitionSource, { label: string; Icon: typeof ScanLine }> = {
  scan: { label: "Scanned", Icon: ScanLine },
  manual: { label: "Added", Icon: PencilLine },
  import: { label: "Imported", Icon: Upload },
};

// Deep positions stay skimmable: show the top tiers, tuck the rest behind a
// "Show all" toggle (a 15-copy Charizard shouldn't unfurl six rows by default).
const VISIBLE_TIERS = 3;

interface HoldingTier {
  key: string;
  label: string;
  house: string;
  grade: string;
  isGraded: boolean;
  holdings: CardHoldingWire[];
  valueUsd: number | null;
  costUsd: number | null;
  plUsd: number | null;
}

/** Group holdings into grade tiers, best tier first (graded > raw, high grade first). */
function buildTiers(holdings: CardHoldingWire[]): HoldingTier[] {
  const map = new Map<string, HoldingTier>();
  for (const h of holdings) {
    // Raw copies group by condition only — the placeholder grade on an
    // ungraded card is meaningless, and keying on it used to splinter the
    // list into several identical "Raw" tiers.
    const key =
      h.house === "loupe"
        ? `loupe:${h.condition ?? ""}`
        : `${h.house}:${h.grade}:${h.condition ?? ""}`;
    let tier = map.get(key);
    if (!tier) {
      tier = {
        key,
        label: tierLabel(h.house, h.grade, h.condition),
        house: h.house,
        grade: h.grade,
        isGraded: h.is_graded,
        holdings: [],
        valueUsd: null,
        costUsd: null,
        plUsd: null,
      };
      map.set(key, tier);
    }
    tier.holdings.push(h);
    const v = num(h.estimated_value_usd);
    const c = num(h.purchase_price_usd);
    const pl = num(h.unrealized_pl_usd);
    if (v != null) tier.valueUsd = (tier.valueUsd ?? 0) + v;
    if (c != null) tier.costUsd = (tier.costUsd ?? 0) + c;
    if (pl != null) tier.plUsd = (tier.plUsd ?? 0) + pl;
  }
  return [...map.values()].sort((a, b) => {
    if (a.isGraded !== b.isGraded) return a.isGraded ? -1 : 1;
    // Graded tiers: high grade first. Raw tiers: most valuable first
    // (their grades are placeholders, so value is the honest ordering).
    if (a.isGraded) return Number(b.grade) - Number(a.grade);
    return (b.valueUsd ?? 0) - (a.valueUsd ?? 0);
  });
}

/** Tint for a tier — grade color for slabs, muted ink ramp for raw. */
function tierTint(tier: HoldingTier, p: ReturnType<typeof useThemedPalette>): string {
  if (tier.isGraded) {
    const g = Number(tier.grade);
    return gradeColor(Number.isFinite(g) ? g : 0);
  }
  return p.ink.muted;
}

export interface CardOwnershipSectionProps {
  cardId: string;
  /** Prefill for the "Add another copy" quick action (grade form). */
  cardName?: string;
  cardImage?: string;
  cardSet?: string;
  cardYear?: number;
}

export function CardOwnershipSection({
  cardId,
  cardName,
  cardImage,
  cardSet,
  cardYear,
}: CardOwnershipSectionProps) {
  const p = useThemedPalette();
  const { data } = useCardOwnership(cardId);
  const [openTiers, setOpenTiers] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const holdings = data?.holdings;
  const tiers = useMemo(() => buildTiers(holdings ?? []), [holdings]);

  if (!data || !data.owned || !holdings || holdings.length === 0) return null;

  const costBasis = num(data.cost_basis_usd);
  const value = num(data.holding_value_usd);
  const pl = num(data.unrealized_pl_usd);
  const plPct = data.unrealized_pl_pct;

  // Collapse a deep position to the top tiers until the user opts to see all.
  const visibleTiers = showAll ? tiers : tiers.slice(0, VISIBLE_TIERS);

  // Best (highest-value) tier — surfaced as the headline "top holding" stat.
  const topTier = tiers[0] ?? null;
  const plUp = (pl ?? 0) >= 0;

  const toggleTier = (key: string) =>
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <View style={{ gap: 14 }}>
      {/* Section eyebrow */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Layers size={14} color={p.ink.dim} strokeWidth={2.25} />
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Your Position
        </Text>
      </View>

      {/* ── Hero card — value + P/L, then a clean 3-cell stat strip ── */}
      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, 0.22),
          backgroundColor: p.bg.sunken,
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -60,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: withAlpha(p.accent.mint, 0.06),
          }}
        />
        <View style={{ padding: 18, gap: 16 }}>
          {/* Value + P/L pill */}
          <View>
            <Text
              style={{
                color: p.ink.dim,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 1.8,
              }}
            >
              POSITION VALUE
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 4,
              }}
            >
              {value != null ? (
                <Price
                  usd={value}
                  className="text-[30px] font-extrabold tracking-tight text-ink"
                />
              ) : (
                <Text style={{ color: p.ink.muted, fontSize: 30, fontWeight: "800" }}>
                  —
                </Text>
              )}
              {pl != null ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: withAlpha(
                      plUp ? p.accent.mint : p.accent.rose,
                      0.14,
                    ),
                  }}
                >
                  <Text
                    style={{
                      color: plUp ? p.accent.mint : p.accent.rose,
                      fontSize: 12.5,
                      fontWeight: "800",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {plUp ? "▲" : "▼"} {plUp ? "+" : "−"}
                    <PlainMoney usd={Math.abs(pl)} />
                    {plPct != null ? ` (${plPct >= 0 ? "+" : ""}${plPct.toFixed(1)}%)` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 3-cell stat strip — cost basis · copies · top tier */}
          <View
            style={{
              flexDirection: "row",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: withAlpha(p.line.default, 0.7),
              backgroundColor: withAlpha(p.bg.base, 0.4),
              overflow: "hidden",
            }}
          >
            <HeroStat
              label="Cost basis"
              value={
                costBasis != null ? (
                  <Price usd={costBasis} className="text-[15px] font-extrabold text-ink" />
                ) : (
                  "—"
                )
              }
            />
            <HeroStat
              label="Copies"
              value={`${data.copies}`}
              divider
            />
            <HeroStat
              label={topTier?.isGraded ? "Top grade" : "Best tier"}
              value={topTier ? topTier.label : "—"}
              tint={topTier ? tierTint(topTier, p) : undefined}
              divider
            />
          </View>

          {costBasis == null ? (
            <Text style={{ color: p.ink.dim, fontSize: 10.5, fontWeight: "600" }}>
              Add what you paid to a copy to unlock cost basis & P/L — tap any
              row below.
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Breakdown by grade tier — a compact, dense list (grade · count ·
           value), capped to VISIBLE_TIERS with a show-all toggle. ── */}
      <View style={{ gap: 8 }}>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          {tiers.length === 1 ? "Holding" : "By grade"}
        </Text>
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            overflow: "hidden",
            paddingHorizontal: 14,
          }}
        >
          {visibleTiers.map((tier, i) => {
            const single = tier.holdings.length === 1;
            const open = openTiers.has(tier.key);
            return (
              <View key={tier.key}>
                <TierRow
                  tier={tier}
                  bordered={i > 0}
                  expandable={!single}
                  open={open}
                  onPress={() =>
                    single
                      ? router.push(routes.gradeEdit(tier.holdings[0]!.holding_id))
                      : toggleTier(tier.key)
                  }
                />
                {open && !single
                  ? tier.holdings.map((h) => <CopyRow key={h.holding_id} h={h} />)
                  : null}
              </View>
            );
          })}

          {tiers.length > VISIBLE_TIERS ? (
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                showAll ? "Show fewer grades" : `Show all ${tiers.length} grades`
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: withAlpha(p.line.default, 0.6),
                backgroundColor: pressed ? p.bg.sunken : "transparent",
              })}
            >
              <Text style={{ color: p.accent.mint, fontSize: 11.5, fontWeight: "800" }}>
                {showAll ? "Show less" : `Show all ${tiers.length} grades`}
              </Text>
              {showAll ? (
                <ChevronUp size={14} color={p.accent.mint} strokeWidth={2.75} />
              ) : (
                <ChevronDown size={14} color={p.accent.mint} strokeWidth={2.75} />
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Quick path to grow the position — prefilled grade form. */}
        <Pressable
          onPress={() =>
            router.push(
              routes.gradeNew({
                cardId,
                cardName,
                cardImage,
                cardSet,
                cardYear,
              }),
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Add another copy of this card"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            paddingVertical: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.3),
            backgroundColor: withAlpha(p.accent.mint, 0.06),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Plus size={14} color={p.accent.mint} strokeWidth={2.75} />
          <Text style={{ color: p.accent.mint, fontSize: 13, fontWeight: "800" }}>
            Add another copy
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One cell of the hero stat strip. */
function HeroStat({
  label,
  value,
  tint,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  tint?: string;
  divider?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 11,
        gap: 3,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: withAlpha(p.line.default, 0.7),
      }}
    >
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 8.5,
          fontWeight: "800",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text
          numberOfLines={1}
          style={{
            color: tint ?? p.ink.default,
            fontSize: 15,
            fontWeight: "800",
          }}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/* ─── rows ────────────────────────────────────────────────────────────── */

/**
 * One grade tier as a compact, single-line row — colored grade · ×count on the
 * left, value (+ per-each or P/L) on the right. No repeated card art: the whole
 * section is one card, so the grade is the identity. Multi-copy tiers expand
 * into per-copy rows; single-copy tiers open the holding editor.
 */
function TierRow({
  tier,
  bordered,
  expandable,
  open,
  onPress,
}: {
  tier: HoldingTier;
  bordered: boolean;
  expandable: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const { format } = useMoney();
  const tint = tierTint(tier, p);
  const count = tier.holdings.length;
  const perEa = tier.valueUsd != null && count > 1 ? tier.valueUsd / count : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        expandable
          ? `${tier.label}, ${count} copies. ${open ? "Collapse" : "Expand"}.`
          : `${tier.label}. Open holding.`
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 11,
        borderTopWidth: bordered ? 1 : 0,
        borderTopColor: withAlpha(p.line.default, 0.55),
        backgroundColor: pressed ? p.bg.sunken : "transparent",
      })}
    >
      {/* Grade — the row's identity, carried by color. */}
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint }} />
      <Text style={{ color: tint, fontSize: 13, fontWeight: "800" }}>{tier.label}</Text>
      {count > 1 ? (
        <Text style={{ color: p.ink.muted, fontSize: 11.5, fontWeight: "700" }}>
          ×{count}
        </Text>
      ) : null}

      <View style={{ flex: 1 }} />

      {/* Value, with per-each or P/L tucked beneath it. */}
      <View style={{ alignItems: "flex-end" }}>
        {tier.valueUsd != null ? (
          <Price
            usd={tier.valueUsd}
            style={{
              color: p.ink.default,
              fontSize: 14,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          />
        ) : (
          <Text style={{ color: p.ink.muted, fontSize: 14, fontWeight: "800" }}>—</Text>
        )}
        {tier.plUsd != null ? (
          <SignedMoney usd={tier.plUsd} pct={null} size={10.5} />
        ) : perEa != null ? (
          <Text style={{ color: p.ink.dim, fontSize: 10.5, fontVariant: ["tabular-nums"] }}>
            {format(perEa)} ea
          </Text>
        ) : null}
      </View>

      {expandable ? (
        open ? (
          <ChevronUp size={15} color={p.ink.dim} />
        ) : (
          <ChevronDown size={15} color={p.ink.dim} />
        )
      ) : (
        <ChevronRight size={15} color={p.ink.dim} />
      )}
    </Pressable>
  );
}

/** One expanded copy inside a tier — tap opens that holding's editor. */
function CopyRow({ h }: { h: CardHoldingWire }) {
  const p = useThemedPalette();
  const { format } = useMoney();
  const cost = num(h.purchase_price_usd);
  const value = num(h.estimated_value_usd);
  const pl = num(h.unrealized_pl_usd);
  const acq = h.acquired_via ? ACQUIRED[h.acquired_via] : null;

  const metaBits = [
    acq?.label ?? null,
    h.days_held != null ? `${h.days_held}d held` : null,
    cost != null ? `cost ${format(cost)}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push(routes.gradeEdit(h.holding_id))}
      accessibilityRole="button"
      accessibilityLabel="Open this copy"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 10,
        paddingRight: 4,
        paddingLeft: 27,
        backgroundColor: pressed ? p.bg.sunken : "transparent",
        borderRadius: pressed ? 10 : 0,
      })}
    >
      {acq ? <acq.Icon size={12} color={p.ink.dim} strokeWidth={2.25} /> : null}
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: p.ink.muted, fontSize: 11.5, fontWeight: "600" }}
      >
        {metaBits.length > 0 ? metaBits.join(" · ") : "Copy"}
      </Text>
      {value != null ? (
        <Price usd={value} className="text-[12.5px] font-bold text-ink" />
      ) : null}
      {pl != null ? <SignedMoney usd={pl} pct={h.unrealized_pl_pct} size={11} /> : null}
      <ChevronRight size={13} color={p.ink.dim} />
    </Pressable>
  );
}

/* ─── atoms ───────────────────────────────────────────────────────────── */

/** Plain converted money inside a colored Text run (inherits parent color). */
function PlainMoney({ usd }: { usd: number }) {
  const { format } = useMoney();
  return <>{format(usd)}</>;
}

/** Signed P/L in the user's display currency (green/red). */
function SignedMoney({ usd, pct, size }: { usd: number; pct?: number | null; size: number }) {
  const p = useThemedPalette();
  const { format } = useMoney();
  const up = usd >= 0;
  return (
    <Text
      style={{
        color: up ? p.accent.mint : p.accent.rose,
        fontSize: size,
        fontWeight: "800",
        fontVariant: ["tabular-nums"],
      }}
    >
      {up ? "+" : "−"}
      {format(Math.abs(usd))}
      {pct != null ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}
    </Text>
  );
}
