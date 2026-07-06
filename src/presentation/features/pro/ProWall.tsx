/**
 * ProWall — the single themed "this is a Pro feature" UI on mobile.
 *
 * Never decides access itself (that's `useProFeature`/`ProGate`); it only
 * renders the locked state + the upgrade CTA. Three variants:
 *   `card`    — standalone panel
 *   `overlay` — floats over dimmed content inside `ProGate`
 *   `inline`  — compact one-line row
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Lock, Sparkles, type LucideIcon } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { PRO_FEATURE_BY_KEY, type ProFeatureKey } from "./proPlan";

export type ProWallVariant = "card" | "overlay" | "inline";

export interface ProWallProps {
  /** Pulls default icon/title/blurb from the feature catalog. */
  feature?: ProFeatureKey;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  /** Upgrade button label. */
  cta?: string;
  variant?: ProWallVariant;
  onUpgrade: () => void;
}

export function ProWall({
  feature,
  icon,
  title,
  description,
  cta = "Upgrade to Pro",
  variant = "card",
  onUpgrade,
}: ProWallProps) {
  const p = useThemedPalette();
  const meta = feature ? PRO_FEATURE_BY_KEY[feature] : undefined;
  const Icon = icon ?? meta?.icon ?? Lock;
  const heading = title ?? meta?.title ?? "A Loupe Pro feature";
  const body = description ?? meta?.blurb ?? "Upgrade to unlock this.";

  if (variant === "inline") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.12),
          }}
        >
          <Lock size={13} color={p.accent.mint} />
        </View>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: p.ink.default, fontSize: 13, fontWeight: "700" }}
        >
          {heading}
        </Text>
        <UpgradePill label={cta} onPress={onUpgrade} />
      </View>
    );
  }

  return (
    <View
      style={[
        {
          alignItems: "center",
          gap: 8,
          padding: 20,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, 0.25),
          backgroundColor: p.bg.elevated,
        },
        variant === "overlay" && {
          position: "absolute",
          left: 16,
          right: 16,
          top: "50%",
          transform: [{ translateY: -90 }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 22,
          elevation: 8,
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(p.accent.mint, 0.12),
        }}
      >
        <Icon size={20} color={p.accent.mint} strokeWidth={2.25} />
      </View>
      <Text
        style={{
          color: p.ink.default,
          fontSize: 16,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {heading}
      </Text>
      <Text
        style={{
          color: p.ink.muted,
          fontSize: 12,
          lineHeight: 18,
          textAlign: "center",
        }}
      >
        {body}
      </Text>
      <View style={{ marginTop: 6 }}>
        <UpgradePill label={cta} onPress={onUpgrade} large />
      </View>
    </View>
  );
}

function UpgradePill({
  label,
  onPress,
  large,
}: {
  label: string;
  onPress: () => void;
  large?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: large ? 18 : 12,
        paddingVertical: large ? 10 : 7,
        borderRadius: 999,
        backgroundColor: p.accent.mint,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Sparkles size={large ? 15 : 13} color="#0B0B0D" strokeWidth={2.5} />
      <Text
        style={{
          color: "#0B0B0D",
          fontSize: large ? 13.5 : 12,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
