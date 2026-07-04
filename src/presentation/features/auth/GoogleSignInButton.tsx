/**
 * "Continue with Google" — self-contained button + auth-session flow.
 *
 * Lives in its own component (not inside useSocialAuth) on purpose:
 * `Google.useAuthRequest` THROWS during render when no client id is
 * configured for the platform, even if the button is never shown. Callers
 * must only render this component when `config.googleIosClientId` is set —
 * that keeps the hook from ever running unconfigured, which is what crashed
 * the TestFlight build on the sign-in / sign-up screens.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { config } from "@/shared/config";

/** Official multi-colour Google "G" (per Google's brand guidelines). */
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

export function GoogleSignInButton({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const p = useThemedPalette();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);

  const [, response, promptGoogle] = Google.useAuthRequest({
    iosClientId: config.googleIosClientId,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        setBusy(false);
        onError?.("Google sign-in didn’t return a token. Please try again.");
        return;
      }
      auth
        .signInWithGoogle(idToken)
        .then(() => onSuccess?.())
        .catch(() => onError?.("Google sign-in failed. Please try again."))
        .finally(() => setBusy(false));
    } else {
      // error / dismiss / cancel — clear the spinner, stay quiet on cancel.
      setBusy(false);
      if (response.type === "error") {
        onError?.("Google sign-in failed. Please try again.");
      }
    }
    // auth/onSuccess/onError are stable enough; re-run only on a new response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Pressable
      onPress={() => {
        setBusy(true);
        void promptGoogle();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      style={({ pressed }) => [
        styles.googleBtn,
        {
          // line.strong (not line.default) so the border is actually visible —
          // a white button with a faint border on the near-white light bg read
          // as "no button" next to the solid Apple pill.
          borderColor: p.line.strong,
          backgroundColor: p.bg.elevated,
          opacity: pressed || busy ? 0.7 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={p.ink.default} />
      ) : (
        <>
          <GoogleGlyph size={18} />
          <Text style={[styles.googleText, { color: p.ink.default }]}>
            Continue with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    // Subtle lift so the (white, in light mode) button reads as a tappable
    // surface — matches the prominence of the solid Apple button above it.
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleText: { fontSize: 16, fontWeight: "600" },
});
