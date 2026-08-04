/**
 * CardValuationPanel — "Loupe Value" and the working behind it.
 *
 * The card page already shows a market price, but a single number can't be
 * checked. This shows the backend's equilibrium fair value alongside the three
 * independent signals it was built from — recent sold comps, live listings,
 * and the catalog price — plus a confidence read. When those three disagree,
 * that disagreement IS the useful information: a card whose asks sit well
 * above its sales is one to be careful about.
 *
 * Renders nothing until there's a fair value. The endpoint is public but slow
 * (~2s upstream), so this fills in after the page rather than holding it up,
 * and simply stays absent for cards the valuation service can't price.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { Price } from "@/presentation/components/Price";
import { useCardValuation } from "@/application/queries/catalog/useCardValuation";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { confidenceLabel, hasFairValue, usableSignals } from "./cardValuationRules";

export function CardValuationPanel({ cardId }: { cardId: string | null }) {
  const p = useThemedPalette();
  const { data } = useCardValuation(cardId);

  if (!hasFairValue(data)) return null;
  const fair = data!.fair_value!.amount;
  const conf = confidenceLabel(data?.confidence);
  const rows = usableSignals(data);

  return (
    <View
      style={[
        styles.card,
        { borderColor: p.line.default, backgroundColor: p.bg.elevated },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: withAlpha(p.accent.mint, 0.14) },
          ]}
        >
          <ShieldCheck size={13} color={p.accent.mint} strokeWidth={2.5} />
        </View>
        <Text style={[styles.title, { color: p.ink.default }]}>Loupe Value</Text>
        {conf ? (
          <Text style={[styles.confidence, { color: p.ink.dim }]}>{conf}</Text>
        ) : null}
      </View>

      <Price usd={fair} className="text-[26px] font-extrabold text-ink" />
      <Text style={[styles.caption, { color: p.ink.muted }]}>
        One fair value, reconciled from the sources below.
      </Text>

      {/* Three numbers across, not three stacked rows. As a list this cost
          about 150pt of scroll on the most contested page in the app, and
          — worse — reading three prices meant three separate eye movements
          when the entire point is comparing them at a glance. Side by side,
          a spread between asks and actual sales is visible instantly. */}
      {rows.length > 0 ? (
        <View style={[styles.signals, { borderTopColor: p.line.default }]}>
          {rows.map((r, i) => (
            <View
              key={r.key}
              // The explanatory line no longer fits on screen, so it becomes
              // the accessible name — a screen reader still hears "what
              // copies actually sold for" rather than a bare "Sold comps".
              accessible
              accessibilityLabel={`${r.label}: ${r.hint}`}
              style={[
                styles.signalCell,
                i > 0 ? { borderLeftWidth: 1, borderLeftColor: p.line.default } : null,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[styles.signalLabel, { color: p.ink.dim }]}
              >
                {r.label.toUpperCase()}
              </Text>
              <Price usd={r.amount} className="text-[15px] font-bold text-ink" />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  confidence: { fontSize: 11, marginLeft: "auto" },
  caption: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  signals: {
    flexDirection: "row",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  signalCell: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 4 },
  signalLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.9 },
});
