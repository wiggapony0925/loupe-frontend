/**
 * Loupe Pro — the mobile subscription layer.
 *
 * `ProProvider` owns entitlements + the paywall (mount once, inside
 * AuthProvider). Everything else is a reusable gate primitive:
 *
 *   usePro()          — global Pro state + openPaywall()
 *   useProFeature(k)  — per-feature allowed/locked/requirePro
 *   <ProGate/>        — declarative wall around children
 *   <ProWall/>        — the themed locked-state panel
 *   <ProUsageBanner/> — "X of 50 cards" vault meter
 *   <ProBadge/>       — PRO / TRIAL / Upgrade status chip
 */
export { ProProvider, usePro } from "./ProProvider";
export { useProFeature, type ProFeatureAccess } from "./useProFeature";
export { ProGate } from "./ProGate";
export { ProWall } from "./ProWall";
export { ProUsageBanner } from "./ProUsageBanner";
export { ProBadge } from "./ProBadge";
export { ProMembershipCard } from "./ProMembershipCard";
export { UpgradeSheet } from "./UpgradeSheet";
export {
  FREE_CARD_LIMIT,
  PRO_FEATURES,
  PRO_FEATURE_BY_KEY,
  paywallHeadline,
  reasonForFeature,
  type PaywallReason,
  type ProFeatureKey,
} from "./proPlan";
