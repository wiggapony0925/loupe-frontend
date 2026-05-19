/**
 * Sign In — email + password.
 *
 * Includes a dev-only one-tap login that hits POST /v1/auth/dev-login so
 * we can iterate on screens without typing credentials. The endpoint is
 * gated by `APP_ENV != production` on the backend, so the button is safe
 * to ship — it'll just 404 in prod and surface the standard error.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LogIn, Zap } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuthScreen } from "@/presentation/features/auth/AuthScreen";
import { FormInput } from "@/presentation/features/auth/FormInput";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { ApiError } from "@/infrastructure/http/client";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function SignInScreen() {
  const p = useThemedPalette();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onDevLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // /v1/auth/dev-login is disabled in production, so we sign in with
      // the seeded test credentials instead.
      await signInWithEmail("test+01@loupe.app", "Loupe2026!");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Dev login failed: invalid seeded credentials.");
      } else {
        setError(err instanceof Error ? err.message : "Dev login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: p.ink.default }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: p.ink.muted }]}>
          Sign in to your Loupe account.
        </Text>
      </View>

      <View style={styles.form}>
        <FormInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <FormInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          error={error}
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Sign in"
          icon={LogIn}
          variant="mint"
          loading={submitting}
          onPress={onSubmit}
        />
        {__DEV__ ? (
          <PrimaryButton
            label="Dev login (test+01)"
            icon={Zap}
            variant="ghost"
            onPress={onDevLogin}
          />
        ) : null}
        <Pressable onPress={() => router.replace("/(auth)/sign-up")}>
          <Text style={[styles.switch, { color: p.ink.muted }]}>
            New to Loupe?{" "}
            <Text style={{ color: p.accent.mint, fontWeight: "600" }}>
              Create an account
            </Text>
          </Text>
        </Pressable>
      </View>

      <AuthFooter />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15 },
  form: { gap: 16 },
  actions: { gap: 16, alignItems: "center" },
  switch: { fontSize: 14, textAlign: "center" },
});
