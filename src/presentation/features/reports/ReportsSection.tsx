/**
 * Portfolio statements — Amex-style auto-generated PDF archive.
 *
 * Users never tap a "Generate" button. Statements close automatically
 * on the 1st of each month (and Jan 1 for the annual) on the server;
 * this screen just renders:
 *
 *   1. A hero "card" showing when the next monthly + annual statements
 *      will close (so a brand-new account understands the cadence).
 *   2. The user's archive of every statement that has already closed,
 *      each downloadable forever.
 *
 * Visual language: embossed Amex/Robinhood metal-card vibe, mint accent,
 * monospaced period chips, glow-dot status indicators.
 */

import React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  fetchReportDownloadUrl,
  useReports,
  useUpcomingReports,
} from "@/application/queries";
import type {
  UpcomingReportWire,
  UserReportWire,
} from "@/infrastructure/http";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

// ─── helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function periodLabel(r: UserReportWire): string {
  const start = new Date(r.period_start);
  if (r.period === "yearly") return String(start.getUTCFullYear());
  return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

function relativeUntil(iso: string): string {
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

function formatCloseDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── component ───────────────────────────────────────────────────────────

export function ReportsSection() {
  const p = useThemedPalette();
  const list = useReports();
  const upcoming = useUpcomingReports();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const onDownload = React.useCallback(async (report: UserReportWire) => {
    setDownloadingId(report.id);
    try {
      const { download_url } = await fetchReportDownloadUrl(report.id);
      if (!download_url) {
        Alert.alert(
          "Download unavailable",
          "Your statement is ready but the download backend isn't reachable right now.",
        );
        return;
      }
      const ok = await Linking.canOpenURL(download_url);
      if (ok) await Linking.openURL(download_url);
      else Alert.alert("Can't open URL", download_url);
    } catch (e) {
      Alert.alert(
        "Download failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const reports = list.data ?? [];
  const upcomingRows = upcoming.data ?? [];
  const nextMonthly = upcomingRows.find((r) => r.period === "monthly");
  const nextYearly = upcomingRows.find((r) => r.period === "yearly");

  return (
    <View>
      <SectionHeader eyebrow="Statements" title="Reports" />

      <NextStatementHeroCard
        nextMonthly={nextMonthly}
        nextYearly={nextYearly}
        loading={upcoming.isLoading}
      />

      <View className="mt-5">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Archive · {reports.length}
        </Text>

        <View className="mt-2">
          {list.isLoading ? (
            <SkeletonList />
          ) : reports.length === 0 ? (
            <EmptyState nextClose={nextMonthly?.closes_at ?? null} />
          ) : (
            <View
              className="overflow-hidden rounded-2xl border border-line"
              style={{ backgroundColor: p.bg.elevated }}
            >
              {reports.map((r, i) => (
                <View
                  key={r.id}
                  className={i > 0 ? "border-t border-line" : ""}
                >
                  <ReportRow
                    report={r}
                    onDownload={onDownload}
                    busy={downloadingId === r.id}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── hero card ───────────────────────────────────────────────────────────

function NextStatementHeroCard({
  nextMonthly,
  nextYearly,
  loading,
}: {
  nextMonthly: UpcomingReportWire | undefined;
  nextYearly: UpcomingReportWire | undefined;
  loading: boolean;
}) {
  const p = useThemedPalette();

  return (
    <View
      className="mt-2 overflow-hidden rounded-2xl border"
      style={{
        borderColor: withAlpha(p.accent.mint, 0.25),
        backgroundColor: p.bg.sunken,
      }}
    >
      {/* Sheen / glow accents (Amex Black Card vibe) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: withAlpha(p.accent.mint, 0.08),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -60,
          left: -40,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: withAlpha(p.accent.blue, 0.05),
        }}
      />

      <View className="p-5">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-[10px] font-semibold uppercase tracking-[4px]"
            style={{ color: p.accent.mint }}
          >
            Loupe · Statement
          </Text>
          <View
            className="flex-row items-center rounded-md px-2 py-0.5"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.12) }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: p.accent.mint,
                marginRight: 6,
                shadowColor: p.accent.mint,
                shadowOpacity: 0.7,
                shadowRadius: 3,
              }}
            />
            <Text
              className="text-[10px] font-bold tracking-[2px]"
              style={{ color: p.accent.mint }}
            >
              AUTO
            </Text>
          </View>
        </View>

        <Text className="mt-6 text-2xl font-semibold text-ink">
          Your portfolio,{"\n"}on paper.
        </Text>
        <Text className="mt-2 text-xs leading-5 text-ink-muted">
          We close your statement automatically at the end of every
          month — just like a credit card. Open it any time, forever.
        </Text>

        {/* Next-close panel */}
        <View
          className="mt-5 rounded-xl border px-4 py-3"
          style={{
            borderColor: withAlpha(p.line.default, 0.6),
            backgroundColor: withAlpha(p.bg.base, 0.4),
          }}
        >
          {loading ? (
            <>
              <Skeleton width={140} height={11} />
              <View className="h-1.5" />
              <Skeleton width={200} height={14} />
            </>
          ) : nextMonthly ? (
            <>
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Next monthly statement
              </Text>
              <View className="mt-1 flex-row items-baseline justify-between">
                <Text className="text-base font-semibold text-ink">
                  {nextMonthly.label}
                </Text>
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: p.accent.mint }}
                >
                  Closes {relativeUntil(nextMonthly.closes_at)}
                </Text>
              </View>
              <Text className="mt-0.5 text-[11px]" style={{ color: p.ink.muted }}>
                Available {formatCloseDate(nextMonthly.closes_at)}
                {nextYearly
                  ? ` · Annual closes ${formatCloseDate(nextYearly.closes_at)}`
                  : ""}
              </Text>
            </>
          ) : (
            <Text className="text-xs text-ink-muted">
              Your next statement window will appear shortly.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── row ─────────────────────────────────────────────────────────────────

function ReportRow({
  report,
  onDownload,
  busy,
}: {
  report: UserReportWire;
  onDownload: (r: UserReportWire) => void;
  busy: boolean;
}) {
  const p = useThemedPalette();
  const ready = report.status === "ready";
  const failed = report.status === "failed";
  const dotColor = ready ? p.accent.mint : failed ? p.accent.rose : p.accent.amber;
  const statusLabel = ready ? "Ready" : failed ? "Failed" : "Generating";

  return (
    <View className="flex-row items-center px-4 py-3.5">
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
          marginRight: 12,
          shadowColor: dotColor,
          shadowOpacity: ready ? 0.6 : 0,
          shadowRadius: 4,
        }}
      />

      <View className="flex-1 pr-3">
        <View className="flex-row items-baseline">
          <Text className="text-sm font-semibold text-ink">
            {periodLabel(report)}
          </Text>
          <Text
            className="ml-2 text-[10px] uppercase tracking-[2px]"
            style={{ color: p.ink.dim }}
          >
            {report.period === "monthly" ? "Monthly" : "Annual"}
          </Text>
        </View>
        <Text className="mt-0.5 text-[11px]" style={{ color: p.ink.muted }}>
          {ready
            ? `${formatDate(report.generated_at)} · ${formatSize(report.file_size_bytes)}`
            : statusLabel}
          {failed && report.error_message ? ` · ${report.error_message}` : ""}
        </Text>
      </View>

      <Pressable
        onPress={() => onDownload(report)}
        disabled={!ready || busy}
        className="rounded-full px-3.5 py-2"
        style={{
          backgroundColor: ready
            ? withAlpha(p.accent.mint, 0.12)
            : withAlpha(p.line.default, 0.4),
          opacity: !ready || busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={p.accent.mint} />
        ) : (
          <Text
            className="text-[11px] font-bold tracking-wide"
            style={{ color: ready ? p.accent.mint : p.ink.dim }}
          >
            {ready ? "OPEN" : statusLabel.toUpperCase()}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── skeletons / empty ───────────────────────────────────────────────────

function SkeletonList() {
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className={`px-4 py-4 ${i > 0 ? "border-t border-line" : ""}`}
        >
          <Skeleton width={120} height={12} />
          <View className="h-1.5" />
          <Skeleton width={180} height={10} />
        </View>
      ))}
    </View>
  );
}

function EmptyState({ nextClose }: { nextClose: string | null }) {
  const p = useThemedPalette();
  return (
    <View
      className="items-center rounded-2xl border border-dashed px-4 py-8"
      style={{ borderColor: p.line.default, backgroundColor: p.bg.elevated }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: withAlpha(p.accent.mint, 0.12),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: p.accent.mint, fontSize: 18, fontWeight: "700" }}>
          ✦
        </Text>
      </View>
      <Text className="mt-3 text-sm font-semibold text-ink">
        No statements yet
      </Text>
      <Text className="mt-1 text-center text-[11px] text-ink-muted">
        {nextClose
          ? `Your first statement will be ready on ${formatCloseDate(nextClose)}.\nIt'll show up here automatically — nothing to tap.`
          : "Your first statement will close at the end of this month.\nIt'll show up here automatically."}
      </Text>
    </View>
  );
}
