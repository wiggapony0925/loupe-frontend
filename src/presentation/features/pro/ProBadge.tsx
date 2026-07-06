/**
 * ProBadge — the persistent Loupe Pro status chip (web `ProPill` parity).
 *
 * • Pro members get a mint "PRO" badge (amber "TRIAL" while trialing).
 * • Free members get a tasteful "Upgrade" pill that opens the paywall.
 * • When subscriptions are switched off entirely, renders nothing.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { usePro } from "./ProProvider";

export function ProBadge() {
  const p = useThemedPalette();
  const { subscriptionsEnabled, isPro, trialing, openPaywall } = usePro();

  if (!subscriptionsEnabled) return null;

  if (isPro) {
    const tone = trialing ? p.accent.amber : p.accent.mint;
    return (
      <View
        accessibilityLabel={trialing ? "Loupe Pro — free trial" : "Loupe Pro member"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: withAlpha(tone, 0.14),
          borderWidth: 1,
          borderColor: withAlpha(tone, 0.35),
        }}
      >
        <Sparkles size={11} color={tone} strokeWidth={2.5} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
          {trialing ? "TRIAL" : "PRO"}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => openPaywall("generic")}
      accessibilityRole="button"
      accessibilityLabel="Upgrade to Loupe Pro"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: withAlpha(p.accent.mint, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(p.accent.mint, 0.3),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Sparkles size={12} color={p.accent.mint} strokeWidth={2.5} />
      <Text style={{ color: p.accent.mint, fontSize: 11, fontWeight: "800" }}>
        Upgrade
      </Text>
    </Pressable>
  );
}
