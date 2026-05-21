/**
 * `DevPersonaSheet` — modal that lists the 50 seeded test personas
 * grouped by archetype with a short description, and lets the user
 * one-tap sign in as any of them.
 *
 * Dev-only convenience — the sign-in screen only mounts this when
 * `__DEV__` is true. Persona registry lives in `devPersonas.ts`, which
 * mirrors the backend's `documentation/test_personas.py`.
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search, X } from "lucide-react-native";

import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { ApiError } from "@/infrastructure/http/client";
import {
  DEV_PERSONAS,
  DEV_PERSONA_GROUPS,
  type DevPersona,
  type DevPersonaGroup,
} from "./devPersonas";

export interface DevPersonaSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called once a sign-in succeeds; parent typically dismisses + routes. */
  onSignedIn?: (persona: DevPersona) => void;
}

export function DevPersonaSheet({
  visible,
  onClose,
  onSignedIn,
}: DevPersonaSheetProps) {
  const p = useThemedPalette();
  const { signInWithEmail } = useAuth();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEV_PERSONAS;
    return DEV_PERSONAS.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        x.headline.toLowerCase().includes(q) ||
        x.tags.some((t) => t.toLowerCase().includes(q)) ||
        x.group.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const out = new Map<DevPersonaGroup, DevPersona[]>();
    for (const g of DEV_PERSONA_GROUPS) out.set(g, []);
    for (const x of filtered) out.get(x.group)?.push(x);
    return out;
  }, [filtered]);

  async function signIn(persona: DevPersona) {
    if (!persona.password) {
      setError(`${persona.name} is SSO-only — can't sign in from dev picker.`);
      return;
    }
    setError(null);
    setBusyId(persona.id);
    try {
      await signInWithEmail(persona.email, persona.password);
      onSignedIn?.(persona);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(
          `Sign-in failed for ${persona.email}. Did you run \`python -m scripts.seed_test_users\`?`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: p.bg.base }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: p.line.default, backgroundColor: p.bg.base },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: p.ink.default }]}>
              Dev personas
            </Text>
            <Text style={[styles.subtitle, { color: p.ink.muted }]}>
              50 seeded accounts · tap one to sign in
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close persona picker"
          >
            <X size={22} color={p.ink.muted} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <View
            style={[
              styles.search,
              { borderColor: p.line.default, backgroundColor: p.bg.elevated },
            ]}
          >
            <Search size={16} color={p.ink.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, tag, email…"
              placeholderTextColor={p.ink.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.searchInput, { color: p.ink.default }]}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <X size={14} color={p.ink.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: withAlpha(palette.accent.rose, 0.12),
                borderColor: withAlpha(palette.accent.rose, 0.4),
              },
            ]}
          >
            <Text style={{ color: palette.accent.rose, fontSize: 12 }}>
              {error}
            </Text>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {DEV_PERSONA_GROUPS.map((group) => {
            const rows = grouped.get(group) ?? [];
            if (rows.length === 0) return null;
            return (
              <View key={group} style={{ marginTop: 18 }}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: p.ink.dim, borderBottomColor: p.line.default },
                  ]}
                >
                  {group.toUpperCase()} · {rows.length}
                </Text>
                {rows.map((persona) => (
                  <PersonaRow
                    key={persona.id}
                    persona={persona}
                    busy={busyId === persona.id}
                    disabled={busyId !== null && busyId !== persona.id}
                    onPress={() => signIn(persona)}
                  />
                ))}
              </View>
            );
          })}

          {filtered.length === 0 ? (
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: p.ink.muted, fontSize: 13 }}>
                No personas match "{query}".
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function PersonaRow({
  persona,
  busy,
  disabled,
  onPress,
}: {
  persona: DevPersona;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const isSso = persona.password === null;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isSso}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? p.bg.elevated : "transparent",
          borderBottomColor: p.line.default,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Sign in as ${persona.name}`}
    >
      <View style={styles.rowTop}>
        <Text
          style={{
            color: p.ink.muted,
            fontSize: 11,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            width: 36,
          }}
        >
          {persona.id}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "600" }}>
            {persona.name}
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 11, marginTop: 2 }}>
            {persona.email}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={palette.accent.mint} />
        ) : isSso ? (
          <Text
            style={{
              color: p.ink.muted,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.8,
            }}
          >
            SSO ONLY
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          color: p.ink.default,
          fontSize: 12,
          marginTop: 6,
          marginLeft: 36,
        }}
      >
        {persona.headline}
      </Text>
      <Text
        style={{
          color: p.ink.muted,
          fontSize: 11,
          marginTop: 4,
          marginLeft: 36,
          lineHeight: 15,
        }}
      >
        {persona.whyUnique}
      </Text>

      <View style={[styles.tagRow, { marginLeft: 36 }]}>
        {persona.tags.map((t) => (
          <View
            key={t}
            style={[
              styles.tag,
              {
                backgroundColor: withAlpha(palette.accent.mint, 0.1),
                borderColor: withAlpha(palette.accent.mint, 0.3),
              },
            ]}
          >
            <Text style={{ color: palette.accent.mint, fontSize: 9, fontWeight: "700" }}>
              {t}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
