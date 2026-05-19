/**
 * AuthScreen — shared layout for every onboarding screen.
 *
 * Centers content inside a SafeAreaView, lifts the keyboard on iOS, and
 * paints the Loupe dark background edge-to-edge.
 */
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemedPalette } from "@/presentation/theme/tokens";

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const p = useThemedPalette();
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, { backgroundColor: p.bg.base }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  inner: { flex: 1, justifyContent: "center", gap: 24 },
});
