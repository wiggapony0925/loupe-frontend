/**
 * ClaimUsernameCard — the front door to Community.
 *
 * You cannot be followed, suggested, or found until you have a handle, so
 * this is not a settings screen tucked away behind a menu: until a username
 * exists it IS the Community page, and the collector lists sit behind it.
 * Showing suggestions first and asking for a handle later meant a user could
 * follow ten people while remaining invisible to all of them.
 *
 * Deliberately one field. Bio, location and privacy are all editable
 * afterwards from the profile; asking for them up front turns a two-second
 * decision into a form, and the only value the product actually needs to
 * function is the handle.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { AtSign, Check } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useUpsertProfile } from "@/application/queries/social/useSocial";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { usernameError } from "./socialLabels";

export function ClaimUsernameCard({ onClaimed }: { onClaimed?: () => void }) {
  const p = useThemedPalette();
  const [raw, setRaw] = useState("");
  const [touched, setTouched] = useState(false);
  const upsert = useUpsertProfile();

  const value = raw.trim().toLowerCase();
  const localError = useMemo(() => usernameError(raw), [raw]);
  // Only nag once they've typed. An error under an untouched empty field
  // reads as the form being broken before they've done anything.
  const shownError = touched ? localError : null;
  // The server is the authority on "taken" and on reserved handles.
  const serverError = upsert.isError
    ? (upsert.error as Error).message || "Couldn't claim that handle"
    : null;

  const submit = () => {
    setTouched(true);
    if (localError) return;
    upsert.mutate(
      { username: value, is_private: false },
      { onSuccess: () => onClaimed?.() },
    );
  };

  return (
    <View
      style={[
        styles.card,
        { borderColor: p.line.default, backgroundColor: p.bg.elevated },
      ]}
    >
      <View
        style={[styles.badge, { backgroundColor: withAlpha(p.accent.mint, 0.14) }]}
      >
        <AtSign size={16} color={p.accent.mint} strokeWidth={2.5} />
      </View>

      <Text style={[styles.title, { color: p.ink.default }]}>
        Claim your username
      </Text>
      <Text style={[styles.body, { color: p.ink.muted }]}>
        This is how other collectors find you. You can change it later.
      </Text>

      <View
        style={[
          styles.field,
          {
            borderColor: shownError || serverError ? p.accent.rose : p.line.default,
            backgroundColor: p.bg.base,
          },
        ]}
      >
        <Text style={[styles.at, { color: p.ink.dim }]}>@</Text>
        <TextInput
          value={raw}
          onChangeText={(t) => {
            setRaw(t);
            if (!touched) setTouched(true);
            if (upsert.isError) upsert.reset();
          }}
          onBlur={() => setTouched(true)}
          placeholder="yourhandle"
          placeholderTextColor={p.ink.dim}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={30}
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!upsert.isPending}
          style={[styles.input, { color: p.ink.default }]}
          accessibilityLabel="Username"
        />
        {!localError && value.length > 0 ? (
          <Check size={16} color={p.accent.mint} strokeWidth={2.6} />
        ) : null}
      </View>

      {shownError || serverError ? (
        <Text style={[styles.error, { color: p.accent.rose }]}>
          {serverError ?? shownError}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: p.ink.dim }]}>
          Letters, numbers and underscores.
        </Text>
      )}

      <View style={styles.action}>
        {upsert.isPending ? (
          <View style={styles.pending}>
            <ActivityIndicator color={p.accent.mint} />
          </View>
        ) : (
          <PrimaryButton
            label="Claim username"
            onPress={submit}
            disabled={!!localError}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 6 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  body: { fontSize: 13.5, lineHeight: 19 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    marginTop: 12,
  },
  at: { fontSize: 16, fontWeight: "600" },
  input: { flex: 1, fontSize: 16, paddingVertical: 13 },
  hint: { fontSize: 11.5, marginTop: 6 },
  error: { fontSize: 11.5, marginTop: 6, fontWeight: "600" },
  action: { marginTop: 14 },
  pending: { paddingVertical: 18, alignItems: "center" },
});
