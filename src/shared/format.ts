import { useFxStore } from "@/application/stores/fxStore";
import { useSettings } from "@/application/stores/settingsStore";
import { formatMoney } from "@/shared/currency";

/** Time-of-day greeting in the operator's locale. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Late shift";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late shift";
}

/** Compact relative time: "just now", "4m", "2h", "3d", "May 12". */
export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (diffSec < 45) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86400 * 6) return `${Math.floor(diffSec / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Compact money formatter. Always called with a USD-denominated `value`
 * (the canonical unit across Loupe's data model) and renders in whatever
 * currency the operator has selected in Settings.
 *
 *   compactUsd(28_540) // USD selected → "$28.5k"
 *   compactUsd(28_540) //  EUR selected → "€26.3k"
 *   compactUsd(28_540) //  BTC selected → "₿0.4234"
 *
 * NOTE: this snapshots the store at call-time and does NOT subscribe.
 * Components that want live-updates on currency change must use the
 * `useCompactUsd()` hook below (or `useMoney()` from `Price.tsx`).
 */
export function compactUsd(value: number): string {
  const code = useSettings.getState().currency;
  const rate = useFxStore.getState().rates?.[code] ?? undefined;
  return formatMoney(value, code, { compact: true, rate });
}

/**
 * Hook variant of `compactUsd`. Subscribes to the currency setting so
 * the host component re-renders whenever the operator switches
 * currencies. Returns a stable-by-currency formatter.
 */
export function useCompactUsd(): (value: number) => string {
  const code = useSettings((s) => s.currency);
  // Live server FX rate (same table the web uses); static snapshot fallback.
  const rate = useFxStore((s) => s.rates?.[code] ?? null);
  return (value: number) =>
    formatMoney(value, code, { compact: true, rate: rate ?? undefined });
}

/**
 * Full-precision USD formatter ("$1,234.50"). Unlike `compactUsd`, this
 * does NOT convert to the operator's selected currency — it renders the
 * raw USD figure with two fixed decimals. Accepts numbers or numeric
 * strings (e.g. decimal columns serialized as strings by the API) and
 * returns an em-dash for null/NaN inputs.
 */
export function fullUsd(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
