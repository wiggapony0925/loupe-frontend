/**
 * `(tabs)/scan` — center-pinned Scan tab.
 *
 * The single most important verb in the app is scanning a card. Under
 * the old IA it was a section near the bottom of Command Center and a
 * sub-step inside a hardware pairing flow — meaning the primary action
 * could cost two-plus taps from any non-home tab. Promoting it to the
 * middle tab slot (Robinhood/Cash App pattern) makes capture a global
 * one-tap surface.
 *
 * The screen itself is a landing card that mirrors the Studio/Quick
 * toggle from `PhoneCaptureCard` on home, then pushes into the existing
 * `/scan/phone` modal so the capture pipeline (`PhoneCaptureFlow` →
 * `CaptureReviewScreen` → `useScanJob`) stays unchanged.
 *
 * The slot freed up by removing the Watch tab — Watch is a management
 * screen for a feature most users won't configure, and it now lives
 * behind the bell where it belongs.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Camera,
  ChevronRight,
  Gauge,
  PlusCircle,
  Smartphone,
  Sparkles,
} from "lucide-react-native";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { useScannerConnection } from "@/presentation/features/scanner";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

/**
 * Scan tab — the single most important verb in the app, with ONE clear job:
 * point the camera at a card and identify it. What happens next (see price,
 * add to vault, or grade it) is decided AFTER we recognise the card, on the
 * result sheet — not as an up-front "Studio vs Quick" mode choice the user
 * had to make before they'd even seen anything. Grading lives one tap away as
 * its own deliberate path for when that's the actual intent.
 */
export default function ScanTabScreen() {
  const p = useThemedPalette();
  const hardware = useScannerConnection();
  const connected =
    hardware.data != null && hardware.data.transport !== "offline";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Capture
        </Text>

        {/* The one primary action, dressed as a live viewfinder so the tap
            target previews exactly what scanning looks like — corner
            brackets + a glowing shutter — instead of a flat button. The
            result sheet branches into price / vault / grade after a lock. */}
        <ScanHero
          palette={p}
          onPress={() => router.push(routes.scanIdentify())}
        />

        {/* Deliberate secondary paths — grade (its own verb), add a card you
            already know, or use the hardware scanner. One tap, not a menu. */}
        <View>
          <SectionHeader eyebrow="Or" title="Grade & add" />
          <View style={{ gap: 10 }}>
            <SecondaryRow
              icon={Gauge}
              tint={p.accent.purple}
              label="Grade a card"
              detail="Measure centering, edges & surface — estimate the grade before you slab."
              onPress={() => router.push(routes.scanPhone("studio"))}
            />
            <SecondaryRow
              icon={Sparkles}
              tint={p.accent.mint}
              label="Loupe Playground"
              detail="Score it by eye — get a PSA-style grade estimate instantly."
              onPress={() => router.push(routes.gradePlayground())}
            />
            <SecondaryRow
              icon={PlusCircle}
              tint={p.accent.amber}
              label="Add by catalog"
              detail="Already know the card? Pick it and enter cost basis."
              onPress={() => router.push(routes.gradeNew())}
            />
            <SecondaryRow
              icon={Smartphone}
              tint={connected ? p.accent.mint : p.ink.muted}
              label={connected ? "Hardware scanner ready" : "Pair Loupe scanner"}
              detail={
                connected
                  ? "Open the desktop app to capture from the cradle."
                  : "Connect the Bluetooth scanner for studio-grade results."
              }
              onPress={() => router.push("/scan/pair")}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.25),
            backgroundColor: withAlpha(p.accent.mint, 0.06),
          }}
        >
          <Sparkles size={16} color={p.accent.mint} />
          <Text
            style={{ color: p.ink.muted, fontSize: 12, flex: 1, lineHeight: 17 }}
          >
            Every scan trains your portfolio — identify once, track value forever.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * ScanHero — the primary "Scan a card" affordance, styled as a live
 * viewfinder: a tall framed surface with mint corner brackets, a soft
 * scan-line shimmer, and a glowing shutter button. Pressing anywhere
 * launches the live identifier. Echoes the real scanner's reticle so the
 * jump into the camera feels continuous.
 */
