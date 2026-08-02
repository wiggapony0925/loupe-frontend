/**
 * PasswordStrength — four-segment meter under the sign-up password field.
 *
 * Scoring is `@loupe/auth`'s, shared with the web signup form so the same
 * password doesn't read "Good" on one surface and "Fair" on the other.
 * Renders nothing until the user has typed, so an untouched form stays quiet.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { scorePassword } from "@loupe/auth";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function PasswordStrength({ password }: { password: string }) {
  const p = useThemedPalette();
  const { score, label } = scorePassword(password);
  if (score === 0) return null;

  const color =
    score === 1
      ? p.accent.rose
      : score === 2
        ? p.accent.amber
        : score === 3
          ? p.accent.blue
          : p.accent.mint;

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`Password strength: ${label}`}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((seg) => (
          <View
            key={seg}
            style={[
              styles.bar,
              {
                backgroundColor:
                  seg <= score ? color : withAlpha(p.ink.default, 0.1),
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  bars: { flex: 1, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  label: { fontSize: 11, fontWeight: "700", minWidth: 58, textAlign: "right" },
});
