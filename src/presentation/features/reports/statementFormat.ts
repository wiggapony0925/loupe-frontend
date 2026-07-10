import type { UserReportWire } from "@/infrastructure/http";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatStatementSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatStatementDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function periodLabel(r: Pick<UserReportWire, "period" | "period_start">): string {
  const start = new Date(r.period_start);
  if (r.period === "yearly") return String(start.getUTCFullYear());
  return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

export function periodMonthName(r: Pick<UserReportWire, "period" | "period_start">): string {
  const start = new Date(r.period_start);
  if (r.period === "yearly") return String(start.getUTCFullYear());
  return MONTH_NAMES[start.getUTCMonth()] ?? "Statement";
}

export function periodMonthShort(r: Pick<UserReportWire, "period" | "period_start">): string {
  const start = new Date(r.period_start);
  if (r.period === "yearly") return String(start.getUTCFullYear());
  return MONTH_NAMES_SHORT[start.getUTCMonth()] ?? "—";
}

export function periodYear(r: Pick<UserReportWire, "period_start">): number {
  return new Date(r.period_start).getUTCFullYear();
}

export function fullStatementLabel(r: UserReportWire): string {
  const base = periodLabel(r);
  return r.collection_name ? `${base} · ${r.collection_name}` : base;
}

export function relativeUntil(iso: string): string {
  const target = new Date(iso).getTime();
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "any moment now";
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 60) {
    const months = Math.round(days / 30);
    return `in ~${months} months`;
  }
  if (days > 1) return `in ${days} days`;
  if (days === 1) return "tomorrow";
  const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return `in ${hours}h`;
}

export function formatCloseDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** 0–1 progress through the current statement window toward `closes_at`. */
export function closeWindowProgress(
  periodStart: string,
  closesAt: string,
): number {
  const start = new Date(periodStart).getTime();
  const end = new Date(closesAt).getTime();
  const now = Date.now();
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export function daysUntilClose(closesAt: string): number {
  const diffMs = new Date(closesAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
