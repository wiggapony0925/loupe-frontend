import { usePro } from "./ProProvider";
import { reasonForFeature, type PaywallReason, type ProFeatureKey } from "./proPlan";

export interface ProFeatureAccess {
  /** True when the user may use this feature (Pro, or gating is off). */
  allowed: boolean;
  /** True when gating is active and this feature sits behind the wall. */
  locked: boolean;
  /** Open the upgrade paywall, defaulting to this feature's headline. */
  requirePro: (reason?: PaywallReason) => void;
}

/**
 * Per-feature access for a single Pro capability — the building block every
 * subscription wall reads. Mirrors the web hook exactly:
 *
 *   const { allowed, requirePro } = useProFeature("statements");
 *   if (!allowed) requirePro();
 */
export function useProFeature(feature: ProFeatureKey): ProFeatureAccess {
  const { entitlements, gatingActive, openPaywall } = usePro();
  // Gating off (kill switch or Pro) => allowed. Otherwise honour the exact
  // entitlement flag, so future partial tiers "just work".
  const allowed = !gatingActive || Boolean(entitlements?.features?.[feature]);
  return {
    allowed,
    locked: !allowed,
    requirePro: (reason) => openPaywall(reason ?? reasonForFeature(feature)),
  };
}
