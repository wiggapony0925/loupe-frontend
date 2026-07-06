/**
 * UpgradeSheet — the Loupe Pro paywall.
 *
 * A native page-sheet with the same three-step story as the web
 * `UpgradeModal`: pitch → pay → success. Payment happens in Stripe's hosted
 * checkout opened in an in-app browser (`POST /v1/me/billing/checkout`);
 * the webhook grants the plan, so once the browser closes we poll
 * entitlements until `is_pro` flips and then show the success step.
 *
 * Copy, features, and pricing all come from `proPlan.ts` + the backend
 * billing config — one source of truth shared with the web paywall.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react-native";
import {
  useBillingConfig,
  useEntitlements,
  useRefreshEntitlements,
  useStartCheckout,
} from "@/application/queries";
import { Sparkline } from "@/presentation/components/Sparkline";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import {
  PRO_FEATURES,
  PRO_PRICE_MONTHLY,
  PRO_PRICE_YEARLY,
  paywallHeadline,
  type PaywallReason,
} from "./proPlan";

type Interval = "monthly" | "yearly";
type Step = "plan" | "verifying" | "success" | "unavailable";

// A gently rising series for the frosted "Pro analytics" hero — aspirational,
// not real data; it sells the unlock without faking the user's portfolio.
const PREVIEW_SERIES = [12, 14, 13, 17, 16, 21, 20, 26, 25, 31, 30, 38];

interface UpgradeSheetProps {
  visible: boolean;
  reason: PaywallReason;
  onClose: () => void;
}

export function UpgradeSheet({ visible, reason, onClose }: UpgradeSheetProps) {
  const p = useThemedPalette();
  const [step, setStep] = useState<Step>("plan");
  const [interval, setInterval] = useState<Interval>("yearly");

  const { data: billing } = useBillingConfig(visible);
  const { data: ent } = useEntitlements();
  const refreshEntitlements = useRefreshEntitlements();
  // While verifying, give the webhook up to ~15s before falling back to a
  // "you're all set soon" note instead of spinning forever.
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verifyTimedOut, setVerifyTimedOut] = useState(false);

  const checkout = useStartCheckout({
    onSuccess: async (res) => {
      if (res.status !== "checkout" || !res.url) {
        setStep("unavailable");
        return;
      }
      await WebBrowser.openBrowserAsync(res.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: "close",
      }).catch(() => {});
      // Browser closed — the webhook may still be in flight. Poll.
      setVerifyTimedOut(false);
      setStep("verifying");
      refreshEntitlements(5, 2_500);
      verifyTimer.current = setTimeout(() => setVerifyTimedOut(true), 15_000);
    },
    onError: () => setStep("unavailable"),
  });

  // Reset to the pitch each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setStep("plan");
      setVerifyTimedOut(false);
    }
    return () => {
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
    };
  }, [visible]);

  // The webhook landed → celebrate.
  useEffect(() => {
    if (visible && step === "verifying" && ent?.is_pro) {
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
      setStep("success");
    }
  }, [visible, step, ent?.is_pro]);

  const monthly = billing?.price_monthly_usd ?? PRO_PRICE_MONTHLY;
  const yearly = billing?.price_yearly_usd ?? PRO_PRICE_YEARLY;
  const trialDays = billing?.trial_days ?? 0;
  const savingsPct = useMemo(
    () => Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100)),
    [monthly, yearly],
  );

  const head = paywallHeadline(reason);
  const priceLabel =
    interval === "yearly" ? `$${yearly.toFixed(0)}/yr` : `$${monthly.toFixed(2)}/mo`;
  const perMonthHint =
    interval === "yearly"
      ? `$${(yearly / 12).toFixed(2)}/mo, billed yearly`
      : "billed monthly";
  const ctaLabel = trialDays > 0 ? `Start ${trialDays}-day free trial` : "Upgrade to Pro";

  const onContinue = () => {
    if (billing && !billing.checkout_available) {
      setStep("unavailable");
      return;
    }
    checkout.mutate(interval);
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
      transparent={Platform.OS !== "ios"}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: Platform.OS === "ios" ? p.bg.base : "rgba(0,0,0,0.45)",
          justifyContent: Platform.OS === "ios" ? "flex-start" : "flex-end",
        }}
      >
        {Platform.OS !== "ios" ? (
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        ) : null}

        <SafeAreaView
          edges={Platform.OS === "ios" ? [] : ["bottom"]}
          style={{
            backgroundColor: p.bg.base,
            borderTopLeftRadius: Platform.OS === "ios" ? 0 : 24,
            borderTopRightRadius: Platform.OS === "ios" ? 0 : 24,
            maxHeight: Platform.OS === "ios" ? undefined : "92%",
            flex: Platform.OS === "ios" ? 1 : undefined,
          }}
        >
          {/* Close */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: 16,
              paddingTop: 14,
            }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full border border-line"
              style={{ backgroundColor: p.bg.elevated }}
            >
              <X size={16} color={p.ink.muted} />
            </Pressable>
          </View>

          {step === "plan" ? (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 36 }}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Hero ── */}
              <View style={{ alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: withAlpha(p.accent.mint, 0.12),
                  }}
                >
                  <Sparkles size={12} color={p.accent.mint} />
                  <Text
                    style={{
                      color: p.accent.mint,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 2,
                    }}
                  >
                    LOUPE PRO
                  </Text>
                </View>
                <Text
                  style={{
                    color: p.ink.default,
                    fontSize: 24,
                    fontWeight: "800",
                    letterSpacing: -0.4,
                    textAlign: "center",
                    marginTop: 6,
                  }}
                >
                  {head.title}
                </Text>
                <Text
                  style={{
                    color: p.ink.muted,
                    fontSize: 13,
                    lineHeight: 19,
                    textAlign: "center",
                  }}
                >
                  {head.sub}
                </Text>
              </View>

              {/* ── Frosted analytics preview ── */}
              <View
                style={{
                  marginTop: 18,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: withAlpha(p.accent.mint, 0.25),
                  backgroundColor: p.bg.sunken,
                  overflow: "hidden",
                  padding: 14,
                  gap: 8,
                }}
              >
                <Sparkline
                  values={PREVIEW_SERIES}
                  width={300}
                  height={72}
                  color={p.accent.mint}
                  showBaseline={false}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "700" }}>
                    Portfolio · all-time
                  </Text>
                  <Text style={{ color: p.accent.mint, fontSize: 13, fontWeight: "800" }}>
                    +18.4%
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    alignSelf: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: withAlpha(p.bg.base, 0.85),
                    borderWidth: 1,
                    borderColor: p.line.default,
                  }}
                >
                  <Lock size={11} color={p.ink.muted} />
                  <Text style={{ color: p.ink.muted, fontSize: 11, fontWeight: "700" }}>
                    Full history & live analytics
                  </Text>
                </View>
              </View>

              {/* ── Trust row ── */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 14,
                  marginTop: 14,
                }}
              >
                {trialDays > 0 ? (
                  <TrustItem icon={<BadgeCheck size={13} color={p.ink.muted} />} label={`${trialDays}-day free trial`} />
                ) : null}
                <TrustItem icon={<ShieldCheck size={13} color={p.ink.muted} />} label="Cancel anytime" />
                <TrustItem icon={<Lock size={13} color={p.ink.muted} />} label="Secured by Stripe" />
              </View>

              {/* ── Feature ladder ── */}
              <View style={{ marginTop: 20, gap: 14 }}>
                {PRO_FEATURES.map((f) => (
                  <View
                    key={f.key}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: withAlpha(p.accent.mint, 0.12),
                      }}
                    >
                      <f.icon size={16} color={p.accent.mint} strokeWidth={2.25} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
                        {f.title}
                      </Text>
                      <Text
                        style={{
                          color: p.ink.muted,
                          fontSize: 12,
                          lineHeight: 17,
                          marginTop: 1,
                        }}
                      >
                        {f.blurb}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* ── Interval picker ── */}
              <View
                style={{
                  flexDirection: "row",
                  marginTop: 22,
                  padding: 3,
                  borderRadius: 14,
                  backgroundColor: p.bg.elevated,
                  borderWidth: 1,
                  borderColor: p.line.default,
                }}
              >
                <IntervalTab
                  label={savingsPct > 0 ? `Yearly · save ${savingsPct}%` : "Yearly"}
                  active={interval === "yearly"}
                  onPress={() => setInterval("yearly")}
                />
                <IntervalTab
                  label="Monthly"
                  active={interval === "monthly"}
                  onPress={() => setInterval("monthly")}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <Text
                  style={{
                    color: p.ink.default,
                    fontSize: 28,
                    fontWeight: "800",
                    letterSpacing: -0.6,
                  }}
                >
                  {priceLabel}
                </Text>
                <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "600" }}>
                  {trialDays > 0
                    ? `free for ${trialDays} days, then ${perMonthHint}`
                    : perMonthHint}
                </Text>
              </View>

              {/* ── CTA ── */}
              <View style={{ marginTop: 16, gap: 10 }}>
                <PrimaryButton
                  label={checkout.isPending ? "Starting…" : ctaLabel}
                  icon={Sparkles}
                  variant="mint"
                  loading={checkout.isPending}
                  onPress={onContinue}
                  accessibilityLabel={ctaLabel}
                />
                <Text
                  style={{
                    color: p.ink.dim,
                    fontSize: 11,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {trialDays > 0
                    ? `${trialDays} days free, then ${priceLabel} · cancel anytime`
                    : "Cancel anytime · your collection always stays yours"}
                </Text>
              </View>
            </ScrollView>
          ) : null}

          {step === "verifying" ? (
            <CenteredStep>
              <ActivityIndicator size="large" color={p.accent.mint} />
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 18,
                  fontWeight: "800",
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                {verifyTimedOut ? "Almost there" : "Confirming your upgrade…"}
              </Text>
              <Text
                style={{
                  color: p.ink.muted,
                  fontSize: 13,
                  lineHeight: 19,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                {verifyTimedOut
                  ? "If you completed checkout, Pro will unlock within a minute — you can keep using Loupe in the meantime."
                  : "Waiting for Stripe to confirm your subscription."}
              </Text>
              {verifyTimedOut ? (
                <View style={{ marginTop: 18, alignSelf: "stretch" }}>
                  <PrimaryButton label="Done" variant="ghost" onPress={onClose} />
                </View>
              ) : null}
            </CenteredStep>
          ) : null}

          {step === "success" ? (
            <CenteredStep>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(p.accent.mint, 0.14),
                }}
              >
                <Check size={30} color={p.accent.mint} strokeWidth={2.5} />
              </View>
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 22,
                  fontWeight: "800",
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                Welcome to Loupe Pro
              </Text>
              <Text
                style={{
                  color: p.ink.muted,
                  fontSize: 13,
                  lineHeight: 19,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                {trialDays > 0 && ent?.trialing
                  ? `Your ${trialDays}-day free trial is active. Unlimited cards, full analytics, and statements are unlocked.`
                  : "You're all set — unlimited cards, full analytics, and statements are unlocked."}
              </Text>
              <View style={{ marginTop: 20, alignSelf: "stretch" }}>
                <PrimaryButton
                  label="Back to your vault"
                  icon={ArrowRight}
                  variant="mint"
                  onPress={onClose}
                />
              </View>
            </CenteredStep>
          ) : null}

          {step === "unavailable" ? (
            <CenteredStep>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(p.ink.muted, 0.12),
                }}
              >
                <XCircle size={28} color={p.ink.muted} />
              </View>
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                Loupe Pro is launching soon
              </Text>
              <Text
                style={{
                  color: p.ink.muted,
                  fontSize: 13,
                  lineHeight: 19,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                Checkout isn't open just yet — you're on the early list and we'll
                let you know the moment it goes live.
              </Text>
              <View style={{ marginTop: 20, alignSelf: "stretch" }}>
                <PrimaryButton label="Got it" variant="ghost" onPress={onClose} />
              </View>
            </CenteredStep>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function CenteredStep({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingBottom: 48,
      }}
    >
      {children}
    </View>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  const p = useThemedPalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {icon}
      <Text style={{ color: p.ink.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function IntervalTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 9,
        borderRadius: 11,
        backgroundColor: active ? withAlpha(p.accent.mint, 0.16) : "transparent",
        borderWidth: 1,
        borderColor: active ? withAlpha(p.accent.mint, 0.4) : "transparent",
      }}
    >
      <Text
        style={{
          color: active ? p.accent.mint : p.ink.muted,
          fontSize: 12.5,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
