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
 * Visual language: clean document list — elevated cards, neutral icons,
 * restrained typography (bank-statement style).
 */

import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { Download, Eye, Sparkles } from "lucide-react-native";
import {
  useGenerateReport,
  useReports,
  useUpcomingReports,
} from "@/application/queries";
import { useCollectionsOverview } from "@/application/queries/collection/useCollectionsOverview";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { ApiError } from "@/infrastructure/http/client";
import type {
  UpcomingReportWire,
  UserReportWire,
} from "@/infrastructure/http";
import { PdfViewerSheet } from "@/presentation/components/PdfViewerSheet";
import { Skeleton } from "@/presentation/components/Skeleton";
import { ProWall, usePro, useProFeature } from "@/presentation/features/pro";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { StatementCard, StatementFileIcon } from "./StatementFileIcon";
import {
  formatCloseDate,
  formatStatementDate,
  formatStatementSize,
  periodLabel,
} from "./statementFormat";
import { useReportActions } from "./useReportActions";
import { useStatementSummary } from "./useStatementSummary";

export function ReportsSection() {
  const p = useThemedPalette();
  // Free users keep their latest statement(s); Pro unlocks the full archive
  // + on-demand generation. The backend entitlements decide the split.
  const { allowed, requirePro } = useProFeature("statements");
  const { entitlements } = usePro();
  const freeLimit = entitlements?.limits.free_statements ?? 1;
  const list = useReports();
  const upcoming = useUpcomingReports();
  const { latestReadyMonthly, readyCount } = useStatementSummary();
  const generate = useGenerateReport();
  const {
    onView,
    onSave,
    viewer,
    setViewer,
    isViewBusy,
    isSaveBusy,
  } = useReportActions();
  // The one reusable collection-scope hook — on-demand statements cover the
  // portfolio currently in view (null ⇒ the whole vault), matching every
  // other value surface in the app.
  const { collectionId: activeCollectionId } = useActiveCollection();
  const { data: portfolios } = useCollectionsOverview();
  const activeCollectionName = activeCollectionId
    ? (portfolios?.find((c) => c.id === activeCollectionId)?.name ?? null)
    : null;

  const onGenerateLastMonth = React.useCallback(() => {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    generate.mutate(
      {
        period: "monthly",
        year: prev.getUTCFullYear(),
        month: prev.getUTCMonth() + 1,
        // Scoped statement when a collection is in view; whole vault on All.
        collection_id: activeCollectionId ?? undefined,
      },
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
  }, [generate, requirePro, activeCollectionId]);

  const reports = list.data ?? [];
  // Free tier sees only its latest `freeLimit` statement(s); the rest are walled.
  const visibleReports = allowed ? reports : reports.slice(0, freeLimit);
  const lockedCount = allowed ? 0 : Math.max(0, reports.length - visibleReports.length);
  const upcomingRows = upcoming.data ?? [];
  const nextMonthly = upcomingRows.find((r) => r.period === "monthly");
  const nextYearly = upcomingRows.find((r) => r.period === "yearly");

  return (
    <View>
      <NextStatementHeroCard
        nextMonthly={nextMonthly}
        nextYearly={nextYearly}
        latestReadyMonthly={latestReadyMonthly}
        readyCount={readyCount}
        loading={upcoming.isLoading}
        onView={onView}
        onSave={onSave}
        viewBusy={
          latestReadyMonthly ? isViewBusy(latestReadyMonthly.id) : false
        }
        saveBusy={
          latestReadyMonthly ? isSaveBusy(latestReadyMonthly.id) : false
        }
      />

      {activeCollectionName ? (
        <View
          className="mt-3 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5"
          style={{ backgroundColor: withAlpha(p.accent.mint, 0.1) }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: p.accent.mint,
            }}
          />
          <Text style={{ color: p.accent.mint, fontSize: 11, fontWeight: "700" }}>
            Generating for {activeCollectionName} — switch to All for the whole vault
          </Text>
        </View>
      ) : null}

      <View className="mt-5">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View>
            <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              Archive
            </Text>
            <Text className="mt-0.5 text-lg font-semibold text-ink">
              All statements · {reports.length}
            </Text>
          </View>

          <Pressable
            onPress={allowed ? onGenerateLastMonth : () => requirePro()}
            disabled={generate.isPending}
            accessibilityRole="button"
            accessibilityLabel="Generate last month's statement"
            hitSlop={8}
          >
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: withAlpha(p.accent.mint, 0.12),
                  opacity: pressed || generate.isPending ? 0.7 : 1,
                }}
              >
                {generate.isPending ? (
                  <ActivityIndicator size="small" color={p.accent.mint} />
                ) : (
                  <Sparkles size={12} color={p.accent.mint} strokeWidth={2.5} />
                )}
                <Text style={{ color: p.accent.mint, fontSize: 11, fontWeight: "800" }}>
                  {generate.isPending ? "Generating…" : "Generate"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

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
                    viewBusy={isViewBusy(r.id)}
                    saveBusy={isSaveBusy(r.id)}
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
  latestReadyMonthly,
  readyCount,
  loading,
  onView,
  onSave,
  viewBusy,
  saveBusy,
}: {
  nextMonthly: UpcomingReportWire | undefined;
  nextYearly: UpcomingReportWire | undefined;
  latestReadyMonthly: UserReportWire | null;
  readyCount: number;
  loading: boolean;
  onView: (r: UserReportWire) => void;
  onSave: (r: UserReportWire) => void;
  viewBusy: boolean;
  saveBusy: boolean;
}) {
  const p = useThemedPalette();
  const ready = !!latestReadyMonthly;

  return (
    <StatementCard>
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {loading ? (
            <Skeleton width={44} height={44} radius={12} />
          ) : (
            <StatementFileIcon size={44} />
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <>
                <Skeleton width="75%" height={18} />
                <View style={{ height: 6 }} />
                <Skeleton width="55%" height={12} />
              </>
            ) : ready ? (
              <>
                <Text style={{ color: p.ink.default, fontSize: 17, fontWeight: "700" }}>
                  {periodLabel(latestReadyMonthly)} Statement
                </Text>
                <Text style={{ color: p.ink.muted, fontSize: 13, marginTop: 4 }}>
                  {formatStatementDate(latestReadyMonthly.generated_at)} ·{" "}
                  {formatStatementSize(latestReadyMonthly.file_size_bytes)}
                  {readyCount > 1 ? ` · ${readyCount} statements archived` : ""}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: p.ink.default, fontSize: 17, fontWeight: "700" }}>
                  Portfolio statements
                </Text>
                <Text style={{ color: p.ink.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                  Loupe closes a PDF statement at the end of each month. Your archive
                  builds automatically — nothing to configure.
                </Text>
              </>
            )}
          </View>
        </View>

        {ready && latestReadyMonthly ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HeroActionButton
              label="View"
              icon={<Eye size={15} color={p.bg.base} strokeWidth={2.3} />}
              primary
              busy={viewBusy}
              onPress={() => onView(latestReadyMonthly)}
            />
            <HeroActionButton
              label="Download"
              icon={<Download size={15} color={p.ink.default} strokeWidth={2.3} />}
              busy={saveBusy}
              onPress={() => onSave(latestReadyMonthly)}
            />
          </View>
        ) : null}

        {!loading && nextMonthly ? (
          <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
            Next: {nextMonthly.label} · closes {formatCloseDate(nextMonthly.closes_at)}
            {nextYearly
              ? ` · Annual closes ${formatCloseDate(nextYearly.closes_at)}`
              : ""}
          </Text>
        ) : null}
      </View>
    </StatementCard>
  );
}

