import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Download, Eye } from "lucide-react-native";
import { routes } from "@/shared/routes";
import { Skeleton } from "@/presentation/components/Skeleton";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { StatementCard, StatementFileIcon } from "./StatementFileIcon";
import {
  formatCloseDate,
  formatStatementDate,
  formatStatementSize,
  periodLabel,
} from "./statementFormat";
import { useStatementSummary } from "./useStatementSummary";

interface StatementsEntryCardProps {
  onViewLatest?: () => void;
  onSaveLatest?: () => void;
  viewBusy?: boolean;
  saveBusy?: boolean;
}

export function StatementsEntryCard({
  onViewLatest,
  onSaveLatest,
  viewBusy = false,
  saveBusy = false,
}: StatementsEntryCardProps) {
  const p = useThemedPalette();
  const { loading, latestReadyMonthly, readyCount, nextMonthly } =
    useStatementSummary();

  const ready = !!latestReadyMonthly;
  const title = ready
    ? `${periodLabel(latestReadyMonthly)} Statement`
    : nextMonthly
      ? `${nextMonthly.label} Statement`
      : "Portfolio Statements";

  const subtitle = ready
    ? `Ready · ${formatStatementDate(latestReadyMonthly.generated_at)} · ${formatStatementSize(latestReadyMonthly.file_size_bytes)}${
        readyCount > 1 ? ` · ${readyCount} archived` : ""
      }`
    : nextMonthly
      ? `Closes ${formatCloseDate(nextMonthly.closes_at)}`
      : "Monthly PDF archive";

  const showActions = ready && onViewLatest && onSaveLatest;

  return (
    <StatementCard>
      <Pressable
        onPress={() => router.push(routes.statements())}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {({ pressed }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              opacity: pressed ? 0.88 : 1,
            }}
          >
            {loading ? (
              <Skeleton width={40} height={40} radius={12} />
            ) : (
              <StatementFileIcon size={40} />
            )}

            <View style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <>
                  <Skeleton width="70%" height={15} />
                  <View style={{ height: 6 }} />
                  <Skeleton width="50%" height={11} />
                </>
              ) : (
                <>
                  <Text
                    numberOfLines={1}
                    style={{ color: p.ink.default, fontSize: 15, fontWeight: "700" }}
                  >
                    {title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}
                  >
                    {subtitle}
                  </Text>
                </>
              )}
            </View>

            <ChevronRight size={18} color={p.ink.dim} strokeWidth={2.4} />
          </View>
        )}
      </Pressable>

      {showActions ? (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: p.line.default,
            paddingTop: 12,
          }}
        >
          <StatementAction
            label="View"
            icon={<Eye size={14} color={p.bg.base} strokeWidth={2.3} />}
            primary
            busy={viewBusy}
            onPress={onViewLatest}
          />
          <StatementAction
            label="Download"
            icon={<Download size={14} color={p.ink.default} strokeWidth={2.3} />}
            busy={saveBusy}
            onPress={onSaveLatest}
          />
        </View>
      ) : null}
    </StatementCard>
  );
}

function StatementAction({
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
            gap: 6,
            minHeight: 38,
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
