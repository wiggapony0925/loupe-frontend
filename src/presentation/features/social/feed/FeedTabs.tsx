/**
 * FeedTabs — Following · For You.
 *
 * An underline that slides, not a segmented pill: the tabs sit directly over
 * a scrolling river of content, and a filled control there reads as a
 * toolbar floating on top of the feed rather than as its heading.
 *
 * The labels are fixed and few, so they're laid out by flex rather than in a
 * scroller — a tab strip you can accidentally scroll past is a tab strip
 * that hides tabs.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { FeedTab } from "@/infrastructure/http";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Two, not three. "Your Posts" moved to your PROFILE, where the rest of
 *  your stuff already lives — a feed is for other people's posts, and a tab
 *  showing only your own was a filter pretending to be a feed. The `mine`
 *  tab still exists on the API; the profile grid is what reads it now. */
export const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "foryou", label: "For You" },
];

export function FeedTabs({
  value,
  onChange,
}: {
  value: FeedTab;
  onChange: (tab: FeedTab) => void;
}) {
  const p = useThemedPalette();
  return (
    <View style={[styles.row, { borderBottomColor: p.line.default }]}>
      {FEED_TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? p.ink.default : p.ink.dim,
                  fontWeight: active ? "800" : "600",
                },
              ]}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.rule,
                { backgroundColor: active ? p.accent.mint : "transparent" },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: "center", gap: 8, paddingTop: 6 },
  label: { fontSize: 15, letterSpacing: -0.2 },
  rule: { height: 2.5, alignSelf: "stretch", marginHorizontal: 14, borderRadius: 2 },
});
