/**
 * GroupedList — the app's list layout language. Flat, not carded.
 *
 * Content sits directly on the page. Structure comes from ONE hairline
 * between rows and from the type scale — never from a box.
 *
 * The previous version wrapped every group in a rounded bordered card and put
 * each row's icon inside a tinted square. Stacked down a screen that reads as
 * generated scaffolding: a page of identical containers where the containers
 * are the loudest thing and the content is incidental. iOS Settings, Things,
 * Linear — everything that feels considered — draws a dim caption, then rows
 * on the page background, and lets a single hairline do the separating.
 *
 * The one rule worth keeping from the carded version: the separator insets to
 * where the label starts, so the icon column reads as a margin rather than a
 * cell in a table.
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
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Where a row's text begins — icon (20) + its gap (14). */
const ROW_TEXT_INSET = 34;

/**
 * A figure and its name. No border, no fill — the number carries it.
 *
 * A bordered tile per statistic made three numbers look like three buttons,
 * and put six edges on screen to communicate nothing.
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
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
    >
      <Text
        numberOfLines={1}
        style={[styles.statValue, { color: p.ink.default }]}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={[styles.statLabel, { color: p.ink.dim }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Figures across one line. Three is the comfortable maximum on a phone. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

/** A captioned group of rows, flat on the page. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const p = useThemedPalette();
  return (
    <View>
      <Text style={[styles.sectionLabel, { color: p.ink.dim }]}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

/**
 * One row in a {@link Section}.
 *
 * `isLast` drops the separator — a hairline under the final row is a line
 * fencing off empty space, which is why carded lists always looked like they
 * had one border too many.
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
    <View style={styles.row}>
      <Icon size={20} color={tint} strokeWidth={1.9} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: p.ink.default }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: p.ink.dim }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  const separated = (
    <View>
      {Body}
      {isLast ? null : (
        <View
          style={[
            styles.separator,
            { backgroundColor: p.line.default, marginLeft: ROW_TEXT_INSET },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        {separated}
      </Pressable>
    );
  }
  return separated;
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: 20 },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13 },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowDescription: { fontSize: 12 },
  separator: { height: StyleSheet.hairlineWidth },
});
