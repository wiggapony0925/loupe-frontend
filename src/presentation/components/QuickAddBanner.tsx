/**
 * QuickAddBanner — a lightweight, auto-dismissing confirmation toast.
 *
 * Rendered near the top of a screen and floated above content. Used by
 * the "hold to quick-add" gesture on the card-detail CTA to confirm a
 * one-tap add without taking the user into the full form. Slides down on
 * appear, fades up on dismiss, and clears itself after `duration` ms.
 *
 * Controlled: the host owns a `visible` flag and is told when the banner
 * has auto-hidden via `onHide` so it can reset its state.
 */
import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export interface QuickAddBannerProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** "success" tints mint, "error" tints rose. Defaults to success. */
  tone?: "success" | "error";
  /** Auto-dismiss delay in ms. Defaults to 2200. */
  duration?: number;
  /** Optional tap target (e.g. "View") shown on the right. */
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the banner auto-hides or is dismissed. */
  onHide: () => void;
}

export function QuickAddBanner({
  visible,
  title,
  subtitle,
  tone = "success",
  duration = 2200,
  actionLabel,
  onAction,
  onHide,
}: QuickAddBannerProps) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onHide]);

  if (!visible) return null;

  const accent = tone === "error" ? p.accent.rose : p.accent.mint;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: withAlpha(accent, 0.45),
          backgroundColor: p.bg.elevated,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(accent, 0.16),
          }}
        >
          {tone === "error" ? (
            <X size={17} color={accent} strokeWidth={2.6} />
          ) : (
            <Check size={17} color={accent} strokeWidth={2.6} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{ color: p.ink.muted, fontSize: 12, marginTop: 1 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable
            onPress={() => {
              onAction();
              onHide();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={{ color: accent, fontSize: 13, fontWeight: "700" }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
