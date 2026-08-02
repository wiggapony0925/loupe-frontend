/**
 * FormInput — themed labelled text input with optional error message.
 *
 * - Dark elevated bg, mint focus ring, rose error ring (matches palette).
 * - Optional leading icon, and a reveal toggle on password fields so a long
 *   password can be checked instead of retyped blind.
 * - Forwards every standard `TextInputProps`.
 */
import React, { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  /** Optional glyph rendered inside the field, before the text. */
  icon?: LucideIcon;
}

export const FormInput = forwardRef<TextInput, FormInputProps>(
  function FormInput(
    {
      label,
      error,
      hint,
      icon: Icon,
      style,
      onFocus,
      onBlur,
      secureTextEntry,
      ...rest
    },
    ref,
  ) {
    const p = useThemedPalette();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const isPassword = Boolean(secureTextEntry);
    const ring = error
      ? p.accent.rose
      : focused
        ? p.accent.mint
        : p.line.default;

    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: p.ink.muted }]}>{label}</Text>
        <View
          style={[
            styles.field,
            {
              backgroundColor: p.bg.elevated,
              borderColor: ring,
              // A focus halo reads as "active" at a glance on a dark field,
              // where a 1px border change alone is easy to miss.
              shadowColor: focused && !error ? p.accent.mint : "transparent",
            },
          ]}
        >
          {Icon ? (
            <Icon
              size={17}
              color={focused ? p.accent.mint : p.ink.dim}
              strokeWidth={2}
            />
          ) : null}
          <TextInput
            ref={ref}
            placeholderTextColor={p.ink.dim}
            selectionColor={p.accent.mint}
            secureTextEntry={isPassword && !revealed}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, { color: p.ink.default }, style]}
            {...rest}
          />
          {isPassword ? (
            <Pressable
              onPress={() => setRevealed((v) => !v)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
              style={[
                styles.reveal,
                { backgroundColor: withAlpha(p.ink.default, 0.06) },
              ]}
            >
              {revealed ? (
                <EyeOff size={16} color={p.ink.muted} />
              ) : (
                <Eye size={16} color={p.ink.muted} />
              )}
            </Pressable>
          ) : null}
        </View>
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
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
  },
  reveal: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 12, fontWeight: "500" },
  hint: { fontSize: 12 },
});
