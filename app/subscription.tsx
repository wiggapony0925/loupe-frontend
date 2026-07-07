/**
 * Manage Subscription — `/subscription`
 *
 * The full Loupe Pro management surface behind Settings → "Manage
 * subscription". Everything renders from the server-computed entitlements
 * (`GET /v1/me/entitlements`) + billing config — the client never decides
 * what's unlocked:
 *
 *   • Membership hero (the shared ProMembershipCard: status, meter, CTA)
 *   • Plan details: plan, price, member-since, renews/expires, trial state
 *   • Usage: cards vs cap, statement allowance
 *   • What Pro includes (full feature ladder, checked by entitlement)
 *   • Actions: upgrade / manage billing / re-sync entitlements
 */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Check,
  ChevronLeft,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useBillingConfig, useEntitlements } from "@/application/queries";
import { ProMembershipCard, usePro, PRO_FEATURES } from "@/presentation/features/pro";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SubscriptionScreen() {
  const p = useThemedPalette();
  const { isPro, trialing, subscriptionsEnabled, openPaywall } = usePro();
  const { data: ent, refetch } = useEntitlements();
  const { data: billing } = useBillingConfig(true);
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const monthly = billing?.price_monthly_usd;
  const yearly = billing?.price_yearly_usd;

  const rows: { label: string; value: string }[] = [];
  rows.push({
    label: "Plan",
    value: !subscriptionsEnabled
      ? "Loupe Pro (included)"
      : isPro
        ? trialing
          ? "Loupe Pro · Free trial"
          : "Loupe Pro"
        : "Loupe Free",
  });
  if (monthly != null && yearly != null) {
    rows.push({
      label: "Pro pricing",
      value: `$${monthly.toFixed(2)}/mo · $${yearly.toFixed(0)}/yr`,
    });
  }
  const since = fmtDate(ent?.pro_since);
  if (isPro && since) rows.push({ label: "Member since", value: since });
  const expires = fmtDate(ent?.pro_expires_at);
  if (isPro && expires) {
    rows.push({
      label: trialing ? "Trial ends" : "Renews / expires",
      value: expires,
    });
  }
  if (!isPro && ent?.limits.max_cards != null) {
    rows.push({
      label: "Card usage",
      value: `${ent.card_count} of ${ent.limits.max_cards} free cards`,
    });
  }
  if (!isPro && ent?.limits.free_statements != null) {
    rows.push({
      label: "Statements",
      value: `Latest ${ent.limits.free_statements} PDF${ent.limits.free_statements === 1 ? "" : "s"} on Free`,
    });
  }

  const onResync = async () => {
    setSyncing(true);
    try {
      await refetch();
      await qc.invalidateQueries({ queryKey: ["billing"] });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="-ml-1 h-9 w-9 items-center justify-center"
        >
          <ChevronLeft size={22} color={p.ink.default} />
        </Pressable>
        <Text className="text-base font-semibold tracking-tight text-ink">
          Subscription
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Membership hero — same card as Settings for visual continuity. */}
        <ProMembershipCard />

        {/* Plan details */}
        <View className="px-5" style={{ gap: 16 }}>
          <View>
            <Text className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              Plan details
            </Text>
            <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
              {rows.map((r, i) => (
                <View
                  key={r.label}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <Text className="text-[12px] uppercase tracking-wider text-ink-dim">
                    {r.label}
                  </Text>
                  <Text className="ml-4 flex-1 text-right text-[13px] font-semibold text-ink">
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Everything Pro includes — checked by the LIVE entitlement. */}
          <View>
            <Text className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              What Pro includes
            </Text>
            <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
              {PRO_FEATURES.map((f, i) => {
                const unlocked = isPro || !subscriptionsEnabled;
                return (
                  <View
                    key={f.key}
                    className={`flex-row items-center gap-3 px-4 py-3.5 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <View
                      className="h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: withAlpha(
                          unlocked ? p.accent.mint : p.ink.muted,
                          0.13,
                        ),
                      }}
                    >
                      <f.icon
                        size={15}
                        color={unlocked ? p.accent.mint : p.ink.muted}
                        strokeWidth={2.25}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-semibold text-ink">
                        {f.title}
                      </Text>
                      <Text className="mt-0.5 text-[11px] leading-4 text-ink-dim">
                        {f.blurb}
                      </Text>
                    </View>
                    {unlocked ? (
                      <Check size={16} color={p.accent.mint} strokeWidth={2.75} />
                    ) : (
                      <Lock size={14} color={p.ink.dim} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Actions */}
          {!isPro && subscriptionsEnabled ? (
            <Pressable
              onPress={() => openPaywall("generic")}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Loupe Pro"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: p.accent.mint,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Sparkles size={15} color="#0B0B0D" strokeWidth={2.5} />
              <Text style={{ color: "#0B0B0D", fontSize: 14, fontWeight: "800" }}>
                Upgrade to Pro
              </Text>
            </Pressable>
          ) : null}

          {/* Re-sync — the "restore purchases" equivalent: re-reads the
              server-computed entitlements + billing config. */}
          <Pressable
            onPress={onResync}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel="Re-sync subscription status"
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-bg-elevated px-5 py-3.5"
            style={({ pressed }) => ({ opacity: pressed || syncing ? 0.7 : 1 })}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={p.ink.muted} />
            ) : (
              <RefreshCw size={14} color={p.ink.muted} />
            )}
            <Text className="text-[13px] font-semibold text-ink-muted">
              Re-sync subscription status
            </Text>
          </Pressable>

          <Text className="text-center text-[10.5px] leading-4 text-ink-dim">
            Subscriptions are billed by Stripe. Prices in USD; your card is
            charged in your bank's currency. Cancel anytime — your collection
            always stays yours.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
