/**
 * ProUsageBanner — a calm "X of 50 cards" meter for the top of the Vault.
 *
 * Only appears for free users (when gating is on) who are nearing the cap,
 * and never for Pro or when subscriptions are off. Sells the upgrade with a
 * fact, not fear — mirrors the web banner (80% nudge threshold).
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { usePro } from "./ProProvider";

/** Show the meter only once the free user is genuinely close to the cap. */
const NUDGE_AT = 0.8;

export function ProUsageBanner() {
  const p = useThemedPalette();
  const { gatingActive, cardCount, cardLimit, openPaywall } = usePro();

  if (!gatingActive || cardLimit == null) return null;
  const ratio = cardCount / cardLimit;
  if (ratio < NUDGE_AT) return null;

  const atLimit = cardCount >= cardLimit;
  const pct = Math.min(100, Math.round(ratio * 100));
  const tone = atLimit ? p.accent.amber : p.accent.mint;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: withAlpha(tone, 0.3),
        backgroundColor: withAlpha(tone, 0.06),
      }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "800" }}>
            {cardCount} of {cardLimit} cards
          </Text>
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: p.ink.muted, fontSize: 11, fontWeight: "600" }}
          >
            {atLimit ? "Free limit reached — go unlimited." : "You're close to the free limit."}
          </Text>
        </View>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: withAlpha(p.ink.muted, 0.15),
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: tone,
            }}
          />
        </View>
      </View>
      <Pressable
        onPress={() => openPaywall("card_limit")}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Loupe Pro"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: atLimit ? p.accent.mint : withAlpha(p.accent.mint, 0.14),
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Sparkles size={13} color={atLimit ? "#0B0B0D" : p.accent.mint} strokeWidth={2.5} />
        <Text
          style={{
            color: atLimit ? "#0B0B0D" : p.accent.mint,
            fontSize: 12,
            fontWeight: "800",
          }}
        >
          Upgrade
        </Text>
      </Pressable>
    </View>
  );
}
