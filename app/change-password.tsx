/**
 * Change password — verifies the current password, sets a new one, and (server-
 * side) revokes every other session. The current device keeps a fresh token, so
 * the user stays signed in here. Reached from Settings → Account.
 */
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { FormInput } from "@/presentation/features/auth/FormInput";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { ApiError } from "@/infrastructure/http/client";
import { useThemedPalette } from "@/presentation/theme/tokens";
import {
  canSubmitPasswordChange,
  newPasswordTooShort,
  passwordsMismatch,
} from "@/domain/auth/passwordChange";

export default function ChangePasswordScreen() {
  const p = useThemedPalette();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tooShort = newPasswordTooShort(next);
  const mismatch = passwordsMismatch(next, confirm);
  const canSubmit =
    canSubmitPasswordChange({ current, next, confirm }) && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await changePassword(current, next);
      Alert.alert(
        "Password updated",
        "You've been signed out on every other device.",
      );
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't update your password. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="-ml-1 h-9 w-9 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={p.ink.default} />
        </Pressable>
        <Text className="text-base font-semibold tracking-tight text-ink">
          Change password
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[14px] text-ink-muted">
          Changing your password signs you out on every other device.
        </Text>

        <FormInput
          label="Current password"
          secureTextEntry
          autoComplete="current-password"
          value={current}
          onChangeText={setCurrent}
          placeholder="Your current password"
        />
        <FormInput
          label="New password"
          secureTextEntry
          autoComplete="new-password"
          value={next}
          onChangeText={setNext}
          placeholder="At least 8 characters"
          error={tooShort ? "Use at least 8 characters." : null}
        />
        <FormInput
          label="Confirm new password"
          secureTextEntry
          autoComplete="new-password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter new password"
          error={mismatch ? "Passwords don't match." : null}
        />

        {error ? (
          <Text style={{ color: p.accent.rose, fontSize: 14, fontWeight: "500" }}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={submitting ? "Updating…" : "Update password"}
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
