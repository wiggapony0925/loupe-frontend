/**
 * AuthHeader — the title + subtitle block above each auth form.
 *
 * Shared by sign-in, sign-up, and forgot-password so the three read as one
 * flow. Deliberately carries no brand mark: the welcome screen the user just
 * came from has the wordmark, and repeating it here only stacked a second
 * rounded tile directly under the back button.
 */
import React from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useThemedPalette } from "@/presentation/theme/tokens";

export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const p = useThemedPalette();
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.wrap}>
      <Text style={[styles.title, { color: p.ink.default }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: p.ink.muted }]}>{subtitle}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignItems: "flex-start" },
  title: { fontSize: 29, fontWeight: "800", letterSpacing: -0.9 },
  subtitle: { fontSize: 14.5, lineHeight: 20, maxWidth: 320 },
});
