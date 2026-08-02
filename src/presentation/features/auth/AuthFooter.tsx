/**
 * AuthFooter — terms + privacy fineprint shown beneath onboarding forms.
 *
 * Both documents open pre-auth (the `legal` segment is on the root layout's
 * public allowlist), so these are real links rather than link-colored text.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useThemedPalette } from "@/presentation/theme/tokens";

function LegalLink({ doc, label }: { doc: "terms" | "privacy"; label: string }) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={() => router.push(`/legal/${doc}`)}
      hitSlop={10}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={[styles.link, { color: p.ink.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function AuthFooter() {
  const p = useThemedPalette();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: p.ink.dim }]}>
        By continuing you agree to the Loupe
      </Text>
      <View style={styles.links}>
        <LegalLink doc="terms" label="Terms of Service" />
        <Text style={[styles.text, { color: p.ink.dim }]}>·</Text>
        <LegalLink doc="privacy" label="Privacy Policy" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 16, gap: 2 },
  text: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  links: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
