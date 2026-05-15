import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { CardSet } from "@/types/domain";
import { useVaultFilters } from "@/store/vaultStore";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { TcgMark, tcgShortLabel } from "@/components/brand/TcgMark";

const SETS: (CardSet | "All")[] = [
  "All",
  "Pokemon Base Set",
  "2026 World Cup Goals",
  "Topps Chrome 2025",
  "Magic Alpha",
];

const GRADES = [1, 7, 8, 9, 10] as const;

/** Brand-evocative accent colours used to tint each TCG chip. */
function tcgTint(set: CardSet | "All"): string {
  switch (set) {
    case "Pokemon Base Set":
      return "#FFCB05"; // pikachu yellow
    case "2026 World Cup Goals":
      return "#00B16A"; // pitch green
    case "Topps Chrome 2025":
      return "#E2231A"; // baseball red
    case "Magic Alpha":
      return "#7E5BEF"; // arcane purple
    case "All":
    default:
      return "#7AA2FF"; // neutral blue
  }
}

export function FilterBar() {
  const { set, minGrade, setSet, setMinGrade } = useVaultFilters();

  return (
    <View className="gap-3">
      <FilterRow label="Category">
        {SETS.map((s) => (
          <TcgChip
            key={s}
            tcg={s}
            active={set === s}
            onPress={() => setSet(s)}
          />
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

function TcgChip({
  tcg,
  active,
  onPress,
}: {
  tcg: CardSet | "All";
  active: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const tint = tcgTint(tcg);
  const label = tcgShortLabel(tcg);
  // Logo glyph wants a contrasting ink + chip-coloured background.
  const glyphInk = active ? tint : p.ink.default;
  const glyphBg = active ? p.bg.base : p.bg.elevated;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} filter`}
      className="flex-row items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5"
      style={({ pressed }) => ({
        borderColor: active ? withAlpha(tint, 0.55) : p.line.default,
        backgroundColor: active ? withAlpha(tint, 0.14) : p.bg.elevated,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 24,
          height: 24,
          backgroundColor: glyphBg,
          borderWidth: 1,
          borderColor: active ? withAlpha(tint, 0.5) : p.line.default,
        }}
      >
        <TcgMark set={tcg} size={16} color={glyphInk} background={glyphBg} />
      </View>
      <Text
        className="text-xs font-semibold"
        style={{ color: active ? tint : p.ink.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="rounded-full border px-3.5 py-1.5"
      style={({ pressed }) => ({
        borderColor: active ? withAlpha(p.accent.blue, 0.4) : p.line.default,
        backgroundColor: active ? withAlpha(p.accent.blue, 0.12) : p.bg.elevated,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: active ? p.accent.blue : p.ink.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
