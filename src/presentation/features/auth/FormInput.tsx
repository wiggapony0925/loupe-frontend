/**
 * FormInput — themed labelled text input with optional error message.
 *
 * - Dark elevated bg, mint focus ring, rose error ring (matches palette).
 * - Forwards every standard `TextInputProps`.
 */
import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
}

export const FormInput = forwardRef<TextInput, FormInputProps>(
  function FormInput({ label, error, hint, style, onFocus, onBlur, ...rest }, ref) {
    const p = useThemedPalette();
    const [focused, setFocused] = useState(false);
    const ring = error
      ? p.accent.rose
      : focused
        ? p.accent.mint
        : p.line.default;
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: p.ink.muted }]}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={p.ink.dim}
          selectionColor={p.accent.mint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              backgroundColor: p.bg.elevated,
              borderColor: ring,
              color: p.ink.default,
            },
            style,
          ]}
          {...rest}
        />
        {error ? (
          <Text style={[styles.error, { color: p.accent.rose }]}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.hint, { color: p.ink.dim }]}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
  },
  error: { fontSize: 12, fontWeight: "500" },
  hint: { fontSize: 12 },
});
