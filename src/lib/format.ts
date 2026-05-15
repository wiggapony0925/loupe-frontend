import { useSettings } from "@/store/settingsStore";
import { formatMoney } from "@/lib/currency";

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
 * Reads currency from the global settings store at call-time, so any
 * component that re-renders after a currency change automatically picks
 * up the new formatting.
 */
export function compactUsd(value: number): string {
  const code = useSettings.getState().currency;
  return formatMoney(value, code, { compact: true });
}
