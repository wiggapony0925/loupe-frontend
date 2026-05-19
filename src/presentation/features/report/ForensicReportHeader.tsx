import React from "react";
import { Text, View } from "react-native";
import { Calendar, Hash } from "lucide-react-native";
import { Badge } from "@/presentation/components/Badge";
import type { ForensicReport } from "@/domain";
import { useThemedPalette } from "@/presentation/theme/tokens";

interface ForensicReportHeaderProps {
  report: ForensicReport;
}

export function ForensicReportHeader({ report }: ForensicReportHeaderProps) {
  const { card } = report;
  return (
    <View className="gap-3">
      <Badge label={card.set} tone="blue" />
      <Text className="text-2xl font-semibold text-ink">{card.title}</Text>
      <View className="flex-row items-center gap-4">
        <Meta Icon={Calendar} text={`${card.year}`} />
        <Meta Icon={Hash} text={report.id} />
      </View>
    </View>
  );
}

function Meta({ Icon, text }: { Icon: typeof Calendar; text: string }) {
  const p = useThemedPalette();
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon size={12} color={p.ink.dim} />
      <Text className="text-xs text-ink-muted">{text}</Text>
    </View>
  );
}
