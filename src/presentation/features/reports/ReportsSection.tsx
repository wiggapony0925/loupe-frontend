/**
 * Portfolio statements — Amex-style PDF statements of the user's
 * collection, generated monthly or yearly and persisted to the user's
 * account for life.
 *
 * Visual language:
 *   - Hero "statement card" with embossed feel, mint accent, brand mark
 *     (Robinhood metal card / Amex Black Card vibe).
 *   - Segmented control for Monthly | Yearly (Robinhood pill segments).
 *   - Primary CTA pill (mint, full width) "Generate statement →".
 *   - List rows with leading status dot, monospace date, ghost download
 *     button. Subtle dividers, no heavy borders.
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
  useGenerateReport,
  useReports,
} from "@/application/queries";
import type { UserReportWire } from "@/infrastructure/http";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

// ─── helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

type PeriodKind = "monthly" | "yearly";

function lastMonth(): { year: number; month: number; long: string; short: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    long: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    short: `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
  };
}

function lastYear(): { year: number; long: string; short: string } {
  const y = new Date().getFullYear() - 1;
  return { year: y, long: `${y}`, short: `${String(y).slice(-2)}` };
}

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
  if (r.period === "yearly") return String(start.getFullYear());
  return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
}

// ─── component ───────────────────────────────────────────────────────────

export function ReportsSection() {
  const p = useThemedPalette();
  const list = useReports();
  const gen = useGenerateReport();
  const [kind, setKind] = React.useState<PeriodKind>("monthly");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const monthly = React.useMemo(() => lastMonth(), []);
  const yearly = React.useMemo(() => lastYear(), []);

  const onGenerate = React.useCallback(async () => {
    try {
      if (kind === "monthly") {
        await gen.mutateAsync({
          period: "monthly",
          year: monthly.year,
          month: monthly.month,
        });
      } else {
        await gen.mutateAsync({ period: "yearly", year: yearly.year });
      }
    } catch (e) {
      Alert.alert(
        "Couldn't generate statement",
        e instanceof Error ? e.message : "Please try again in a moment.",
      );
    }
  }, [gen, kind, monthly, yearly]);

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

  return (
    <View>
      <SectionHeader eyebrow="Statements" title="Reports" />

      <StatementHeroCard
        kind={kind}
        monthlyShort={monthly.short}
        yearlyShort={yearly.short}
      />

      <View className="mt-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
      </View>

      <View className="mt-3">
        <PrimaryButton
          label={
            kind === "monthly"
              ? `Generate ${monthly.long} statement`
              : `Generate ${yearly.long} statement`
          }
          onPress={onGenerate}
          busy={gen.isPending}
        />
      </View>

      <View className="mt-5">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Archive · {reports.length}
        </Text>

        <View className="mt-2">
          {list.isLoading ? (
            <SkeletonList />
          ) : reports.length === 0 ? (
            <EmptyState />
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

function StatementHeroCard({
  kind,
  monthlyShort,
  yearlyShort,
}: {
  kind: PeriodKind;
  monthlyShort: string;
  yearlyShort: string;
}) {
  const p = useThemedPalette();
  const periodChip = kind === "monthly" ? monthlyShort : yearlyShort;

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
            className="rounded-md px-2 py-0.5"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.12) }}
          >
            <Text
              className="text-[10px] font-bold tracking-[2px]"
              style={{ color: p.accent.mint }}
            >
              {periodChip}
            </Text>
          </View>
        </View>

        <Text className="mt-6 text-2xl font-semibold text-ink">
          Your portfolio,{"\n"}on paper.
        </Text>
        <Text className="mt-2 text-xs leading-5 text-ink-muted">
          A monthly or yearly PDF of your collection — total value, top
          movers, grade mix, and full holdings. Saved to your account
          forever.
        </Text>

        <View
          className="mt-5 flex-row items-center justify-between border-t pt-3"
          style={{ borderColor: withAlpha(p.line.default, 0.6) }}
        >
          <View>
            <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">
              Member
            </Text>
            <Text className="mt-0.5 text-xs font-semibold text-ink">
              LOUPE COLLECTOR
            </Text>
          </View>
          <View>
            <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">
              Period
            </Text>
            <Text
              className="mt-0.5 text-right text-xs font-semibold"
              style={{ color: p.accent.mint }}
            >
              {kind === "monthly" ? "MONTHLY" : "ANNUAL"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── segmented control ───────────────────────────────────────────────────

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const p = useThemedPalette();
  return (
    <View
      className="flex-row rounded-full border border-line p-1"
      style={{ backgroundColor: p.bg.sunken }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1 items-center justify-center rounded-full py-2"
            style={{
              backgroundColor: active ? p.bg.elevated : "transparent",
              shadowColor: active ? "#000" : "transparent",
              shadowOpacity: active ? 0.25 : 0,
              shadowRadius: active ? 6 : 0,
              shadowOffset: { width: 0, height: 2 },
              elevation: active ? 2 : 0,
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: active ? p.ink.default : p.ink.muted }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── primary CTA ─────────────────────────────────────────────────────────

function PrimaryButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="flex-row items-center justify-center rounded-full px-5 py-3.5"
      style={{
        backgroundColor: busy ? withAlpha(p.accent.mint, 0.5) : p.accent.mint,
      }}
    >
      {busy ? (
        <>
          <ActivityIndicator color={p.bg.base} />
          <Text
            className="ml-2 text-sm font-bold"
            style={{ color: p.bg.base }}
          >
            Generating…
          </Text>
        </>
      ) : (
        <Text
          className="text-sm font-bold tracking-wide"
          style={{ color: p.bg.base }}
        >
          {label}  →
        </Text>
      )}
    </Pressable>
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
            {ready ? "DOWNLOAD" : statusLabel.toUpperCase()}
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

function EmptyState() {
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
        Generate one to start your archive.{"\n"}Your statements live with your account forever.
      </Text>
    </View>
  );
}