function ScanHero({
  palette,
  onPress,
}: {
  palette: ReturnType<typeof useThemedPalette>;
  onPress: () => void;
}) {
  const p = palette;
  const shimmer = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.5,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    sweep.start();
    pulse.start();
    return () => {
      sweep.stop();
      pulse.stop();
    };
  }, [shimmer, glow]);

  const HERO_H = 268;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open the live card scanner"
      style={({ pressed }) => ({
        height: HERO_H,
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: withAlpha(p.accent.mint, 0.22),
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {/* Mint wash so the surface reads "camera", not "card". */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: withAlpha(p.accent.mint, 0.05),
        }}
      />

      {/* Travelling scan line. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          height: 2,
          borderRadius: 2,
          backgroundColor: withAlpha(p.accent.mint, 0.7),
          shadowColor: p.accent.mint,
          shadowOpacity: 0.9,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          opacity: shimmer.interpolate({
            inputRange: [0, 0.1, 0.9, 1],
            outputRange: [0, 0.9, 0.9, 0],
          }),
          transform: [
            {
              translateY: shimmer.interpolate({
                inputRange: [0, 1],
                outputRange: [-HERO_H / 2 + 28, HERO_H / 2 - 28],
              }),
            },
          ],
        }}
      />

      {/* Corner brackets — same rounded-L aesthetic as the live reticle. */}
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <HeroBracket key={c} corner={c} color={withAlpha(p.accent.mint, 0.85)} />
      ))}

      {/* Glowing shutter. */}
      <View style={{ alignItems: "center", gap: 14 }}>
        <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            style={{
              position: "absolute",
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: withAlpha(p.accent.mint, 0.18),
              opacity: glow,
              transform: [
                { scale: glow.interpolate({ inputRange: [0.5, 1], outputRange: [0.9, 1.12] }) },
              ],
            }}
          />
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: p.accent.mint,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: p.accent.mint,
              shadowOpacity: 0.5,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <Camera size={28} color="#06140d" strokeWidth={2.2} />
          </View>
        </View>

        <View style={{ alignItems: "center", gap: 3 }}>
          <Text style={{ color: p.ink.default, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 }}>
            Scan a card
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 12.5 }}>
            Point your camera — we identify it instantly
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function HeroBracket({
  corner,
  color,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  color: string;
}) {
  const SIZE = 34;
  const THICK = 3;
  const RADIUS = 18;
  const INSET = 16;
  const base = {
    position: "absolute" as const,
    width: SIZE,
    height: SIZE,
    borderColor: color,
  };
  switch (corner) {
    case "tl":
      return (
        <View
          pointerEvents="none"
          style={{ ...base, top: INSET, left: INSET, borderTopWidth: THICK, borderLeftWidth: THICK, borderTopLeftRadius: RADIUS }}
        />
      );
    case "tr":
      return (
        <View
          pointerEvents="none"
          style={{ ...base, top: INSET, right: INSET, borderTopWidth: THICK, borderRightWidth: THICK, borderTopRightRadius: RADIUS }}
        />
      );
    case "bl":
      return (
        <View
          pointerEvents="none"
          style={{ ...base, bottom: INSET, left: INSET, borderBottomWidth: THICK, borderLeftWidth: THICK, borderBottomLeftRadius: RADIUS }}
        />
      );
    case "br":
      return (
        <View
          pointerEvents="none"
          style={{ ...base, bottom: INSET, right: INSET, borderBottomWidth: THICK, borderRightWidth: THICK, borderBottomRightRadius: RADIUS }}
        />
      );
  }
}

interface SecondaryRowProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tint: string;
  label: string;
  detail: string;
  onPress: () => void;
}

function SecondaryRow({ icon: Icon, tint, label, detail, onPress }: SecondaryRowProps) {
  const p = useThemedPalette();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(tint, 0.14),
        }}
      >
        <Icon size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={16} color={p.ink.dim} />
    </Pressable>
  );
}
