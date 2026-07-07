/**
 * ProMembershipCard — the Loupe Pro block for Settings (web Settings parity).
 *
 * Rendered as a premium "membership card": dark sheen surface (same visual
 * language as the statements hero), LOUPE PRO wordmark, glow-dot status chip,
 * and a state-aware body:
 *
 *   • subscriptions off  → renders nothing (no dangling CTA)
 *   • free               → usage meter toward the free cap + benefits grid
 *                          + full-width "Upgrade" CTA (opens the paywall)
 *   • trialing           → trial status + benefits + "Manage billing"
 *   • pro                → member-since + benefits + "Manage billing"
 */
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, ChevronRight, Sparkles } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useBillingConfig } from "@/application/queries";
import { usePro } from "./ProProvider";
import { FREE_CARD_LIMIT, PRO_FEATURES, PRO_PRICE_MONTHLY } from "./proPlan";

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

  // Stripe self-serve is only real when the backend reports a configured
  // checkout. Admin-granted Pro (or an unprovisioned Stripe) has no customer
  // portal — offering a "Manage billing" button there just errors.
  const { data: billing } = useBillingConfig(subscriptionsEnabled && isPro);
  const selfServeBilling = billing?.checkout_available === true;

  if (!subscriptionsEnabled) return null;

  const since = entitlements?.pro_since
    ? new Date(entitlements.pro_since).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const limit = cardLimit ?? FREE_CARD_LIMIT;
  const ratio = limit > 0 ? Math.min(1, cardCount / limit) : 0;
  const nearCap = !isPro && ratio >= 0.8;
  const atCap = !isPro && cardCount >= limit;
  const meterTone = atCap ? p.accent.rose : nearCap ? p.accent.amber : p.accent.mint;

  const statusLabel = isPro ? (trialing ? "TRIAL" : "PRO") : "FREE";
  const statusTone = isPro ? (trialing ? p.accent.amber : p.accent.mint) : p.ink.muted;

  return (
    <View className="px-5 pb-4">
      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, isPro ? 0.35 : 0.22),
          backgroundColor: p.bg.sunken,
          overflow: "hidden",
        }}
      >
        {/* Sheen / glow accents (same metal-card vibe as statements) */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: withAlpha(p.accent.mint, isPro ? 0.1 : 0.06),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -70,
            left: -50,
            width: 190,
            height: 190,
            borderRadius: 95,
            backgroundColor: withAlpha(p.accent.blue, 0.05),
          }}
        />

        <View style={{ padding: 18, gap: 14 }}>
          {/* Wordmark row + status chip */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} color={p.accent.mint} strokeWidth={2.5} />
              <Text
                style={{
                  color: p.accent.mint,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 3.5,
                }}
              >
                LOUPE PRO
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 9,
                paddingVertical: 3.5,
                borderRadius: 999,
                backgroundColor: withAlpha(statusTone, 0.13),
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: statusTone,
                  shadowColor: statusTone,
                  shadowOpacity: isPro ? 0.7 : 0,
                  shadowRadius: 3,
                }}
              />
              <Text
                style={{
                  color: statusTone,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 2,
                }}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Headline + status line */}
          <View style={{ gap: 3 }}>
            <Text
              style={{
                color: p.ink.default,
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              {isPro
                ? trialing
                  ? "Your free trial is live"
                  : "You're a Pro member"
                : "Your collection, unlimited"}
            </Text>
            <Text style={{ color: p.ink.muted, fontSize: 12.5, lineHeight: 18 }}>
              {isPro
                ? trialing
                  ? "Everything is unlocked while you try Loupe Pro."
                  : since
                    ? `Member since ${since} — everything unlocked.`
                    : "Everything unlocked."
                : `Free includes ${limit} cards. Pro removes every cap and automates your vault.`}
            </Text>
          </View>

          {/* Free plan: usage meter toward the cap */}
          {!isPro ? (
            <View style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: p.ink.default, fontSize: 12, fontWeight: "800" }}>
                  {cardCount} of {limit} cards
                </Text>
                <Text style={{ color: meterTone, fontSize: 11, fontWeight: "700" }}>
                  {atCap
                    ? "Limit reached"
                    : nearCap
                      ? "Almost full"
                      : `${Math.max(0, limit - cardCount)} left`}
                </Text>
              </View>
              <View
                style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: withAlpha(p.ink.muted, 0.16),
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${Math.max(2, Math.round(ratio * 100))}%`,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: meterTone,
                  }}
                />
              </View>
            </View>
          ) : null}

          {/* Benefits — 2-up grid, checkmarks for Pro, plain for free */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 9 }}>
            {PRO_FEATURES.slice(0, 4).map((f) => (
              <View
                key={f.key}
                style={{
                  width: "50%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingRight: 8,
                }}
              >
                {isPro ? (
                  <Check size={13} color={p.accent.mint} strokeWidth={3} />
                ) : (
                  <f.icon size={13} color={p.accent.mint} strokeWidth={2.25} />
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: isPro ? p.ink.default : p.ink.muted,
                    fontSize: 11.5,
                    fontWeight: "600",
                  }}
                >
                  {f.title}
                </Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          {isPro && !selfServeBilling ? (
            /* Pro without a Stripe portal (granted plan / billing not yet
               provisioned) — state it plainly instead of a dead-end button. */
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 11,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: p.line.default,
                backgroundColor: p.bg.elevated,
              }}
            >
              <Check size={13} color={p.accent.mint} strokeWidth={3} />
              <Text style={{ color: p.ink.muted, fontSize: 12.5, fontWeight: "700" }}>
                Pro membership active — managed by Loupe
              </Text>
            </View>
          ) : isPro ? (
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
                paddingVertical: 12,
                borderRadius: 13,
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
            <View style={{ gap: 7 }}>
              <Pressable
                onPress={() => openPaywall(atCap ? "card_limit" : "generic")}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Loupe Pro"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  paddingVertical: 13,
                  borderRadius: 13,
                  backgroundColor: p.accent.mint,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Sparkles size={15} color="#0B0B0D" strokeWidth={2.5} />
                <Text style={{ color: "#0B0B0D", fontSize: 14, fontWeight: "800" }}>
                  Upgrade to Pro
                </Text>
              </Pressable>
              <Text
                style={{
                  color: p.ink.dim,
                  fontSize: 10.5,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                From ${PRO_PRICE_MONTHLY.toFixed(2)}/mo · cancel anytime
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
