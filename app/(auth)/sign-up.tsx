/**
 * Sign Up — display name + email + password.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuthScreen } from "@/presentation/features/auth/AuthScreen";
import { FormInput } from "@/presentation/features/auth/FormInput";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
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

  const onSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName || undefined);
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: p.ink.default }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: p.ink.muted }]}>
          Build your portfolio in seconds.
        </Text>
      </View>

      <View style={styles.form}>
        <FormInput
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          placeholder="Optional"
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 8 characters"
          hint="8+ characters. Make it memorable."
          error={error}
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Create account"
          icon={UserPlus}
          variant="mint"
          loading={submitting}
          onPress={onSubmit}
        />
        <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
          <Text style={[styles.switch, { color: p.ink.muted }]}>
            Already have an account?{" "}
            <Text style={{ color: p.accent.mint, fontWeight: "600" }}>Sign in</Text>
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
