/**
 * Forgot Password — request a reset email.
 *
 * Collects the account email and POSTs `/v1/auth/forgot-password` (always
 * 204, no account enumeration). The email carries a link to the WEB reset
 * page, which completes the reset — so this screen only needs to fire the
 * request and confirm it was sent. Mirrors the web ForgotPassword page.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, MailCheck, Send } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { AuthScreen } from "@/presentation/features/auth/AuthScreen";
import { AuthFooter } from "@/presentation/features/auth/AuthFooter";
import { FormInput } from "@/presentation/features/auth/FormInput";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { requestPasswordReset } from "@/infrastructure/repositories/authRepository";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const p = useThemedPalette();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      // The endpoint is 204-always; a failure here is network/server, not
      // "no such account" — keep the message generic and non-enumerating.
      setError("Couldn't send the reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthScreen>
        <View style={styles.header}>
          <View
            style={[
              styles.medallion,
              { backgroundColor: withAlpha(p.accent.mint, 0.14) },
            ]}
          >
            <MailCheck size={28} color={p.accent.mint} strokeWidth={2} />
          </View>
          <Text style={[styles.title, { color: p.ink.default }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: p.ink.muted }]}>
            If an account exists for{" "}
            <Text style={{ color: p.ink.default, fontWeight: "600" }}>{email.trim()}</Text>
            , we sent a link to reset your password. Open it on this device to
            choose a new one.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Back to sign in"
            icon={ArrowLeft}
            variant="mint"
            onPress={() => router.replace("/(auth)/sign-in")}
          />
          <Pressable onPress={() => setSent(false)}>
            <Text style={[styles.switch, { color: p.ink.muted }]}>
              Didn't get it?{" "}
              <Text style={{ color: p.accent.mint, fontWeight: "600" }}>Try again</Text>
            </Text>
          </Pressable>
        </View>

        <AuthFooter />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <View style={styles.header}>
        <LoupeMark size={44} color={p.ink.default} />
        <Text style={[styles.title, { color: p.ink.default }]}>Reset your password</Text>
        <Text style={[styles.subtitle, { color: p.ink.muted }]}>
          Enter your email and we'll send you a link to set a new password.
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
          error={error}
          onSubmitEditing={onSubmit}
          returnKeyType="send"
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Send reset link"
          icon={Send}
          variant="mint"
          loading={submitting}
          onPress={onSubmit}
        />
        <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
          <Text style={[styles.switch, { color: p.ink.muted }]}>
            Remembered it?{" "}
            <Text style={{ color: p.accent.mint, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>

      <AuthFooter />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12 },
  medallion: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  form: { gap: 16 },
  actions: { gap: 16, alignItems: "center" },
  switch: { fontSize: 14, textAlign: "center" },
});
