import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { radius, spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function SheetChoiceGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  /** Optional uppercase section label rendered inside the card header. */
  label?: string;
}) {
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
      {label ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: p.line.default,
          }}
        >
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {label}
          </Text>
        </View>
      ) : null}
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

  // Layout styles live on the inner View — Pressable style-as-function has
  // been observed to silently drop flexDirection in this app.
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole={showRadio ? "radio" : "button"}
      accessibilityState={{ selected: active, disabled }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            minHeight: 58,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 2,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: p.line.default,
            backgroundColor: active
              ? withAlpha(accent, 0.08)
              : pressed && !disabled
                ? withAlpha(p.ink.default, 0.04)
                : "transparent",
            opacity: disabled ? 0.4 : pressed ? 0.88 : 1,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(accent, active ? 0.2 : 0.12),
            }}
          >
            <Icon size={16} color={accent} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{ color: p.ink.default, fontSize: 15, fontWeight: "700" }}
            >
              {title}
            </Text>
            <Text
              numberOfLines={1}
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
                borderColor: active ? accent : withAlpha(p.ink.dim, 0.55),
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
        </View>
      )}
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
  // Hard fallbacks so a missing token never yields white-on-white.
  const bg = tone === "rose" ? p.accent.rose || "#d63b30" : p.accent.mint || "#00a86e";
  const fg = tone === "rose" ? "#ffffff" : "#06140d";
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
    >
      {({ pressed }) => (
        <View
          style={{
            height: 52,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            opacity: blocked ? 0.5 : pressed ? 0.88 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <Text style={{ color: fg, fontSize: 16, fontWeight: "800" }}>{label}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
