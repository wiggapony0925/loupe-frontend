/**
 * Sign In — email + password.
 *
 * Includes a dev-only one-tap login that hits POST /v1/auth/dev-login so
 * we can iterate on screens without typing credentials. The endpoint is
 * gated by `APP_ENV != production` on the backend, so the button is safe
 * to ship — it'll just 404 in prod and surface the standard error.
 */
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, type TextInput, View } from "react-native";
import { router } from "expo-router";
import { LogIn, Lock, Mail, Users } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuthScreen } from "@/presentation/features/auth/AuthScreen";
import { AuthHeader } from "@/presentation/features/auth/AuthHeader";
import { FormInput } from "@/presentation/features/auth/FormInput";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
import { DevPersonaSheet } from "@/presentation/features/auth/DevPersonaSheet";
import { SocialSignIn } from "@/presentation/features/auth/SocialSignIn";
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
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

  return (
    <AuthScreen>
      <AuthHeader
        title="Welcome back"
        subtitle="Sign in to pick your vault up where you left it."
      />

      <Animated.View
        entering={FadeInDown.duration(380).delay(80)}
        style={styles.form}
      >
        <FormInput
          label="Email"
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          placeholder="you@example.com"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <FormInput
          ref={passwordRef}
          label="Password"
          icon={Lock}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          error={error}
        />
        <Pressable
          onPress={() => router.push("/(auth)/forgot-password")}
          hitSlop={8}
          style={styles.forgot}
          accessibilityRole="button"
        >
          <Text style={[styles.forgotText, { color: p.accent.mint }]}>
            Forgot password?
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(380).delay(160)}
        style={styles.actions}
      >
        <View style={styles.fullWidth}>
          <PrimaryButton
            label="Sign in"
            icon={LogIn}
            variant="mint"
            loading={submitting}
            disabled={!canSubmit}
            onPress={onSubmit}
          />
        </View>

        {/* Auth-state change → the root layout redirects out of the auth group,
            same as the email flow, so no explicit navigation needed here. */}
        <SocialSignIn />

        {__DEV__ ? (
          <View style={styles.fullWidth}>
            <PrimaryButton
              label="Dev personas (50)"
              icon={Users}
              variant="ghost"
              onPress={() => setPickerOpen(true)}
            />
          </View>
        ) : null}
        <Pressable onPress={() => router.replace("/(auth)/sign-up")} hitSlop={8}>
          <Text style={[styles.switch, { color: p.ink.muted }]}>
            New to Loupe?{" "}
            <Text style={{ color: p.accent.mint, fontWeight: "700" }}>
              Create an account
            </Text>
          </Text>
        </Pressable>
      </Animated.View>

      <AuthFooter />

      {__DEV__ ? (
        <DevPersonaSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  forgot: { alignSelf: "flex-end", marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: "600" },
  actions: { gap: 16, alignItems: "center" },
  fullWidth: { alignSelf: "stretch" },
  switch: { fontSize: 14, textAlign: "center" },
});
