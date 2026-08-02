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
        {/* The TextInput carries the border and background ITSELF, and the
            icon / reveal button are absolutely positioned over it.

            Wrapping the input in a flex-row container instead — the obvious
            way to lay out "icon, field, button" — silently made the field
            impossible to focus on a device: tapping it did nothing, no
            keyboard, no caret, so sign-in and sign-up were unusable. A bare
            TextInput on the same screen focused fine, which is what pinned it
            on the wrapper. Keep the input as the touch target. */}
        <View style={styles.fieldStack}>
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
            style={[
              styles.input,
              {
                backgroundColor: p.bg.elevated,
                borderColor: ring,
                color: p.ink.default,
                paddingLeft: Icon ? 41 : 14,
                paddingRight: isPassword ? 50 : 14,
              },
              style,
            ]}
            {...rest}
          />
          {Icon ? (
            <View style={styles.leadingIcon} pointerEvents="none">
              <Icon
                size={17}
                color={focused ? p.accent.mint : p.ink.dim}
                strokeWidth={2}
              />
            </View>
          ) : null}
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
  fieldStack: { justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
  },
  leadingIcon: {
    position: "absolute",
    left: 14,
    // Never intercept — the input underneath must stay the touch target.
    pointerEvents: "none",
  },
  reveal: {
    position: "absolute",
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 12, fontWeight: "500" },
  hint: { fontSize: 12 },
});
