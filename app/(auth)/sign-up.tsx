/**
 * Sign Up — display name + email + password.
 */
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, type TextInput, View } from "react-native";
import { router } from "expo-router";
import { Lock, Mail, User, UserPlus } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { validatePassword } from "@loupe/auth";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { SocialSignIn } from "@/presentation/features/auth/SocialSignIn";
import { AuthScreen } from "@/presentation/features/auth/AuthScreen";
import { AuthHeader } from "@/presentation/features/auth/AuthHeader";
import { FormInput } from "@/presentation/features/auth/FormInput";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
import { PasswordStrength } from "@/presentation/features/auth/PasswordStrength";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { ApiError } from "@/infrastructure/http/client";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function SignUpScreen() {
  const p = useThemedPalette();
  const { signUpWithEmail } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    // Same rule the backend enforces (`@loupe/auth`), checked here so the
    // user gets a useful message instead of a bare 422.
    const invalid = validatePassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithEmail(email.trim(), password, displayName || undefined);
      // Root layout will redirect automatically once isAuthenticated flips.
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with that email already exists.");
      } else if (err instanceof ApiError && err.status === 422) {
        setError("Please enter a valid email address.");
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
        title="Create account"
        subtitle="Start tracking your collection like a portfolio — free."
      />

      <Animated.View
        entering={FadeInDown.duration(380).delay(80)}
        style={styles.form}
      >
        <FormInput
          label="Display name"
          icon={User}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          placeholder="Optional"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <FormInput
          ref={emailRef}
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
        <View style={styles.passwordBlock}>
          <FormInput
            ref={passwordRef}
            label="Password"
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="At least 8 characters"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            error={error}
          />
          <PasswordStrength password={password} />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(380).delay(160)}
        style={styles.actions}
      >
        <View style={styles.fullWidth}>
          <PrimaryButton
            label="Create account"
            icon={UserPlus}
            variant="mint"
            loading={submitting}
            disabled={!canSubmit}
            onPress={onSubmit}
          />
        </View>

        <SocialSignIn />

        <Pressable onPress={() => router.replace("/(auth)/sign-in")} hitSlop={8}>
          <Text style={[styles.switch, { color: p.ink.muted }]}>
            Already have an account?{" "}
            <Text style={{ color: p.accent.mint, fontWeight: "700" }}>
              Sign in
            </Text>
          </Text>
        </Pressable>
      </Animated.View>

      <AuthFooter />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 13 },
  passwordBlock: { gap: 7 },
  actions: { gap: 13, alignItems: "center" },
  fullWidth: { alignSelf: "stretch" },
  switch: { fontSize: 14, textAlign: "center" },
});
