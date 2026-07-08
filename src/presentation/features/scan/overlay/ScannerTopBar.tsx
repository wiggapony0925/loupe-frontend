import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { ChevronDown, X, Zap, ZapOff } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { IdentifyTcgHint } from "@/infrastructure/repositories/identifyRepository";
import { BLUR_INTENSITY, GLASS, HAIRLINE } from "./theme";
import { GlassCircle } from "./GlassCircle";
import { TCG_OPTIONS } from "./constants";

/**
 * The scanner's top chrome: a close button, the front-and-center game
 * selector ("what am I scanning?"), a torch toggle, and a slim live
 * status line. Camera-agnostic — every state it shows is passed in, and
 * every action is a callback — so both the expo-camera flow and the
 * native flow lead with the same header. `leadingExtra` lets a surface
 * slot an extra control (e.g. the native AUTO-capture toggle) left of the
 * torch without forking the component.
 */
export function ScannerTopBar({
  onClose,
  flashOn,
  locked,
  hasMatch,
  scanning,
  onToggleFlash,
  tcgHint,
  onOpenTcgPicker,
  palette: themed,
  leadingExtra,
}: {
  onClose: () => void;
  flashOn: boolean;
  locked: boolean;
  hasMatch: boolean;
  scanning: boolean;
  onToggleFlash: () => void;
  tcgHint: IdentifyTcgHint;
  onOpenTcgPicker: () => void;
  palette: ReturnType<typeof useThemedPalette>;
  leadingExtra?: React.ReactNode;
}) {
  // Status dot — quietly steady while the camera waits for a tap, pulsing
  // only while an identify is actually in flight, solid mint on a match.
  const dot = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    if (locked || hasMatch) {
      dot.setValue(1);
      return;
    }
    if (!scanning) {
      dot.setValue(0.55);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: 1,
          duration: 750,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [locked, hasMatch, scanning, dot]);

  const tcgOption = TCG_OPTIONS.find((o) => o.key === tcgHint) ?? TCG_OPTIONS[0]!;
  const tcgColor = themed.accent[tcgOption.accent];
  const status = locked
    ? "Locked in"
    : hasMatch
      ? "Match found"
      : scanning
        ? "Identifying…"
        : "Frame a card · tap the shutter";

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <GlassCircle onPress={onClose} accessibilityLabel="Close scanner" size={46}>
          <X size={24} color="#fff" strokeWidth={2.4} />
        </GlassCircle>

        {/* Game selector — front and center, the way a pro scanner leads with
            "what am I scanning?" (Collectr's "Trading Card Games ▼"). Tapping
            opens the picker sheet mounted in the bottom panel. */}
        <Pressable
          onPress={onOpenTcgPicker}
          accessibilityRole="button"
          accessibilityLabel={`Game: ${tcgOption.label}. Tap to change.`}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 14,
              paddingRight: 12,
              paddingVertical: 10,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: GLASS,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: HAIRLINE,
            }}
          >
            <BlurView
              intensity={BLUR_INTENSITY}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tcgColor }}
            />
            <Text
              style={{
                color: "#fff",
                fontWeight: "800",
                fontSize: 14.5,
                letterSpacing: 0.1,
              }}
            >
              {tcgOption.label}
            </Text>
            <ChevronDown size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.4} />
          </View>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {leadingExtra}
          <GlassCircle
            onPress={onToggleFlash}
            accessibilityLabel={flashOn ? "Turn light off" : "Turn light on"}
            size={46}
            tint={flashOn ? withAlpha(themed.accent.amber, 0.22) : GLASS}
            borderColor={flashOn ? withAlpha(themed.accent.amber, 0.55) : HAIRLINE}
          >
            {flashOn ? (
              <Zap size={23} color={themed.accent.amber} strokeWidth={2.4} />
            ) : (
              <ZapOff size={23} color="#fff" strokeWidth={2.2} />
            )}
          </GlassCircle>
        </View>
      </View>

      {/* Slim live-status line under the header — subtle feedback, doesn't
          compete with the game selector or the bottom result card. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Animated.View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor:
              locked || hasMatch ? themed.accent.mint : "rgba(255,255,255,0.8)",
            opacity: dot,
          }}
        />
        <Text
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.2,
            textShadowColor: "rgba(0,0,0,0.6)",
            textShadowRadius: 6,
          }}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}
