/**
 * AuthScreen — shared layout for the onboarding forms.
 *
 * Paints the Loupe background edge-to-edge under a quiet wash of the same
 * aurora the welcome screen and the website's landing hero use, so moving from
 * the front page into a form feels like one surface rather than two.
 *
 * The forms are sized to fit a phone without scrolling. The ScrollView is still
 * here, but only as keyboard insurance: `flexGrow: 1` + `bounces={false}` means
 * it sits perfectly still while the keyboard is down, and only becomes
 * scrollable once the keyboard shrinks the frame — otherwise the password field
 * and submit button would be stranded underneath it.
 */
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { AuroraField } from "@/presentation/brand/AuroraField";
import { useThemedPalette } from "@/presentation/theme/tokens";

export function AuthScreen({
  children,
  /** Shows a back chevron. Omit on screens with nowhere to go back to. */
  onBack,
}: {
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const p = useThemedPalette();
  const goBack = onBack ?? (router.canGoBack() ? () => router.back() : undefined);

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <AuroraField variant="subtle" height={360} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          {/* Outside the ScrollView: the back button belongs to the screen, not
              to the centred form, and inside it would drift with the content. */}
          {goBack ? (
            <Pressable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={[
                styles.back,
                {
                  backgroundColor: p.bg.elevated,
                  borderColor: p.line.default,
                },
              ]}
            >
              <ChevronLeft size={20} color={p.ink.default} />
            </Pressable>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inner}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  // Centering lives on the content container, NOT on a `flex: 1` child.
  // A flex-1 child is pinned to the scroll frame's height, so as soon as the
  // form is taller than the frame — a big Dynamic Type setting, or just the
  // signup form — `justifyContent: center` pushed the top of the content
  // ABOVE the parent's bounds. iOS doesn't deliver touches outside a parent's
  // frame, so the email and password fields rendered but could not be tapped
  // at all: no focus, no keyboard. `flexGrow` centers short content and lets
  // tall content grow and scroll instead of overflowing.
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  back: {
    marginLeft: 24,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  inner: { gap: 18 },
});
