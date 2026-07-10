import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { radius, spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function SheetChoiceGroup({ children }: { children: React.ReactNode }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

interface SheetChoiceRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  /** When set, shows a radio affordance and highlights the active row. */
  selected?: boolean;
  disabled?: boolean;
  isLast?: boolean;
}

export function SheetChoiceRow({
  icon: Icon,
  title,
  subtitle,
  accent,
  onPress,
  selected,
  disabled = false,
  isLast = false,
}: SheetChoiceRowProps) {
  const p = useThemedPalette();
  const showRadio = selected !== undefined;
  const active = selected === true;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole={showRadio ? "radio" : "button"}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 68,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
        backgroundColor: active
          ? withAlpha(accent, 0.08)
          : pressed && !disabled
            ? withAlpha(p.ink.default, 0.04)
            : "transparent",
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(accent, 0.14),
        }}
      >
        <Icon size={16} color={accent} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          numberOfLines={1}
          style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={{ color: p.ink.muted, fontSize: 12, lineHeight: 16 }}
        >
          {subtitle}
        </Text>
      </View>
      {showRadio ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: active ? accent : p.ink.dim,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? accent : "transparent",
          }}
        >
          {active ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#fff",
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

interface SheetPrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** mint (default) or rose for destructive confirms */
  tone?: "mint" | "rose";
  loading?: boolean;
  disabled?: boolean;
}

export function SheetPrimaryButton({
  label,
  onPress,
  tone = "mint",
  loading = false,
  disabled = false,
}: SheetPrimaryButtonProps) {
  const p = useThemedPalette();
  const bg = tone === "rose" ? p.accent.rose : p.accent.mint;
  const fg = tone === "rose" ? "#fff" : "#06140d";
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        opacity: blocked ? 0.45 : pressed ? 0.88 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 16, fontWeight: "800" }}>{label}</Text>
      )}
    </Pressable>
  );
}
