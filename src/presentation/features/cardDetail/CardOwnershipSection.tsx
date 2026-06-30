/**
 * CardOwnershipSection — the signed-in user's own copies of a card ("Your
 * copies"), from the server-composed `GET /v1/cards/{id}/ownership` (auth).
 * Mirrors the web OwnershipPanel: per-copy grade, graded-vs-raw, acquisition
 * source, days held, cost/value/P-L, plus a rolled-up summary.
 *
 * Renders nothing for guests, non-owners, or before the endpoint returns —
 * safe to mount unconditionally.
 */
import React from "react";
import { Text, View } from "react-native";
import { Layers, ScanLine, PencilLine, Upload, ShieldCheck } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { Price } from "@/presentation/components/Price";
import { useCardOwnership } from "@/application/queries/collection/useCardOwnership";
import type { AcquisitionSource, CardHoldingWire } from "@/infrastructure/http";

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function gradeLabel(house: string, grade: string, condition: string | null): string {
  if (house === "loupe") return `RAW${condition ? ` ${condition.toUpperCase()}` : ""}`;
  const n = Number(grade);
  const g = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${house.toUpperCase()} ${g}`;
}

const ACQUIRED: Record<AcquisitionSource, { label: string; Icon: typeof ScanLine }> = {
  scan: { label: "Scanned", Icon: ScanLine },
  manual: { label: "Added", Icon: PencilLine },
  import: { label: "Imported", Icon: Upload },
};

export function CardOwnershipSection({ cardId }: { cardId: string }) {
  const p = useThemedPalette();
  const { data } = useCardOwnership(cardId);

  if (!data || !data.owned || data.holdings.length === 0) return null;

  const costBasis = num(data.cost_basis_usd);
  const value = num(data.holding_value_usd);
  const pl = num(data.unrealized_pl_usd);
  const plPct = data.unrealized_pl_pct;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Layers size={14} color={p.ink.dim} strokeWidth={2.25} />
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Your Copies
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "700" }}>
          ×{data.copies}
        </Text>
      </View>

      {(costBasis != null || value != null) && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
          }}
        >
          <SummaryCell label="Cost basis" value={costBasis != null ? <Price usd={costBasis} className="text-[15px] font-extrabold text-ink" /> : null} />
          <SummaryCell label="Value" value={value != null ? <Price usd={value} className="text-[15px] font-extrabold text-ink" /> : null} />
          <SummaryCell
            label="Unrealized P/L"
            value={
              pl != null ? (
                <Text style={{ color: pl >= 0 ? p.accent.mint : p.accent.rose, fontSize: 15, fontWeight: "800" }}>
                  {pl >= 0 ? "+" : "−"}
                  {Math.abs(pl).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                  {plPct != null ? ` (${plPct >= 0 ? "+" : ""}${plPct.toFixed(1)}%)` : ""}
                </Text>
              ) : null
            }
          />
        </View>
      )}

      <View style={{ gap: 8 }}>
        {data.holdings.map((h) => (
          <HoldingRow key={h.holding_id} h={h} />
        ))}
      </View>
    </View>
  );
}

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

function HoldingRow({ h }: { h: CardHoldingWire }) {
  const p = useThemedPalette();
  const cost = num(h.purchase_price_usd);
  const value = num(h.estimated_value_usd);
  const pl = num(h.unrealized_pl_usd);
  const acq = h.acquired_via ? ACQUIRED[h.acquired_via] : null;
  const badgeColor = h.is_graded ? p.accent.mint : p.ink.muted;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: withAlpha(badgeColor, 0.14),
          }}
        >
          <Text style={{ color: badgeColor, fontSize: 12, fontWeight: "800" }}>
            {gradeLabel(h.house, h.grade, h.condition)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {h.is_graded ? (
            <Tag icon={<ShieldCheck size={10} color={p.accent.mint} strokeWidth={2.5} />} label="Graded" color={p.accent.mint} />
          ) : (
            <Tag label="Raw" color={p.ink.muted} />
          )}
          {acq ? <Tag icon={<acq.Icon size={10} color={p.ink.muted} strokeWidth={2.5} />} label={acq.label} color={p.ink.muted} /> : null}
          {h.days_held != null ? <Tag label={`${h.days_held}d held`} color={p.ink.muted} /> : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 14 }}>
        <Fig label="Cost" value={cost != null ? <Price usd={cost} className="text-[13px] font-bold text-ink" /> : null} />
        <Fig label="Value" value={value != null ? <Price usd={value} className="text-[13px] font-bold text-ink" /> : null} />
        <Fig
          label="P/L"
          value={
            pl != null ? (
              <Text style={{ color: pl >= 0 ? p.accent.mint : p.accent.rose, fontSize: 13, fontWeight: "800" }}>
                {pl >= 0 ? "+" : "−"}
                {h.unrealized_pl_pct != null
                  ? `${Math.abs(h.unrealized_pl_pct).toFixed(0)}%`
                  : Math.abs(pl).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              </Text>
            ) : null
          }
        />
      </View>
    </View>
  );
}

function Tag({ icon, label, color }: { icon?: React.ReactNode; label: string; color: string }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: color === p.accent.mint ? withAlpha(color, 0.35) : p.line.default,
      }}
    >
      {icon}
      <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function Fig({ label, value }: { label: string; value: React.ReactNode }) {
  const p = useThemedPalette();
  return (
    <View style={{ alignItems: "flex-end", gap: 1, minWidth: 48 }}>
      <Text style={{ color: p.ink.dim, fontSize: 9, letterSpacing: 0.8, fontWeight: "700" }}>
        {label.toUpperCase()}
      </Text>
      {value ?? <Text style={{ color: p.ink.muted, fontSize: 13, fontWeight: "700" }}>—</Text>}
    </View>
  );
}
