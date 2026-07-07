/**
 * CardOwnershipSection — "Your position" in this card, from the
 * server-composed `GET /v1/cards/{id}/ownership` (auth).
 *
 * Robinhood-position-panel treatment:
 *   • Hero panel (statement metal-card aesthetic): position value big,
 *     colored P/L, cost basis + copies meta, and a stacked SHARE BAR
 *     showing how the position's value splits across grade tiers.
 *   • Tier rows keyed to the bar by colored dots: grade chip · count ·
 *     value · share %. Single-copy tiers open the holding editor
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
  ShieldCheck,
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

  const holdings = data?.holdings;
  const tiers = useMemo(() => buildTiers(holdings ?? []), [holdings]);

  if (!data || !data.owned || !holdings || holdings.length === 0) return null;

  const costBasis = num(data.cost_basis_usd);
  const value = num(data.holding_value_usd);
  const pl = num(data.unrealized_pl_usd);
  const plPct = data.unrealized_pl_pct;

  // Share-of-position per tier (drives the stacked bar + the % column).
  const valuedTotal = tiers.reduce((s, t) => s + (t.valueUsd ?? 0), 0);
  const shareOf = (t: HoldingTier) =>
    valuedTotal > 0 && t.valueUsd != null ? (t.valueUsd / valuedTotal) * 100 : null;

  const toggleTier = (key: string) =>
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Layers size={14} color={p.ink.dim} strokeWidth={2.25} />
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Your Position
        </Text>
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.14),
          }}
        >
          <Text style={{ color: p.accent.mint, fontSize: 10, fontWeight: "800" }}>
            ×{data.copies} {data.copies === 1 ? "copy" : "copies"}
          </Text>
        </View>
      </View>

      {/* ── Hero panel — statement metal-card aesthetic ── */}
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, 0.25),
          backgroundColor: p.bg.sunken,
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 190,
            height: 190,
            borderRadius: 95,
            backgroundColor: withAlpha(p.accent.mint, 0.07),
          }}
        />
        <View style={{ padding: 16, gap: 12 }}>
          <View>
            <Text
              style={{
                color: p.ink.dim,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 1.6,
              }}
            >
              POSITION VALUE
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                flexWrap: "wrap",
                columnGap: 10,
                marginTop: 3,
              }}
            >
              {value != null ? (
                <Price
                  usd={value}
                  className="text-[28px] font-extrabold tracking-tight text-ink"
                />
              ) : (
                <Text style={{ color: p.ink.muted, fontSize: 28, fontWeight: "800" }}>
                  —
                </Text>
              )}
              {pl != null ? (
                <View style={{ paddingBottom: 4 }}>
                  <SignedMoney usd={pl} pct={plPct} size={13} />
                </View>
              ) : null}
            </View>
            <Text style={{ color: p.ink.muted, fontSize: 11.5, marginTop: 3 }}>
              {costBasis != null ? (
                <>
                  Cost basis <Price usd={costBasis} className="text-[11.5px] font-bold text-ink" />
                  {" · "}
                </>
              ) : null}
              {data.copies} {data.copies === 1 ? "copy" : "copies"} across{" "}
              {tiers.length} {tiers.length === 1 ? "tier" : "tiers"}
            </Text>
          </View>

          {/* Stacked tier share bar — how the position's value splits. */}
          {valuedTotal > 0 ? (
            <View
              style={{
                flexDirection: "row",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                backgroundColor: withAlpha(p.ink.muted, 0.14),
              }}
            >
              {tiers.map((t) => {
                const share = shareOf(t);
                if (share == null || share <= 0) return null;
                return (
                  <View
                    key={t.key}
                    style={{
                      width: `${share}%`,
                      backgroundColor: tierTint(t, p),
                      borderRightWidth: 1,
                      borderRightColor: p.bg.sunken,
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {/* No purchase prices yet → P/L can't be computed. Say why and
              point at the fix instead of leaving unexplained dashes. */}
          {costBasis == null ? (
            <Text style={{ color: p.ink.dim, fontSize: 10.5, fontWeight: "600" }}>
              Add what you paid to a copy to unlock cost basis & P/L — tap any
              tier below.
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Tier rows — flat, hairline-separated, keyed to the bar ── */}
      <View>
        {tiers.map((tier, i) => {
          const single = tier.holdings.length === 1;
          const open = openTiers.has(tier.key);
          return (
            <View key={tier.key}>
              <TierRow
                tier={tier}
                sharePct={shareOf(tier)}
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
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 2,
            borderTopWidth: 1,
            borderTopColor: withAlpha(p.line.default, 0.6),
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(p.accent.mint, 0.14),
            }}
          >
            <Plus size={13} color={p.accent.mint} strokeWidth={2.75} />
          </View>
          <Text style={{ flex: 1, color: p.accent.mint, fontSize: 13.5, fontWeight: "700" }}>
            Add another copy
          </Text>
          <ChevronRight size={15} color={p.ink.dim} />
        </Pressable>
      </View>
    </View>
  );
}

/* ─── rows ────────────────────────────────────────────────────────────── */

function TierRow({
  tier,
  sharePct,
  bordered,
  expandable,
  open,
  onPress,
}: {
  tier: HoldingTier;
  sharePct: number | null;
  bordered: boolean;
  expandable: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const tint = tierTint(tier, p);
  const count = tier.holdings.length;

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
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 2,
        borderTopWidth: bordered ? 1 : 0,
        borderTopColor: withAlpha(p.line.default, 0.6),
        backgroundColor: pressed ? p.bg.elevated : "transparent",
        borderRadius: pressed ? 10 : 0,
      })}
    >
      {/* Legend dot keyed to the hero share bar */}
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tint }} />

      {/* Tier identity */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: p.ink.default, fontSize: 14.5, fontWeight: "800" }}>
            {tier.label}
          </Text>
          {count > 1 ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1.5,
                borderRadius: 999,
                backgroundColor: withAlpha(tint, 0.14),
              }}
            >
              <Text style={{ color: tint, fontSize: 10, fontWeight: "800" }}>
                ×{count}
              </Text>
            </View>
          ) : null}
          {tier.isGraded ? (
            <ShieldCheck size={12} color={p.accent.mint} strokeWidth={2.5} />
          ) : null}
        </View>
        <Text style={{ color: p.ink.dim, fontSize: 10.5, fontWeight: "600" }}>
          {sharePct != null ? `${sharePct.toFixed(0)}% of position` : count > 1 ? "copies" : tier.isGraded ? "graded slab" : "raw"}
          {count > 1 && tier.valueUsd != null ? (
            <Text style={{ color: p.ink.dim, fontSize: 10.5, fontWeight: "600" }}>
              {" · avg "}
              <PlainMoney usd={tier.valueUsd / count} />
              {"/copy"}
            </Text>
          ) : null}
          {tier.plUsd != null ? " · " : ""}
          {tier.plUsd != null ? (
            <Text
              style={{
                color: tier.plUsd >= 0 ? p.accent.mint : p.accent.rose,
                fontSize: 10.5,
                fontWeight: "700",
              }}
            >
              {tier.plUsd >= 0 ? "+" : "−"}
              <PlainMoney usd={Math.abs(tier.plUsd)} />
            </Text>
          ) : null}
        </Text>
      </View>

      {/* Value */}
      <View style={{ alignItems: "flex-end" }}>
        {tier.valueUsd != null ? (
          <Price usd={tier.valueUsd} className="text-[15px] font-extrabold text-ink" />
        ) : (
          <Text style={{ color: p.ink.muted, fontSize: 15, fontWeight: "800" }}>—</Text>
        )}
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
