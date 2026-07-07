/**
 * CardOwnershipSection — the signed-in user's own copies of a card ("Your
 * copies"), from the server-composed `GET /v1/cards/{id}/ownership` (auth).
 *
 * Big collections stay readable: copies are CONSOLIDATED by grade tier
 * (house + grade + condition). Fifteen PSA-10s collapse into one "PSA 10 ×15"
 * row with rolled-up value/P-L; tapping a tier expands its individual copies,
 * and tapping a copy opens that holding's editor (`/grade/[id]`).
 *
 * Renders nothing for guests, non-owners, or before the endpoint returns —
 * safe to mount unconditionally.
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

export function CardOwnershipSection({ cardId }: { cardId: string }) {
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

  const toggleTier = (key: string) =>
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Layers size={14} color={p.ink.dim} strokeWidth={2.25} />
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Your Copies
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "700" }}>
          ×{data.copies}
        </Text>
      </View>

      {/* Rolled-up summary — one flat strip. */}
      {(costBasis != null || value != null) && (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
            <SummaryCell
              label="Cost basis"
              value={costBasis != null ? <Price usd={costBasis} className="text-[15px] font-extrabold text-ink" /> : null}
            />
            <SummaryCell
              label="Value"
              value={value != null ? <Price usd={value} className="text-[15px] font-extrabold text-ink" /> : null}
            />
            <SummaryCell
              label="Unrealized P/L"
              value={pl != null ? <SignedMoney usd={pl} pct={plPct} size={15} /> : null}
            />
          </View>
          {/* No purchase prices yet → P/L can't be computed. Say why and
              point at the fix instead of leaving unexplained dashes. */}
          {costBasis == null ? (
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: withAlpha(p.line.default, 0.7),
                backgroundColor: withAlpha(p.bg.sunken, 0.5),
              }}
            >
              <Text style={{ color: p.ink.dim, fontSize: 10.5, fontWeight: "600" }}>
                Add what you paid to a copy to unlock cost basis & P/L — tap any
                copy below.
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Consolidated grade tiers. A single-copy tier is itself the row —
          tap goes straight to the holding editor, no pointless expander. */}
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          overflow: "hidden",
        }}
      >
        {tiers.map((tier, i) => {
          const single = tier.holdings.length === 1;
          const open = openTiers.has(tier.key);
          return (
            <View key={tier.key} style={i > 0 ? { borderTopWidth: 1, borderTopColor: withAlpha(p.line.default, 0.7) } : undefined}>
              <TierRow
                tier={tier}
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
      </View>
    </View>
  );
}

/* ─── rows ────────────────────────────────────────────────────────────── */

function TierRow({
  tier,
  expandable,
  open,
  onPress,
}: {
  tier: HoldingTier;
  expandable: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const gradeNum = Number(tier.grade);
  const tint = tier.isGraded
    ? gradeColor(Number.isFinite(gradeNum) ? gradeNum : 0)
    : p.ink.muted;
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
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: pressed ? p.bg.sunken : "transparent",
      })}
    >
      {/* Grade badge */}
      <View
        style={{
          minWidth: 54,
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 9,
          backgroundColor: withAlpha(tint, 0.14),
        }}
      >
        <Text style={{ color: tint, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
          {tier.label}
        </Text>
      </View>

      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        {count > 1 ? (
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: withAlpha(p.ink.muted, 0.12),
            }}
          >
            <Text style={{ color: p.ink.muted, fontSize: 11, fontWeight: "800" }}>
              ×{count}
            </Text>
          </View>
        ) : null}
        {tier.isGraded ? (
          <ShieldCheck size={12} color={p.accent.mint} strokeWidth={2.5} />
        ) : null}
        <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>
          {count > 1 ? "copies" : tier.isGraded ? "graded" : "raw"}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 1 }}>
        {tier.valueUsd != null ? (
          <Price usd={tier.valueUsd} className="text-[14px] font-extrabold text-ink" />
        ) : (
          <Text style={{ color: p.ink.muted, fontSize: 14, fontWeight: "800" }}>—</Text>
        )}
        {tier.plUsd != null ? <SignedMoney usd={tier.plUsd} size={11} /> : null}
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
        paddingRight: 12,
        paddingLeft: 24,
        backgroundColor: pressed ? p.bg.sunken : withAlpha(p.bg.sunken, 0.45),
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

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  const p = useThemedPalette();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: p.ink.dim, fontSize: 9, letterSpacing: 1.1, fontWeight: "700" }}>
        {label.toUpperCase()}
      </Text>
      {value ?? <Text style={{ color: p.ink.muted, fontSize: 15, fontWeight: "800" }}>—</Text>}
    </View>
  );
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
