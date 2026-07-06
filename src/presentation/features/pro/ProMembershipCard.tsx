/**
 * ProMembershipCard — the Loupe Pro block for Settings (web Settings parity).
 *
 * Three states, all decided by the backend entitlements:
 *   • subscriptions off  → renders nothing (no dangling CTA)
 *   • free               → compact pitch + "Upgrade" (opens the paywall)
 *   • pro / trialing     → membership status + "Manage billing" (Stripe portal)
 */
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { usePro } from "./ProProvider";
import { FREE_CARD_LIMIT } from "./proPlan";

export function ProMembershipCard() {
  const p = useThemedPalette();
  const {
    subscriptionsEnabled,
    isPro,
    trialing,
    entitlements,
    cardCount,
    cardLimit,
    openPaywall,
    manageBilling,
    billingBusy,
  } = usePro();

  if (!subscriptionsEnabled) return null;

  const tone = isPro ? (trialing ? p.accent.amber : p.accent.mint) : p.accent.mint;
  const since = entitlements?.pro_since
    ? new Date(entitlements.pro_since).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <View className="px-5 pb-4">
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: withAlpha(tone, 0.3),
          backgroundColor: withAlpha(tone, 0.05),
          padding: 16,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(tone, 0.14),
            }}
          >
            <Sparkles size={16} color={tone} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "800" }}>
              {isPro ? (trialing ? "Loupe Pro · Trial" : "Loupe Pro") : "Loupe Free"}
            </Text>
            <Text style={{ color: p.ink.muted, fontSize: 12, marginTop: 1 }}>
              {isPro
                ? trialing
                  ? "Your free trial is active — everything is unlocked."
                  : since
                    ? `Member since ${since} · everything unlocked.`
                    : "Everything unlocked."
                : `${cardCount} of ${cardLimit ?? FREE_CARD_LIMIT} cards used on the free plan.`}
            </Text>
          </View>
        </View>

        {isPro ? (
          <Pressable
            onPress={manageBilling}
            disabled={billingBusy}
            accessibilityRole="button"
            accessibilityLabel="Manage billing"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 11,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              opacity: pressed || billingBusy ? 0.7 : 1,
            })}
          >
            {billingBusy ? (
              <ActivityIndicator size="small" color={p.ink.muted} />
            ) : (
              <>
                <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
                  Manage billing
                </Text>
                <ChevronRight size={14} color={p.ink.muted} />
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => openPaywall("generic")}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Loupe Pro"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: p.accent.mint,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Sparkles size={15} color="#0B0B0D" strokeWidth={2.5} />
            <Text style={{ color: "#0B0B0D", fontSize: 14, fontWeight: "800" }}>
              Upgrade to Pro
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
