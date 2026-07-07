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
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Download, Eye, Sparkles } from "lucide-react-native";
import {
  fetchReportDownloadUrl,
  useGenerateReport,
  useReports,
  useUpcomingReports,
} from "@/application/queries";
import { ApiError, apiUrl, getAuthToken } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  UpcomingReportWire,
  UserReportWire,
} from "@/infrastructure/http";
import { PdfViewerSheet } from "@/presentation/components/PdfViewerSheet";
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

/**
 * Fallback download path (webapp parity): when object storage can't presign
 * a URL, stream the authenticated `/v1/reports/{id}/file` endpoint to a local
 * PDF and hand it to the OS share sheet (Save to Files / AirDrop / print).
 */
async function streamToCache(report: UserReportWire): Promise<string> {
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
  return res.uri;
}

async function downloadAndShareViaStream(report: UserReportWire): Promise<void> {
  const uri = await streamToCache(report);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: `Loupe statement · ${periodLabel(report)}`,
    });
  } else {
    await Linking.openURL(uri);
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
  // Per-row busy markers — "<id>:view" while the in-app viewer is opening,
  // "<id>:save" while the PDF streams to the share sheet.
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  // In-app PDF popup (used when object storage can't presign a URL).
  const [viewer, setViewer] = React.useState<{ uri: string; title: string } | null>(
    null,
  );

  /** VIEW — open the statement inside the app (browser page-sheet popup). */
  const onView = React.useCallback(async (report: UserReportWire) => {
    setBusyKey(`${report.id}:view`);
    try {
      const { download_url } = await fetchReportDownloadUrl(report.id);
      if (download_url) {
        // In-app browser (SFSafariViewController / Custom Tab): the PDF
        // renders inline with native share/print, and closing it drops the
        // user right back on this screen — no bounce out to Safari.
        try {
          await WebBrowser.openBrowserAsync(download_url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            dismissButtonStyle: "done",
          });
        } catch {
          const ok = await Linking.canOpenURL(download_url);
          if (ok) await Linking.openURL(download_url);
          else Alert.alert("Can't open URL", download_url);
        }
        return;
      }
      // No presigned URL → stream the authenticated file endpoint. iOS
      // renders the local PDF in our in-app popup sheet; Android WebViews
      // can't draw PDFs, so hand it to the system share sheet instead.
      if (Platform.OS === "ios") {
        const uri = await streamToCache(report);
        setViewer({ uri, title: `Statement · ${periodLabel(report)}` });
      } else {
        await downloadAndShareViaStream(report);
      }
    } catch (e) {
      Alert.alert(
        "Couldn't open statement",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  }, []);

  /** DOWNLOAD — stream the PDF locally and open the share sheet
   *  (Save to Files / AirDrop / print). */
  const onSave = React.useCallback(async (report: UserReportWire) => {
    setBusyKey(`${report.id}:save`);
    try {
      await downloadAndShareViaStream(report);
    } catch (e) {
      Alert.alert(
        "Download failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  }, []);

  const onGenerateLastMonth = React.useCallback(() => {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    generate.mutate(
      { period: "monthly", year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 },
      {
        onError: (e) => {
          // Server says this needs Pro → paywall, not a dead-end error.
          if (e instanceof ApiError && e.status === 402) {
            requirePro();
            return;
          }
          Alert.alert(
            "Couldn't generate",
            e instanceof Error ? e.message : "Please try again shortly.",
          );
        },
      },
    );
  }, [generate, requirePro]);

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
            <View
              className="overflow-hidden rounded-2xl border border-line"
              style={{ backgroundColor: p.bg.elevated }}
            >
              {visibleReports.map((r, i) => (
                <View
                  key={r.id}
                  className={i > 0 ? "border-t border-line" : ""}
                >
                  <ReportRow
                    report={r}
                    onView={onView}
                    onSave={onSave}
                    viewBusy={busyKey === `${r.id}:view`}
                    saveBusy={busyKey === `${r.id}:save`}
                  />
                </View>
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

      <PdfViewerSheet
        visible={viewer != null}
        uri={viewer?.uri ?? null}
        title={viewer?.title ?? "Statement"}
        onClose={() => setViewer(null)}
      />
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
  onView,
  onSave,
  viewBusy,
  saveBusy,
}: {
  report: UserReportWire;
  onView: (r: UserReportWire) => void;
  onSave: (r: UserReportWire) => void;
  viewBusy: boolean;
  saveBusy: boolean;
}) {
  const p = useThemedPalette();
  const ready = report.status === "ready";
  const failed = report.status === "failed";
  const dotColor = ready ? p.accent.mint : failed ? p.accent.rose : p.accent.amber;
  const statusLabel = ready ? "Ready" : failed ? "Failed" : "Generating";
  const busy = viewBusy || saveBusy;

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

      {/* VIEW — opens the PDF in the in-app browser popup. */}
      <Pressable
        onPress={() => onView(report)}
        disabled={!ready || busy}
        accessibilityRole="button"
        accessibilityLabel={`View statement ${periodLabel(report)}`}
        className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
        style={{
          backgroundColor: ready
            ? withAlpha(p.accent.mint, 0.12)
            : withAlpha(p.line.default, 0.4),
          opacity: !ready || busy ? 0.6 : 1,
        }}
      >
        {viewBusy ? (
          <ActivityIndicator size="small" color={p.accent.mint} />
        ) : (
          <>
            <Eye size={13} color={ready ? p.accent.mint : p.ink.dim} strokeWidth={2.5} />
            <Text
              className="text-[11px] font-bold tracking-wide"
              style={{ color: ready ? p.accent.mint : p.ink.dim }}
            >
              VIEW
            </Text>
          </>
        )}
      </Pressable>

      {/* DOWNLOAD — streams the PDF and opens the share sheet. */}
      <Pressable
        onPress={() => onSave(report)}
        disabled={!ready || busy}
        accessibilityRole="button"
        accessibilityLabel={`Download statement ${periodLabel(report)}`}
        className="ml-2 h-9 w-9 items-center justify-center rounded-full border"
        style={{
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          opacity: !ready || busy ? 0.5 : 1,
        }}
      >
        {saveBusy ? (
          <ActivityIndicator size="small" color={p.ink.muted} />
        ) : (
          <Download size={14} color={p.ink.muted} strokeWidth={2.25} />
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