function HeroActionButton({
  label,
  icon,
  primary = false,
  busy = false,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const fg = primary ? p.bg.base : p.ink.default;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            minHeight: 42,
            borderRadius: 10,
            backgroundColor: primary ? p.ink.default : p.bg.base,
            borderWidth: primary ? 0 : 1,
            borderColor: p.line.default,
            opacity: busy ? 0.65 : pressed ? 0.9 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <>
              {icon}
              <Text style={{ color: fg, fontSize: 13, fontWeight: "600" }}>{label}</Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

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
  isLatest?: boolean;
}) {
  const p = useThemedPalette();
  const ready = report.status === "ready";
  const failed = report.status === "failed";
  const statusLabel = ready ? "Ready" : failed ? "Failed" : "Generating";
  const busy = viewBusy || saveBusy;
  const meta = ready
    ? `${formatStatementDate(report.generated_at)} · ${formatStatementSize(report.file_size_bytes)}`
    : statusLabel;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 13,
      }}
    >
      <Pressable
        onPress={() => ready && !busy && onView(report)}
        disabled={!ready || busy}
        accessibilityRole="button"
        accessibilityLabel={`Open ${periodLabel(report)} statement`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 }}
      >
        {({ pressed }) => (
          <>
            <StatementFileIcon size={36} variant="row" />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12, paddingRight: 8 }}>
              <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "600" }}>
                {periodLabel(report)} Statement
              </Text>
              <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}>
                {meta}
                {report.collection_name ? ` · ${report.collection_name}` : ""}
                {failed && report.error_message ? ` · ${report.error_message}` : ""}
              </Text>
            </View>
            {viewBusy ? (
              <ActivityIndicator size="small" color={p.ink.muted} style={{ marginRight: 8 }} />
            ) : null}
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => onSave(report)}
        disabled={!ready || busy}
        accessibilityRole="button"
        accessibilityLabel={`Download ${periodLabel(report)} statement`}
        hitSlop={6}
      >
        {({ pressed: dlPressed }) => (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: dlPressed ? withAlpha(p.bg.base, 0.8) : p.bg.base,
              opacity: !ready || busy ? 0.45 : 1,
            }}
          >
            {saveBusy ? (
              <ActivityIndicator size="small" color={p.ink.muted} />
            ) : (
              <Download size={15} color={p.ink.muted} strokeWidth={2.2} />
            )}
          </View>
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
      <StatementFileIcon size={36} />
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
