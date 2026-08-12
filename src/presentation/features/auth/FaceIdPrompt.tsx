/**
 * FaceIdPrompt — the one-time "want Face ID?" sheet after login.
 *
 * The Chase moment: you've just typed your password, which is exactly
 * when being promised you won't have to again lands best. Shown once per
 * account (biometricStore.promptSeenBy), only when the device can
 * actually do it, and only after the first-login HomeTour is out of the
 * way — two overlays stacked on a brand-new user is a hazing ritual.
 *
 * "Not now" is a real answer: it marks the prompt seen and never asks
 * again. The Settings row stays as the way back in.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScanFace } from "lucide-react-native";
import { useBiometrics } from "@/application/stores/biometricStore";
import { useOnboarding } from "@/application/stores/onboardingStore";
import { getBiometricCapability } from "@/infrastructure/biometrics";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function FaceIdPrompt() {
  const p = useThemedPalette();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ? String(user.id) : null;

  const enabled = useBiometrics((s) =>
    userId ? Boolean(s.enabledBy[userId]) : false,
  );
  const promptSeen = useBiometrics((s) =>
    userId ? Boolean(s.promptSeenBy[userId]) : true,
  );
  const markPromptSeen = useBiometrics((s) => s.markPromptSeen);
  const tourSeen = useOnboarding((s) =>
    userId ? Boolean(s.seenBy[userId]) : false,
  );

  const [capable, setCapable] = useState(false);
  const [label, setLabel] = useState("Face ID");

  useEffect(() => {
    getBiometricCapability().then((cap) => {
      setCapable(cap.available);
      setLabel(cap.label);
    });
  }, []);

  const visible =
    isAuthenticated &&
    userId !== null &&
    capable &&
    tourSeen &&
    !promptSeen &&
    !enabled;

  const dismiss = () => {
    if (userId) markPromptSeen(userId);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={dismiss}
      title={`Sign in with ${label}`}
      subtitle="Tired of typing your password?"
      compact
      overlay
    >
      <View style={styles.body}>
        <View
          style={[
            styles.hero,
            { backgroundColor: withAlpha(p.accent.mint, 0.13) },
          ]}
        >
          <ScanFace size={26} color={p.accent.mint} strokeWidth={1.9} />
        </View>
        <Text style={[styles.copy, { color: p.ink.muted }]}>
          Loupe can lock itself when you leave and open with a glance —
          no password, ever again on this phone.
        </Text>
        <PrimaryButton
          label={`Set up ${label}`}
          variant="mint"
          onPress={() => {
            dismiss();
            router.push("/face-id");
          }}
        />
        <Text
          onPress={dismiss}
          accessibilityRole="button"
          style={[styles.later, { color: p.ink.muted }]}
        >
          Not now
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingTop: 4, alignItems: "stretch" },
  hero: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  copy: { fontSize: 14.5, lineHeight: 20.5, textAlign: "center" },
  later: {
    fontSize: 14.5,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
  },
});
