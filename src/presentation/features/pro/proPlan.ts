/**
 * Single source of truth for the Loupe Pro paywall copy + the free/Pro split
 * on mobile. Mirrors the web `loupe-web/src/pro/proPlan.ts` and the backend
 * `entitlement_service` (50-card free cap) so marketing and billing never
 * drift across surfaces.
 */
import type { LucideIcon } from "lucide-react-native";
import {
  BellRing,
  FileText,
  Infinity as InfinityIcon,
  LineChart,
  ScanLine,
  Sparkles,
} from "lucide-react-native";

/** Why the paywall opened — lets the sheet tailor its headline. */
export type PaywallReason =
  | "card_limit"
  | "scanner_import"
  | "statements"
  | "alerts"
  | "analytics"
  | "ai_search"
  | "generic";

/** Free accounts may track this many cards (mirrors FREE_CARD_LIMIT). */
export const FREE_CARD_LIMIT = 50;

/** Fallback prices if `/me/billing/config` hasn't resolved yet. */
export const PRO_PRICE_MONTHLY = 9.99;
export const PRO_PRICE_YEARLY = 99;

/** Pro capability keys — mirror the backend `PlanFeatures` flags so a gate
 *  can check exactly the entitlement it needs. */
export type ProFeatureKey =
  | "unlimited_cards"
  | "scanner_import"
  | "full_history"
  | "unlimited_alerts"
  | "statements"
  | "ai_search";

export interface ProFeature {
  key: ProFeatureKey;
  icon: LucideIcon;
  title: string;
  blurb: string;
}

/** What Pro unlocks — gated on *scale & automation*, never on seeing your
 *  own numbers. The order doubles as the value ladder in the paywall. */
export const PRO_FEATURES: ProFeature[] = [
  {
    key: "unlimited_cards",
    icon: InfinityIcon,
    title: "Unlimited cards",
    blurb: `Track your whole collection — past the free ${FREE_CARD_LIMIT}-card cap.`,
  },
  {
    key: "scanner_import",
    icon: ScanLine,
    title: "Scanner auto-import",
    blurb: "Every Loupe Scanner capture flows straight into your vault.",
  },
  {
    key: "full_history",
    icon: LineChart,
    title: "Full history & analytics",
    blurb: "Deep price history, cost basis, and portfolio movers — no 30-day wall.",
  },
  {
    key: "unlimited_alerts",
    icon: BellRing,
    title: "Unlimited price alerts",
    blurb: "Get pinged the moment any card spikes or dips.",
  },
  {
    key: "statements",
    icon: FileText,
    title: "Tax & insurance statements",
    blurb: "One-tap PDF exports for underwriting and capital-gains reporting.",
  },
  {
    key: "ai_search",
    icon: Sparkles,
    title: "AI search",
    blurb: "Describe any card in your own words — Loupe finds the real thing.",
  },
];

/** Look up a feature's icon/title/blurb by key — powers the reusable gate. */
export const PRO_FEATURE_BY_KEY: Record<ProFeatureKey, ProFeature> =
  Object.fromEntries(PRO_FEATURES.map((f) => [f.key, f])) as Record<
    ProFeatureKey,
    ProFeature
  >;

/** The paywall reason that best fits each feature (so the sheet headline
 *  matches the wall the user hit). */
export function reasonForFeature(key: ProFeatureKey): PaywallReason {
  switch (key) {
    case "unlimited_cards":
      return "card_limit";
    case "scanner_import":
      return "scanner_import";
    case "full_history":
      return "analytics";
    case "unlimited_alerts":
      return "alerts";
    case "statements":
      return "statements";
    case "ai_search":
      return "ai_search";
  }
}

/** Reason-aware headline so the paywall meets the user where they hit the wall. */
export function paywallHeadline(reason: PaywallReason): { title: string; sub: string } {
  switch (reason) {
    case "card_limit":
      return {
        title: `You've reached ${FREE_CARD_LIMIT} cards`,
        sub: "Go unlimited and let the entire collection live in Loupe.",
      };
    case "scanner_import":
      return {
        title: "Auto-import every scan",
        sub: "Loupe Pro syncs each Scanner capture straight to your vault.",
      };
    case "statements":
      return {
        title: "Export tax & insurance statements",
        sub: "Underwriting-ready PDFs of your vault — a Loupe Pro feature.",
      };
    case "alerts":
      return {
        title: "Never miss a move",
        sub: "Unlimited price alerts come with Loupe Pro.",
      };
    case "analytics":
      return {
        title: "See the full picture",
        sub: "Deep history and analytics are part of Loupe Pro.",
      };
    case "ai_search":
      return {
        title: "Describe it. Loupe finds it.",
        sub: "AI search turns \"red lizard with fire\" into the exact card — a Loupe Pro feature.",
      };
    default:
      return {
        title: "Upgrade to Loupe Pro",
        sub: "Your collection, as a portfolio — unlimited, automated, insured.",
      };
  }
}
