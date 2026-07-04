import React, { useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSettings } from "@/application/stores/settingsStore";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { config } from "@/shared/config";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useSocialAuth } from "./useSocialAuth";

/**
 * Social sign-in block (Apple + Google), shared by the Sign In + Sign Up
 * screens — the mobile counterpart to the web's <SocialSignIn>. Each provider
 * self-gates, so this renders nothing when neither is usable.
 *
 * ⚠️ Google is gated at the COMPONENT level (not just the button): its
 * auth-request hook throws when the build has no client id, so
 * `GoogleSignInButton` must only mount when `config.googleIosClientId` is set.
 */
export function SocialSignIn({ onSuccess }: { onSuccess?: () => void }) {
  const p = useThemedPalette();
  const themeMode = useSettings((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = (themeMode === "system" ? systemScheme : themeMode) !== "light";
  const [error, setError] = useState<string | null>(null);

  const { appleAvailable, signInWithApple } = useSocialAuth({
    onSuccess,
    onError: setError,
  });
  const googleConfigured = Boolean(config.googleIosClientId);

  if (!appleAvailable && !googleConfigured) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: p.line.default }]} />
        <Text style={[styles.or, { color: p.ink.dim }]}>or continue with</Text>
        <View style={[styles.line, { backgroundColor: p.line.default }]} />
      </View>

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={14}
          style={styles.appleBtn}
          onPress={signInWithApple}
        />
      ) : null}

      {googleConfigured ? (
        <GoogleSignInButton onSuccess={onSuccess} onError={setError} />
      ) : null}

      {error ? <Text style={[styles.error, { color: p.accent.rose }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, width: "100%" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: 12, fontWeight: "600" },
  appleBtn: { width: "100%", height: 50 },
  error: { fontSize: 13, fontWeight: "500", textAlign: "center" },
});
