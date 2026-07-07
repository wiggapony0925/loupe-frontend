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
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Sparkles } from "lucide-react-native";
import {
  fetchReportDownloadUrl,
  useGenerateReport,
  useReports,
  useUpcomingReports,
} from "@/application/queries";
import { apiUrl, getAuthToken } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  UpcomingReportWire,
  UserReportWire,
} from "@/infrastructure/http";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import { ProWall, usePro, useProFeature } from "@/presentation/features/pro";
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

/**
 * Fallback download path (webapp parity): when object storage can't presign
 * a URL, stream the authenticated `/v1/reports/{id}/file` endpoint to a local
 * PDF and hand it to the OS share sheet (Save to Files / AirDrop / print).
 */
async function downloadAndShareViaStream(report: UserReportWire): Promise<void> {
  const token = getAuthToken();
  const safeName = periodLabel(report).replace(/[^\w]+/g, "_");
  const target = `${FileSystem.cacheDirectory}Loupe_Statement_${safeName}.pdf`;
  const res = await FileSystem.downloadAsync(
    apiUrl(ENDPOINTS.reports.file(report.id)),
    target,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (res.status !== 200) {
    throw new Error(`Download failed (${res.status})`);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(res.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: `Loupe statement · ${periodLabel(report)}`,
    });
  } else {
    await Linking.openURL(res.uri);
  }
}

