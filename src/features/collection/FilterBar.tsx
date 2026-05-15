import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { CardSet } from "@/types/domain";
import { useVaultFilters } from "@/store/vaultStore";
import { palette } from "@/theme/tokens";

const SETS: (CardSet | "All")[] = [
  "All",
  "Pokemon Base Set",
  "2026 World Cup Goals",
  "Topps Chrome 2025",
  "Magic Alpha",
];

const GRADES = [1, 7, 8, 9, 10] as const;

export function FilterBar() {
  const { set, minGrade, setSet, setMinGrade } = useVaultFilters();

  return (
    <View className="gap-3">
      <FilterRow label="Set">
        {SETS.map((s) => (
          <Chip key={s} active={set === s} onPress={() => setSet(s)} label={s} />
        ))}
      </FilterRow>
      <FilterRow label="Min Grade">
        {GRADES.map((g) => (
          <Chip
            key={g}
            active={minGrade === g}
            onPress={() => setMinGrade(g)}
            label={g === 1 ? "Any" : `≥ ${g}`}
          />
        ))}
      </FilterRow>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 pr-4">{children}</View>
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full border px-3 py-1.5"
      style={{
        borderColor: active ? palette.accent.blue : palette.line.default,
        backgroundColor: active ? "rgba(10,132,255,0.12)" : palette.bg.elevated,
      }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color: active ? palette.accent.blue : palette.ink.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
