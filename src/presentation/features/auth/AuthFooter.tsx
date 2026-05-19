/**
 * AuthFooter — terms + privacy fineprint shown beneath onboarding forms.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";

export function AuthFooter() {
  const p = useThemedPalette();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: p.ink.dim }]}>
        By continuing you agree to the Loupe{"\n"}
        <Text style={{ color: p.ink.muted }}>Terms of Service</Text>
        {" · "}
        <Text style={{ color: p.ink.muted }}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 16 },
  text: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