export function ReportsSection() {
  const p = useThemedPalette();
  // Free users keep their latest statement(s); Pro unlocks the full archive
  // + on-demand generation. The backend entitlements decide the split.
  const { allowed, requirePro } = useProFeature("statements");
  const { entitlements } = usePro();
  const freeLimit = entitlements?.limits.free_statements ?? 1;
  const list = useReports();
  const upcoming = useUpcomingReports();
  const generate = useGenerateReport();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const onDownload = React.useCallback(async (report: UserReportWire) => {
    setDownloadingId(report.id);
    try {
      const { download_url } = await fetchReportDownloadUrl(report.id);
      if (!download_url) {
        // No presigned URL → stream the authenticated file endpoint
        // instead (same fallback the webapp uses), so the download
        // works even when presigning isn't configured.
        await downloadAndShareViaStream(report);
        return;
      }
      // In-app browser (SFSafariViewController / Custom Tab): the PDF
      // renders inline with native share/print, and closing it drops the
      // user right back on this screen — no bounce out to Safari.
      try {
        await WebBrowser.openBrowserAsync(download_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          dismissButtonStyle: "done",
        });
      } catch {
        // Rare fallback (e.g. another in-app browser already open).
        const ok = await Linking.canOpenURL(download_url);
        if (ok) await Linking.openURL(download_url);
        else Alert.alert("Can't open URL", download_url);
      }
    } catch (e) {
      Alert.alert(
        "Download failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const onGenerateLastMonth = React.useCallback(() => {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    generate.mutate(
      { period: "monthly", year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 },
      {
        onError: (e) =>
          Alert.alert(
            "Couldn't generate",
            e instanceof Error ? e.message : "Please try again shortly.",
          ),
      },
    );
  }, [generate]);

  const reports = list.data ?? [];
  // Free tier sees only its latest `freeLimit` statement(s); the rest are walled.
  const visibleReports = allowed ? reports : reports.slice(0, freeLimit);
  const lockedCount = allowed ? 0 : Math.max(0, reports.length - visibleReports.length);
  const upcomingRows = upcoming.data ?? [];
  const nextMonthly = upcomingRows.find((r) => r.period === "monthly");
  const nextYearly = upcomingRows.find((r) => r.period === "yearly");

  return (
    <View>
      <SectionHeader
        eyebrow="Statements"
        title="Reports"
        trailing={
          <Pressable
            onPress={allowed ? onGenerateLastMonth : () => requirePro()}
            disabled={generate.isPending}
            accessibilityRole="button"
            accessibilityLabel="Generate last month's statement"
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha(p.accent.mint, 0.12),
              opacity: pressed || generate.isPending ? 0.7 : 1,
            })}
          >
            {generate.isPending ? (
              <ActivityIndicator size="small" color={p.accent.mint} />
            ) : (
              <Sparkles size={12} color={p.accent.mint} strokeWidth={2.5} />
            )}
            <Text style={{ color: p.accent.mint, fontSize: 11, fontWeight: "800" }}>
              {generate.isPending ? "Generating…" : "Generate last month"}
            </Text>
          </Pressable>
        }
      />

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
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {visibleReports.map((r) => (
                <ReportTile
                  key={r.id}
                  report={r}
                  onDownload={onDownload}
                  busy={downloadingId === r.id}
                />
              ))}
            </View>
          )}
        </View>

        {/* Free tier: latest statement is downloadable above; the full
            archive + automatic monthly closes are Loupe Pro (web parity). */}
        {!allowed ? (
          <View className="mt-3">
            <ProWall
              feature="statements"
              title={
                lockedCount > 0
                  ? `${lockedCount} more statement${lockedCount > 1 ? "s" : ""} in your archive`
                  : "Your full statement history, automated"
              }
              description="Free includes your latest statement. Loupe Pro unlocks the entire archive forever, on-demand generation, and an auto-closed PDF every month."
              cta="Unlock with Pro"
              onUpgrade={() => requirePro()}
            />
          </View>
        ) : null}
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
      className="mt-2 flex-row items-center rounded-2xl border px-4 py-3"
      style={{
        gap: 12,
        borderColor: withAlpha(p.accent.mint, 0.25),
        backgroundColor: withAlpha(p.accent.mint, 0.05),
      }}
    >
      {/* Pulsing AUTO dot — statements close themselves. */}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(p.accent.mint, 0.14),
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: p.accent.mint,
            shadowColor: p.accent.mint,
            shadowOpacity: 0.8,
            shadowRadius: 4,
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        {loading ? (
          <>
            <Skeleton width={150} height={12} />
            <View className="h-1.5" />
            <Skeleton width={110} height={10} />
          </>
        ) : nextMonthly ? (
          <>
            <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>
              Next statement · {nextMonthly.label}
            </Text>
            <Text className="mt-0.5 text-[11px] text-ink-muted" numberOfLines={1}>
              Auto-closes {formatCloseDate(nextMonthly.closes_at)}
              {nextYearly ? ` · annual ${formatCloseDate(nextYearly.closes_at)}` : ""}
            </Text>
          </>
        ) : (
          <Text className="text-[12px] text-ink-muted">
            Your next statement window will appear shortly.
          </Text>
        )}
      </View>
      {!loading && nextMonthly ? (
        <View
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: withAlpha(p.accent.mint, 0.14) }}
        >
          <Text
            className="text-[10px] font-extrabold tracking-wide"
            style={{ color: p.accent.mint }}
          >
            {relativeUntil(nextMonthly.closes_at).replace("in ", "").toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── row ─────────────────────────────────────────────────────────────────

function ReportTile({
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
  const statusLabel = ready
    ? `${formatSize(report.file_size_bytes)} · PDF`
    : failed
      ? "Failed"
      : "Generating…";
  const start = new Date(report.period_start);
  const yearly = report.period === "yearly";
  const mono = yearly
    ? String(start.getUTCFullYear())
    : (MONTH_NAMES[start.getUTCMonth()] ?? "").slice(0, 3).toUpperCase();

  return (
    <Pressable
      onPress={() => onDownload(report)}
      disabled={!ready || busy}
      accessibilityRole="button"
      accessibilityLabel={`Open statement ${periodLabel(report)}`}
      style={({ pressed }) => ({
        flexBasis: "47%",
        flexGrow: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ready ? p.line.default : withAlpha(dotColor, 0.35),
        backgroundColor: p.bg.elevated,
        padding: 14,
        gap: 8,
        opacity: pressed ? 0.8 : ready ? 1 : 0.75,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: ready ? p.accent.mint : dotColor,
            fontSize: yearly ? 17 : 19,
            fontWeight: "800",
            letterSpacing: yearly ? 0.5 : 2,
          }}
        >
          {mono}
        </Text>
        {busy ? (
          <ActivityIndicator size="small" color={p.accent.mint} />
        ) : (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: dotColor,
              shadowColor: dotColor,
              shadowOpacity: ready ? 0.6 : 0,
              shadowRadius: 3,
            }}
          />
        )}
      </View>
      <View>
        <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>
          {yearly ? "Annual statement" : `${start.getUTCFullYear()} · Monthly`}
        </Text>
        <Text className="mt-0.5 text-[10.5px] text-ink-muted" numberOfLines={1}>
          {statusLabel}
          {failed && report.error_message ? ` · ${report.error_message}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── skeletons / empty ───────────────────────────────────────────────────

function SkeletonList() {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          className="rounded-2xl border border-line bg-bg-elevated p-4"
          style={{ flexBasis: "47%", flexGrow: 1 }}
        >
          <Skeleton width={52} height={18} />
          <View className="h-2" />
          <Skeleton width={100} height={12} />
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
