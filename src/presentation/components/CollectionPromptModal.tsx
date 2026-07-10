/**
 * CollectionPromptModal — create / rename / delete a portfolio.
 *
 * Shared by {@link PortfolioPickerSheet}. Delete requires typing DELETE so
 * a fat-finger tap can't wipe a collection. Holdings always stay in All.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemedPalette } from "@/presentation/theme/tokens";

export type PromptMode = "create" | "rename" | "delete";

interface CollectionPromptModalProps {
  visible: boolean;
  mode: PromptMode | null;
  initialName?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
}

export function CollectionPromptModal({
  visible,
  mode,
  initialName = "",
  busy = false,
  error = null,
  onClose,
  onSubmit,
}: CollectionPromptModalProps) {
  const p = useThemedPalette();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) {
      setValue(mode === "rename" ? initialName : "");
    }
  }, [visible, mode, initialName]);

  if (!visible || !mode) return null;

  const titles = {
    create: "New collection",
    rename: "Rename collection",
    delete: "Delete collection",
  };

  const descriptions = {
    create: "Name this portfolio — you can rename it anytime.",
    rename: `Rename “${initialName}”.`,
    delete: `Delete “${initialName}”? Holdings stay in All. Type DELETE to confirm.`,
  };

  const submitLabels = {
    create: "Create",
    rename: "Save",
    delete: "Delete",
  };

  const isDelete = mode === "delete";
  const isValid = isDelete ? value === "DELETE" : value.trim().length > 0;
  const submitTint = isDelete ? p.accent.rose : p.accent.mint;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={busy ? undefined : onClose}
        />
        <SafeAreaView style={{ width: "100%", maxWidth: 360 }}>
          <View
            style={{
              backgroundColor: p.bg.elevated,
              borderRadius: 22,
              padding: 22,
              width: "100%",
              borderWidth: 1,
              borderColor: p.line.default,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: p.ink.dim,
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              Portfolio
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: p.ink.default,
                marginBottom: 6,
                textAlign: "center",
              }}
            >
              {titles[mode]}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: p.ink.muted,
                marginBottom: 18,
                textAlign: "center",
                lineHeight: 18,
              }}
            >
              {descriptions[mode]}
            </Text>

            <TextInput
              autoFocus
              editable={!busy}
              value={value}
              onChangeText={setValue}
              placeholder={isDelete ? "DELETE" : "Collection name"}
              placeholderTextColor={p.ink.dim}
              autoCapitalize={isDelete ? "characters" : "words"}
              style={{
                backgroundColor: p.bg.base,
                borderWidth: 1,
                borderColor: p.line.default,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                fontSize: 16,
                fontWeight: "600",
                color: p.ink.default,
                marginBottom: error ? 8 : 20,
              }}
              onSubmitEditing={() => {
                if (isValid && !busy) void onSubmit(value.trim());
              }}
              returnKeyType="done"
            />

            {error ? (
              <Text
                style={{
                  color: p.accent.rose,
                  fontSize: 12,
                  fontWeight: "600",
                  textAlign: "center",
                  marginBottom: 14,
                }}
              >
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                disabled={busy}
                onPress={onClose}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: p.bg.base,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  alignItems: "center",
                  opacity: pressed || busy ? 0.7 : 1,
                })}
              >
                <Text style={{ color: p.ink.default, fontWeight: "700", fontSize: 15 }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={!isValid || busy}
                onPress={() => void onSubmit(value.trim())}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: submitTint,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 46,
                  opacity: !isValid || busy ? 0.45 : pressed ? 0.85 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                    {submitLabels[mode]}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
