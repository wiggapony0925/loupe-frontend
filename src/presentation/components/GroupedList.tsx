/**
 * GroupedList — the app's settings-style layout language.
 *
 * A dim, wide-tracked section caption over a single rounded card, rows
 * hairline-separated inside it, each row led by a tinted icon square. Plus
 * `StatTile` for the bordered figure cards that sit above a group.
 *
 * These lived privately inside `app/settings.tsx`, which is why every other
 * screen that wanted the same look re-invented a slightly different version of
 * it — different radii, different label tracking, different row padding. The
 * Settings page is the best-organised surface in the app; extracting its
 * primitives means other screens *are* that language rather than imitating it,
 * and a spacing decision is made once.
 *
 *   <StatRow>
 *     <StatTile label="Portfolio" value="$68.1k" />
 *     <StatTile label="Cards" value="124" />
 *   </StatRow>
 *   <Section title="Collecting">
 *     <Row icon={Users} label="Community" description="Follow collectors" />
 *     <Row icon={FileText} label="Statements" isLast />
 *   </Section>
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";

/**
 * A bordered figure card. `value` is the loud thing; `label` is a whisper
 * beneath it, so a row of these reads as data rather than as buttons.
 */
export function StatTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}
    >
      <View className="rounded-2xl border border-line bg-bg-elevated px-3 py-3">
        <Text numberOfLines={1} className="text-[18px] font-bold text-ink">
          {value}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-ink-dim"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Equal-width tiles across one line. Three is the comfortable maximum. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row gap-2.5">{children}</View>;
}

/** A captioned group: the label sits OUTSIDE the card, as on iOS. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        {children}
      </View>
    </View>
  );
}

/**
 * One row inside a {@link Section}.
 *
 * `isLast` drops the separator — the card's own rounded edge ends the group,
 * and a hairline sitting on top of it reads as a rendering artefact.
 */
export function Row({
  icon: Icon,
  iconTint,
  label,
  description,
  trailing,
  onPress,
  isLast = false,
}: {
  icon: LucideIcon;
  iconTint?: string;
  label: string;
  description?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const p = useThemedPalette();
  const tint = iconTint ?? p.ink.muted;
  const Body = (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${isLast ? "" : "border-b border-line"}`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-lg"
        // 18 hex ≈ 9% — a tint that reads as a coloured chip without becoming
        // a second competing surface.
        style={{ backgroundColor: `${tint}18` }}
      >
        <Icon size={16} color={tint} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-medium text-ink">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-[11px] text-ink-dim">{description}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {Body}
      </Pressable>
    );
  }
  return Body;
}
