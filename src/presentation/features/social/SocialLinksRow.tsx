/**
 * SocialLinksRow — where else to find this collector.
 *
 * The lisacollects reference: one line per platform, brand icon + the
 * HANDLE ("@lisacollects"), not the URL — a wall of https reads as
 * configuration, a handle reads as a person. Tapping opens the canonical
 * URL the server stored; nothing here trusts or re-parses user input.
 *
 * Renders nothing for a profile without links, so callers can mount it
 * unconditionally under the bio.
 */
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  linkDisplayText,
  orderedLinks,
} from "@/presentation/features/social/socialLinks";
import { useThemedPalette } from "@/presentation/theme/tokens";

export function SocialLinksRow({
  links,
}: {
  links?: Record<string, string> | null;
}) {
  const p = useThemedPalette();
  const rows = orderedLinks(links);
  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {rows.map(({ platform, url }) => {
        const { Icon } = platform;
        return (
          <Pressable
            key={platform.key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              // Canonical https from the server; a failure to open (no
              // browser? platform app uninstalled?) is silently survivable.
              Linking.openURL(url).catch(() => {});
            }}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel={`${platform.label}: ${linkDisplayText(url)}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          >
            <Icon size={13} color={p.ink.muted} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={[styles.text, { color: p.ink.muted }]}
            >
              {linkDisplayText(url)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 5,
    marginTop: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "48%" },
  text: { fontSize: 12.5, fontWeight: "600" },
});
