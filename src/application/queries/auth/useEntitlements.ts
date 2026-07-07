/**
 * Loupe Pro data layer — entitlements, pricing, and Stripe billing flows.
 *
 * `useEntitlements()` is the ONE source of truth for what the signed-in user
 * may do (`GET /v1/me/entitlements`). The client never decides access
 * locally: the backend computes plan + limits + feature gates (honouring the
 * global `subscriptions_enabled` kill switch) and the UI just renders it.
 *
 * Checkout is Stripe-hosted (`POST /v1/me/billing/checkout` → URL opened in
 * an in-app browser); the webhook grants the plan, so after the browser
 * closes callers re-poll entitlements until `is_pro` flips.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  BillingConfig,
  BillingInterval,
  BillingPortalSession,
  CheckoutSession,
  Entitlements,
} from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useEntitlements() {
  const { isAuthenticated } = useAuth();
  return useQuery<Entitlements>({
    queryKey: queryKeys.me.entitlements(),
    queryFn: () => apiFetch<Entitlements>(ENDPOINTS.me.entitlements),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

/** Pricing + checkout availability. Only fetched while the paywall is open. */
export function useBillingConfig(enabled: boolean) {
  const { isAuthenticated } = useAuth();
  return useQuery<BillingConfig>({
    queryKey: queryKeys.me.billingConfig(),
    queryFn: () => apiFetch<BillingConfig>(ENDPOINTS.me.billingConfig),
    enabled: enabled && isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

/** Begin a hosted Loupe Pro checkout for the given interval. */
export interface BillingMutationResult {
  status?: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

export function useStartCheckout(options?: {
  onSuccess?: (res: CheckoutSession) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<CheckoutSession, Error, BillingInterval>({
    mutationFn: (interval) =>
      apiFetch<CheckoutSession>(ENDPOINTS.me.billingCheckout, {
        method: "POST",
        json: { interval },
      }),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/** Stripe customer portal (manage / cancel) — returns a URL to open. */
export function useBillingPortal(options?: {
  onSuccess?: (res: BillingPortalSession) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<BillingPortalSession, Error, void>({
    mutationFn: () =>
      apiFetch<BillingPortalSession>(ENDPOINTS.me.billingPortal, {
        method: "POST",
      }),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/** Self-serve cancel — schedules cancel-at-period-end. Returns the new
 *  subscription state ({ cancel_at_period_end, current_period_end }). */
export function useCancelSubscription(options?: {
  onSuccess?: (res: BillingMutationResult) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<BillingMutationResult, Error, void>({
    mutationFn: () =>
      apiFetch<BillingMutationResult>(ENDPOINTS.me.billingCancel, {
        method: "POST",
      }),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/** Self-serve reactivate — undo a scheduled cancellation. */
export function useReactivateSubscription(options?: {
  onSuccess?: (res: BillingMutationResult) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<BillingMutationResult, Error, void>({
    mutationFn: () =>
      apiFetch<BillingMutationResult>(ENDPOINTS.me.billingReactivate, {
        method: "POST",
      }),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Refresh entitlements now and again shortly after — the Stripe webhook
 * needs a beat to land after checkout, so a single refetch often reads the
 * old plan. Mirrors the web's post-checkout double-invalidate.
 */
export function useRefreshEntitlements() {
  const qc = useQueryClient();
  return (times = 3, intervalMs = 2_500) => {
    void qc.invalidateQueries({ queryKey: queryKeys.me.entitlements() });
    for (let i = 1; i < times; i += 1) {
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.me.entitlements() });
      }, i * intervalMs);
    }
  };
}
