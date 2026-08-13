/**
 * FaceIdPrompt — the one-time offer, right after a password.
 *
 * The Chase moment: you have JUST typed your password, which is the only
 * time "you won't have to do that again" means anything. Asked once per
 * account, only on a device that can actually do it, and only after the
 * first-login tour is out of the way — two overlays stacked on a brand-new
 * account is a hazing ritual.
 *
 * "Not now" is a real answer, not a delay: it marks the prompt seen and
 * never asks again. Settings is the way back in. A prompt that returns
 * after you declined it is how people learn to distrust prompts.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { ScanFace } from "lucide-react-native";
import { useBiometrics } from "@/application/stores/biometricStore";
import { useOnboarding } from "@/application/stores/onboardingStore";
import { getBiometricCapability } from "@/infrastructure/biometrics";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { FaceScan } from "@/presentation/features/auth/FaceScan";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette } from "@/presentation/theme/tokens";

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
      title={`That's the last time`}
      subtitle={`Use ${label} from now on`}
      compact
      overlay
    >
      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(380)} style={styles.hero}>
          <FaceScan state="idle" size={104}>
            <ScanFace size={34} color={p.accent.mint} strokeWidth={1.6} />
          </FaceScan>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.duration(380).delay(80)}
          style={[styles.copy, { color: p.ink.muted }]}
        >
          Loupe can lock when you leave and open with a glance. Your face
          never leaves the phone — iOS just answers yes.
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.duration(380).delay(140)}
          style={styles.actions}
        >
          <PrimaryButton
            label={`Turn on ${label}`}
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
        </Animated.View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingTop: 8, alignItems: "stretch" },
  hero: { alignItems: "center" },
  copy: { fontSize: 14.5, lineHeight: 20.5, textAlign: "center" },
  actions: { gap: 14, alignItems: "stretch" },
  later: {
    fontSize: 14.5,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
  },
});
