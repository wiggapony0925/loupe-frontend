import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { palette, withAlpha } from "@/presentation/theme/tokens";
import { BLUR_INTENSITY, GLASS, HAIRLINE } from "./theme";

/**
 * Inline identify-error banner — the anti-modal. One line of copy over
 * the same glass material as every other floating control, a rose dot
 * for severity, and it gets out of the way on its own (or on tap). The
 * shutter sits directly below it and is the natural retry.
 */
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="alert"
      accessibilityLabel={`${message}. Tap to dismiss.`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        alignSelf: "center",
        maxWidth: 420,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: GLASS,
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.rose, 0.45),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <BlurView
        intensity={BLUR_INTENSITY}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: palette.accent.rose,
        }}
      />
      <Text
        numberOfLines={2}
        style={{ color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: "600", flexShrink: 1 }}
      >
        {message}
      </Text>
    </Pressable>
  );
}

/** Frosted status/coaching pill — a mint dot (or spinner while `pulse`). */
export function HintPill({ label, pulse = false }: { label: string; pulse?: boolean }) {
  return (
    <View
      style={{
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: GLASS,
        borderWidth: 1,
        borderColor: HAIRLINE,
      }}
    >
      <BlurView
        intensity={BLUR_INTENSITY}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      {pulse ? (
        <ActivityIndicator size="small" color={palette.accent.mint} />
      ) : (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: palette.accent.mint,
          }}
        />
      )}
      <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Coaching strip shown above the shutter until the first capture lands
 * in the session tray (which then owns this space):
 *
 *   • identifying — a capture's identify call is in flight
 *   • hint        — the detector had actionable framing guidance
 *   • idle        — quiet one-line coach: frame the card, tap the shutter
 */
export function ResultArea({
  detectorHint,
  scanning,
}: {
  detectorHint: string | null;
  scanning: boolean;
}) {
  if (scanning) return <HintPill label="Identifying…" pulse />;
  if (detectorHint) return <HintPill label={detectorHint} />;
  return <HintPill label="Frame the card, then tap the shutter" />;
}
