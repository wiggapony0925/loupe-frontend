/**
 * ProProvider — owns Loupe Pro entitlements + the upgrade paywall on mobile.
 *
 * Mirrors the web `loupe-web/src/pro/ProProvider.tsx`: mounted inside
 * AuthProvider so the entitlements query keys off the session; the whole app
 * reads `usePro()` to gate UI and NOTHING decides access locally — the
 * backend's `/v1/me/entitlements` is the single source of truth. When
 * subscriptions are switched off (the kill switch) everyone is Pro and every
 * upgrade CTA disappears.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { Entitlements } from "@/infrastructure/http";
import {
  useBillingPortal,
  useEntitlements,
  useRefreshEntitlements,
} from "@/application/queries";
import type { PaywallReason } from "./proPlan";
import { UpgradeSheet } from "./UpgradeSheet";

interface ProValue {
  entitlements: Entitlements | undefined;
  /** Effective Pro access (true while entitlements load, so gates never flash). */
  isPro: boolean;
  /** True while Pro access is a free trial. */
  trialing: boolean;
  /** The global kill switch. False => monetization is off everywhere. */
  subscriptionsEnabled: boolean;
  /** True only when free-tier gating is actually in force (subs on + not Pro). */
  gatingActive: boolean;
  cardCount: number;
  /** Free-tier cap, or null when unlimited. */
  cardLimit: number | null;
  openPaywall: (reason?: PaywallReason) => void;
  closePaywall: () => void;
  /** Open the Stripe customer portal (manage / cancel) in an in-app browser. */
  manageBilling: () => void;
  /** True while a portal session is being created. */
  billingBusy: boolean;
}

const ProContext = createContext<ProValue | null>(null);

export function ProProvider({ children }: { children: ReactNode }) {
  const { data: ent } = useEntitlements();
  const refreshEntitlements = useRefreshEntitlements();
  const [paywall, setPaywall] = useState<{ open: boolean; reason: PaywallReason }>({
    open: false,
    reason: "generic",
  });

  const portal = useBillingPortal({
    onSuccess: (res) => {
      if (!res.url) return;
      void WebBrowser.openBrowserAsync(res.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: "done",
      }).then(() => {
        // The user may have cancelled/renewed inside the portal — re-read.
        refreshEntitlements();
      });
    },
    onError: (err) =>
      // Surface the backend's actual reason ("Billing is not configured.",
      // "No billing account yet — start a subscription first.") instead of
      // a generic retry message the user can't act on.
      Alert.alert(
        "Billing",
        err instanceof Error && err.message
          ? err.message
          : "Couldn't open billing — please try again.",
      ),
  });

  // Default to *unlocked* while loading: a returning Pro user never flashes a
  // gate, and a free user sees content for the split second before the
  // paywall is even relevant. Gating only turns ON once entitlements confirm.
  const isPro = ent?.is_pro ?? true;
  const subscriptionsEnabled = ent?.subscriptions_enabled ?? false;
  const gatingActive = subscriptionsEnabled && !isPro;

  const openPaywall = useCallback(
    (reason: PaywallReason = "generic") => {
      // Nothing to sell if monetization is off or the user is already Pro.
      if (ent && (!ent.subscriptions_enabled || ent.is_pro)) return;
      setPaywall({ open: true, reason });
    },
    [ent],
  );
  const closePaywall = useCallback(
    () => setPaywall((prev) => ({ ...prev, open: false })),
    [],
  );

  const manageBilling = useCallback(() => portal.mutate(), [portal]);

  const value = useMemo<ProValue>(
    () => ({
      entitlements: ent,
      isPro,
      trialing: ent?.trialing ?? false,
      subscriptionsEnabled,
      gatingActive,
      cardCount: ent?.card_count ?? 0,
      cardLimit: ent?.limits.max_cards ?? null,
      openPaywall,
      closePaywall,
      manageBilling,
      billingBusy: portal.isPending,
    }),
    [
      ent,
      isPro,
      subscriptionsEnabled,
      gatingActive,
      openPaywall,
      closePaywall,
      manageBilling,
      portal.isPending,
    ],
  );

  return (
    <ProContext.Provider value={value}>
      {children}
      <UpgradeSheet
        visible={paywall.open}
        reason={paywall.reason}
        onClose={closePaywall}
      />
    </ProContext.Provider>
  );
}

/** Access Loupe Pro state + the paywall opener from anywhere in the app. */
export function usePro(): ProValue {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error("usePro must be used within <ProProvider>");
  return ctx;
}
