/**
 * Welcome — brand splash + entry CTAs.
 *
 * First screen new users see. The mint accent + uppercase tagline echo
 * the iOS launch screen, then we hand off to /sign-up or /sign-in.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Camera,
  Gauge,
  type LucideIcon,
  Mail,
  TrendingUp,
  UserPlus,
} from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuthScreen } from "@/presentation/features/auth/AuthScreen";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** What Loupe does, in three lines — anchors the first impression. */
const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Camera,
    title: "Scan & identify",
    desc: "Point your camera — we ID the card and its live price.",
  },
  {
    icon: TrendingUp,
    title: "Track your vault",
    desc: "Every card valued like a position in your portfolio.",
  },
  {
    icon: Gauge,
    title: "Grade before you slab",
    desc: "Estimate centering, edges & surface in seconds.",
  },
];

export default function WelcomeScreen() {
  const p = useThemedPalette();
  return (
    <AuthScreen>
      <View style={styles.hero}>
        <View
          style={[
            styles.badge,
            { backgroundColor: p.bg.elevated, borderColor: p.line.default },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: p.accent.mint }]} />
          <Text style={[styles.badgeText, { color: p.ink.muted }]}>LOUPE</Text>
        </View>
        <Text style={[styles.title, { color: p.ink.default }]}>
          See every grain.
        </Text>
        <Text style={[styles.subtitle, { color: p.ink.muted }]}>
          Forensic-grade grading, on every card you own.
        </Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <View key={title} style={styles.feature}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: withAlpha(p.accent.mint, 0.14) },
              ]}
            >
              <Icon size={18} color={p.accent.mint} strokeWidth={2} />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: p.ink.default }]}>
                {title}
              </Text>
              <Text style={[styles.featureDesc, { color: p.ink.muted }]}>
                {desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Create Account"
          icon={UserPlus}
          variant="mint"
          onPress={() => router.push("/(auth)/sign-up")}
        />
        <PrimaryButton
          label="Sign In"
          icon={Mail}
          variant="ghost"
          onPress={() => router.push("/(auth)/sign-in")}
        />
      </View>

      <AuthFooter />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 16, alignItems: "flex-start", paddingTop: 64 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  title: { fontSize: 42, fontWeight: "800", letterSpacing: -1, lineHeight: 46 },
  subtitle: { fontSize: 16, lineHeight: 22, maxWidth: 320 },
  features: { gap: 18, marginTop: 36 },
  feature: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 14.5, fontWeight: "700" },
  featureDesc: { fontSize: 12.5, lineHeight: 17 },
  actions: { gap: 12, marginTop: 32 },
});
