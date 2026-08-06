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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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
      {/*
        Flat, ruled block — no card, no glow.
        This carried a tinted fill, a mint border AND two 200pt offscreen
        colour blobs bleeding through it. On a screen of otherwise plain rows
        it was doing three decorative things at once and read as a template
        rather than as your membership. A single hairline above it separates
        it from the stats; the mint is spent on the wordmark and the ticks,
        where it means something.
      */}
      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.line.default,
        }}
      >
        <View style={{ paddingVertical: 18, gap: 14 }}>
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
              // A statement, not a control. Boxed and centred it looked like
              // a button that does nothing when tapped — the one thing a
              // status line must never look like.
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingTop: 2,
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
              style={({ pressed }) => [{
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
              }]}
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
                style={({ pressed }) => [{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  paddingVertical: 13,
                  borderRadius: 13,
                  backgroundColor: p.accent.mint,
                  opacity: pressed ? 0.85 : 1,
                }]}
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
