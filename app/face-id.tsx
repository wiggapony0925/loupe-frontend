/**
 * Face ID setup — /face-id.
 *
 * The screen has one job: make "you will never type your password again"
 * feel true before you commit to it. So the scan frame is live from the
 * moment you arrive, it actually runs Face ID when you tap (a toggle that
 * flips without proving the sensor works is how people lock themselves
 * out), and the copy is about the minute you save rather than the keychain
 * it saves it in.
 *
 * Four states, and each one changes the whole screen rather than just a
 * button label:
 *
 *   unavailable  no hardware or nothing enrolled → say so plainly and point
 *                at the one place that fixes it.
 *   off          the pitch: the frame breathes, the benefit leads.
 *   enabling     the frame scans while iOS's own sheet is up, so the app is
 *                visibly part of the same act.
 *   on           the frame resolves, the copy switches from promise to
 *                fact, and turning it off is available but quiet.
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ChevronLeft,
  Fingerprint,
  KeyRound,
  Lock,
  ScanFace,
  Zap,
} from "lucide-react-native";
import { useBiometrics } from "@/application/stores/biometricStore";
import { AuroraField } from "@/presentation/brand/AuroraField";
import {
  authenticateBiometric,
  getBiometricCapability,
  type BiometricCapability,
} from "@/infrastructure/biometrics";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { FaceScan, type FaceScanState } from "@/presentation/features/auth/FaceScan";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export default function FaceIdScreen() {
  const p = useThemedPalette();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const enabled = useBiometrics((s) =>
    userId ? Boolean(s.enabledBy[userId]) : false,
  );
  const setEnabled = useBiometrics((s) => s.setEnabled);
  const markPromptSeen = useBiometrics((s) => s.markPromptSeen);

  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getBiometricCapability().then(setCap);
  }, []);

  const label = cap?.label ?? "Face ID";
  const isFace = cap?.faceId ?? true;
  // Until /me resolves there is no account to attach the lock to; enabling
  // then silently did nothing while Settings went on reporting "Off".
  const ready = userId !== null;
  const unavailable = cap !== null && !cap.available;

  const scanState: FaceScanState = busy
    ? "scanning"
    : failed
      ? "failed"
      : enabled
        ? "success"
        : "idle";

  const turnOn = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const ok = await authenticateBiometric(`Enable ${label} for Loupe`);
      if (ok) {
        setEnabled(userId, true);
        markPromptSeen(userId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      } else {
        setFailed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => {},
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () => {
    if (!userId) return;
    Haptics.selectionAsync().catch(() => {});
    setEnabled(userId, false);
    setFailed(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <AuroraField variant="subtle" height={420} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.back,
              {
                backgroundColor: p.bg.elevated,
                borderColor: p.line.default,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <ChevronLeft size={20} color={p.ink.default} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(420)} style={styles.heroWrap}>
            <FaceScan state={scanState} size={148}>
              {enabled && !busy ? (
                <Check size={44} color={p.accent.mint} strokeWidth={2.6} />
              ) : isFace ? (
                <ScanFace
                  size={46}
                  color={failed ? p.accent.rose : p.accent.mint}
                  strokeWidth={1.6}
                />
              ) : (
                <Fingerprint size={46} color={p.accent.mint} strokeWidth={1.6} />
              )}
            </FaceScan>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(420).delay(80)}>
            <Text style={[styles.title, { color: p.ink.default }]}>
              {unavailable
                ? `${label} isn't set up`
                : enabled
                  ? `${label} is on`
                  : busy
                    ? "Look at your phone"
                    : "Never type your password again"}
            </Text>
            <Text style={[styles.copy, { color: p.ink.muted }]}>
              {unavailable
                ? `This phone has no ${label} enrolled yet. Add it in Settings ▸ ${label} & Passcode, then come back — it takes a minute.`
                : enabled
                  ? `Loupe locks the moment you leave and opens the instant it sees you. Your session is held in the iOS Keychain on this phone.`
                  : failed
                    ? `${label} didn't confirm that time. No harm done — try again whenever you're ready.`
                    : `Loupe locks itself when you leave and opens with a glance. One look instead of a password, every time.`}
            </Text>
          </Animated.View>

          {!unavailable ? (
            <Animated.View
              entering={FadeInDown.duration(420).delay(160)}
              style={styles.points}
            >
              <Point
                icon={<Zap size={16} color={p.accent.mint} strokeWidth={2.4} />}
                title="Instant"
                body={`A glance replaces your password on this phone.`}
                p={p}
              />
              <Point
                icon={<Lock size={16} color={p.accent.mint} strokeWidth={2.4} />}
                title="Nothing leaves the phone"
                body="Your face never reaches Loupe — iOS answers yes or no, and the session stays in the Keychain."
                p={p}
              />
              <Point
                icon={<KeyRound size={16} color={p.accent.mint} strokeWidth={2.4} />}
                title="Always a way in"
                body={`If ${label} can't see you, your passcode works — and "Switch account" is always on the lock screen.`}
                p={p}
              />
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.duration(420).delay(240)}
            style={styles.actions}
          >
            {unavailable ? null : enabled ? (
              <>
                <View
                  style={[
                    styles.onBadge,
                    {
                      borderColor: withAlpha(p.accent.mint, 0.38),
                      backgroundColor: withAlpha(p.accent.mint, 0.12),
                    },
                  ]}
                >
                  <Check size={15} color={p.accent.mint} strokeWidth={3} />
                  <Text style={[styles.onBadgeText, { color: p.accent.mint }]}>
                    Unlocking with {label}
                  </Text>
                </View>
                <Pressable
                  onPress={turnOff}
                  accessibilityRole="button"
                  accessibilityLabel={`Turn off ${label}`}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                >
                  <Text style={[styles.off, { color: p.ink.muted }]}>
                    Turn off {label}
                  </Text>
                </Pressable>
              </>
            ) : (
              <PrimaryButton
                label={
                  !ready
                    ? "Loading your account…"
                    : busy
                      ? `Waiting for ${label}…`
                      : failed
                        ? "Try again"
                        : `Turn on ${label}`
                }
                onPress={() => void turnOn()}
                loading={busy}
                disabled={!ready}
                variant="mint"
              />
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Point({
  icon,
  title,
  body,
  p,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  p: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <View style={styles.point}>
      <View
        style={[
          styles.pointIcon,
          { backgroundColor: withAlpha(p.accent.mint, 0.12) },
        ]}
      >
        {icon}
      </View>
      <View style={styles.pointText}>
        <Text style={[styles.pointTitle, { color: p.ink.default }]}>{title}</Text>
        <Text style={[styles.pointBody, { color: p.ink.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: { paddingHorizontal: 16, paddingTop: 4 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 40, gap: 22 },
  heroWrap: { alignItems: "center", marginTop: 8, marginBottom: 4 },
  title: {
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.9,
    textAlign: "center",
    marginBottom: 10,
  },
  copy: { fontSize: 15, lineHeight: 21.5, textAlign: "center" },
  points: { gap: 16, marginTop: 4 },
  point: { flexDirection: "row", gap: 13, alignItems: "flex-start" },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: { flex: 1, gap: 2 },
  pointTitle: { fontSize: 14.5, fontWeight: "700", letterSpacing: -0.2 },
  pointBody: { fontSize: 13.5, lineHeight: 19 },
  actions: { gap: 18, marginTop: 6, alignItems: "stretch" },
  onBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  onBadgeText: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  off: { fontSize: 14.5, fontWeight: "600", textAlign: "center" },
});
