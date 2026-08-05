/**
 * NotFoundScreen — the app's dead end, matching loupe-web's 404.
 *
 * The native counterpart to `loupe-web/src/features/misc/NotFound`: the same
 * subtle aurora wash, the same oversized mint numeral, the same words (from
 * `@loupe/marketing`, so a copy edit can't reach only one client). A user who
 * taps a stale push notification and a user who opens a stale bookmark should
 * land on the same apology.
 *
 * Where it deliberately diverges from the web is navigation. The web can send
 * everyone to `/` because its home page is public; the app's home is behind
 * the auth guard, so an unauthenticated visitor pushed there is bounced
 * straight to the welcome screen — a second redirect that looks like the
 * button misfired. So the primary action reads the session and goes somewhere
 * that actually exists for this user.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Compass, Home, LogIn } from "lucide-react-native";
import { NOT_FOUND } from "@loupe/marketing";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuroraField } from "@/presentation/brand/AuroraField";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { notFoundActions } from "./notFoundActions";

export function NotFoundScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const actions = notFoundActions(isAuthenticated);

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <AuroraField variant="subtle" height={520} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        {/* Scrolls only when it has to. At the default text size everything
            fits; at a 2x Dynamic Type setting the numeral alone is taller
            than a small phone, and centering it in a fixed View clipped the
            buttons off the bottom with no way to reach them. */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(340)} style={styles.inner}>
            <LoupeMark size={30} />

            {/* Capped: the display numeral can't be made to fit any phone at
                2x, and it's decorative — the title carries the meaning, so
                it's the one that stays free to scale. Hidden from screen
                readers for the same reason; "404" announced before the
                sentence is noise, not information. */}
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              maxFontSizeMultiplier={1.3}
              style={[styles.code, { color: p.accent.mint }]}
            >
              {NOT_FOUND.code}
            </Text>

            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.6}
              style={[styles.title, { color: p.ink.default }]}
            >
              {NOT_FOUND.title}
            </Text>
            <Text style={[styles.message, { color: p.ink.muted }]}>
              {NOT_FOUND.message}
            </Text>

            {/* `replace`, not `push`. A 404 is not a place worth keeping in
                the back stack — pushing home on top of it means the system
                back gesture returns the user to the error they just left. */}
            <View style={styles.actions}>
              <PrimaryButton
                label={actions.primary.label}
                icon={actions.primary.kind === "signIn" ? LogIn : Home}
                onPress={() => router.replace(actions.primary.href)}
              />
              {actions.secondary ? (
                <PrimaryButton
                  label={actions.secondary.label}
                  icon={Compass}
                  variant="ghost"
                  onPress={() => router.replace(actions.secondary!.href)}
                />
              ) : null}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Stacked, not side by side.
 *
 * The web sets these in a row, which works at 480px. On a 375pt phone "Browse
 * the market" and "Back home" side by side leave each button about 150pt wide
 * — narrower than the comfortable tap target for a label that long, and the
 * text wraps to two lines inside the pill. Full-width stacked buttons are also
 * simply what every other CTA in this app looks like.
 */
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  inner: { alignItems: "center", gap: 10 },
  code: {
    fontSize: 96,
    lineHeight: 104,
    fontWeight: "800",
    letterSpacing: -4,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 22 },
});
