/**
 * Face ID setup — /face-id.
 *
 * The page the Settings "Face ID" row and the post-login prompt both land
 * on. One screen, three honest states:
 *
 *   no hardware / not enrolled → explain, point at iOS Settings
 *   off                        → one mint button to turn it on
 *   on                         → what it does now, and a quiet way off
 *
 * Enabling runs a REAL biometric prompt first — flipping the toggle
 * without proving the face works would let someone lock themselves out
 * on a phone where Face ID is broken for them.
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Lock, ScanFace, Smartphone } from "lucide-react-native";
import { useBiometrics } from "@/application/stores/biometricStore";
import {
  authenticateBiometric,
  getBiometricCapability,
  type BiometricCapability,
} from "@/infrastructure/biometrics";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
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

  useEffect(() => {
    getBiometricCapability().then(setCap);
  }, []);

  const label = cap?.label ?? "Face ID";

  // Until /me resolves there is no account to attach the lock to. Enabling
  // then silently did nothing and the Settings row went on reporting "Off",
  // which reads as a broken button rather than a slow one.
  const ready = userId !== null;

  const turnOn = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const ok = await authenticateBiometric(`Enable ${label} for Loupe`);
      if (ok) {
        setEnabled(userId, true);
        markPromptSeen(userId);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () => {
    if (!userId) return;
    Haptics.selectionAsync().catch(() => {});
    setEnabled(userId, false);
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <ChevronLeft size={26} color={p.ink.default} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.hero,
              { backgroundColor: withAlpha(p.accent.mint, 0.13) },
            ]}
          >
            <ScanFace size={34} color={p.accent.mint} strokeWidth={1.8} />
          </View>
          <Text style={[styles.title, { color: p.ink.default }]}>
            {enabled ? `${label} is on` : `Unlock with ${label}`}
          </Text>
          <Text style={[styles.copy, { color: p.ink.muted }]}>
            {enabled
              ? `Loupe locks when you leave the app and opens with a glance — no password, no typing.`
              : `Skip the password. Loupe locks itself when you leave and lets you back in the moment it sees you.`}
          </Text>

          <View style={styles.points}>
            <Point
              icon={<Lock size={17} color={p.accent.mint} strokeWidth={2.2} />}
              text="Your session stays on this phone, in the iOS Keychain — nothing changes about your account."
              color={p.ink.muted}
            />
            <Point
              icon={
                <Smartphone
                  size={17}
                  color={p.accent.mint}
                  strokeWidth={2.2}
                />
              }
              text={`If ${label} doesn't recognize you, your phone's passcode works as the fallback.`}
              color={p.ink.muted}
            />
          </View>

          {cap && !cap.available ? (
            <Text style={[styles.unavailable, { color: p.ink.dim }]}>
              {label} isn't set up on this phone yet. Add it in Settings ▸
              Face ID & Passcode, then come back.
            </Text>
          ) : enabled ? (
            <Pressable
              onPress={turnOff}
              accessibilityRole="button"
              accessibilityLabel={`Turn off ${label}`}
              style={({ pressed }) => [
                styles.off,
                { borderColor: p.line.default, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.offText, { color: p.ink.muted }]}>
                Turn off {label}
              </Text>
            </Pressable>
          ) : (
            <PrimaryButton
              label={
                !ready
                  ? "Loading your account…"
                  : busy
                    ? "Waiting for Face ID…"
                    : `Enable ${label}`
              }
              onPress={() => void turnOn()}
              loading={busy}
              disabled={!ready}
              variant="mint"
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Point({
  icon,
  text,
  color,
}: {
  icon: React.ReactNode;
  text: string;
  color: string;
}) {
  return (
    <View style={styles.point}>
      {icon}
      <Text style={[styles.pointText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: { paddingHorizontal: 16, paddingVertical: 8 },
  content: { padding: 24, paddingTop: 28, gap: 18, alignItems: "stretch" },
  hero: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  copy: { fontSize: 15, lineHeight: 21.5, textAlign: "center" },
  points: { gap: 14, marginTop: 6, marginBottom: 8 },
  point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pointText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  unavailable: { fontSize: 13.5, lineHeight: 19, textAlign: "center" },
  off: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  offText: { fontSize: 15, fontWeight: "700" },
});
