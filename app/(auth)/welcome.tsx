/**
 * Welcome — the pre-auth front page.
 *
 * This is the first screen an unauthenticated launch lands on (see the root
 * layout's redirect), so it carries the same pitch as loupe-web's marketing
 * landing: the "Your cards are an asset." headline over a live fanned stack of
 * real trending cards. Copy comes from `@loupe/marketing` so the app and the
 * website can't drift into two different pitches.
 *
 * Single screenful, no scrolling: three fixed blocks (pitch / card / actions)
 * with the card given the slack in between. It sizes off the live viewport
 * rather than fixed numbers so a small phone shrinks the card instead of
 * pushing the sign-up button off the bottom.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { HERO } from "@loupe/marketing";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
import { AuroraField } from "@/presentation/brand/AuroraField";
import { HeroCardStack } from "@/presentation/features/marketing/HeroCardStack";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { useHeroCards } from "@/application/queries/catalog/useHeroCards";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function WelcomeScreen() {
  const p = useThemedPalette();
  const { height } = useWindowDimensions();
  // Same feed the website's hero uses, replayed from the last launch so the
  // first screen paints real cards instead of a spinner.
  const { cards, isLoading, isError } = useHeroCards();

  // The card is the only elastic element — the pitch and the actions both have
  // to render in full, so the card takes whatever height is left over. Clamped
  // so it never gets so small it stops reading as card art.
  const cardWidth = Math.round(
    Math.max(112, Math.min(168, (height - 470) / 1.4)),
  );

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <AuroraField variant="hero" height={Math.round(height * 0.62)} />

      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(420)}>
            <View style={styles.brandRow}>
              <LoupeMark size={22} color={p.ink.default} />
              <Text style={[styles.wordmark, { color: p.ink.default }]}>
                LOUPE
              </Text>
            </View>

            <Text style={[styles.headline, { color: p.ink.default }]}>
              {HERO.headlineNarrow.join("\n")}
            </Text>
            <Text style={[styles.sub, { color: p.ink.muted }]}>
              {HERO.subShort}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(460).delay(120)}
            style={styles.stackWrap}
          >
            <HeroCardStack
              cards={cards}
              isLoading={isLoading}
              isError={isError}
              width={cardWidth}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(460).delay(200)}
            style={styles.actions}
          >
            <Text style={[styles.disclaimer, { color: p.ink.dim }]}>
              {HERO.disclaimer}
            </Text>
            <PrimaryButton
              label={HERO.ctaSecondary}
              variant="mint"
              onPress={() => router.push("/(auth)/sign-up")}
            />
            <Pressable
              onPress={() => router.push("/(auth)/sign-in")}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.signIn, { color: p.ink.dim }]}>
                Already have an account?{" "}
                <Text style={{ color: p.ink.default, fontWeight: "600" }}>
                  Sign in
                </Text>
              </Text>
            </Pressable>
            <AuthFooter />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 14,
    paddingBottom: 8,
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  wordmark: { fontSize: 13, fontWeight: "700", letterSpacing: 3.4 },
  headline: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1.3,
    lineHeight: 40,
    marginTop: 26,
  },
  sub: { fontSize: 14.5, lineHeight: 21, marginTop: 12, maxWidth: 330 },
  // `minHeight: 0` lets this actually shrink — without it the flex child keeps
  // its content height and pushes the actions off-screen on a short phone.
  stackWrap: { flex: 1, minHeight: 0, justifyContent: "center" },
  actions: { gap: 10 },
  disclaimer: { fontSize: 11, textAlign: "center", marginBottom: 2 },
  signIn: { fontSize: 13.5, textAlign: "center" },
});
