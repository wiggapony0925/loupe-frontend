/**
 * Full-screen guided capture flow for phone-based grading.
 *
 * Renders the live camera preview with a card-shaped overlay, the current
 * step's instruction, a progress dot row, and the shutter. On the final
 * frame, calls `onComplete(captures)` so the parent can hand the captures
 * to the existing scan-job pipeline.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Camera, RotateCcw, X } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { palette, withAlpha } from "@/presentation/theme/tokens";
import type { PhotometricCapture } from "@/domain";
import { usePhoneCapture, type PhoneCaptureHook } from "./usePhoneCapture";
import type { PhoneCaptureMode } from "./captureSteps";

interface PhoneCaptureFlowProps {
  mode: PhoneCaptureMode;
  onComplete: (captures: PhotometricCapture[]) => void;
  onCancel: () => void;
}

// Quick-mode lock-on timing. We don't have on-device card-edge
// detection in the phone preview, so we simulate "locking on" by
// giving the user a steady arming window (haptic ticks + bracket
// pulse) and then auto-firing the shutter. Tapping the shutter
// manually still works at any time.
const LOCKON_MS = 1800;
const LOCKON_TICK_MS = 450;

export function PhoneCaptureFlow({ mode, onComplete, onCancel }: PhoneCaptureFlowProps) {
  const ctrl = usePhoneCapture(mode);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (ctrl.done && ctrl.captures.length === ctrl.steps.length) {
      onComplete(ctrl.captures);
    }
  }, [ctrl.done, ctrl.captures, ctrl.steps.length, onComplete]);

  // Quick-mode auto-capture: as soon as a step is active and we're
  // not busy / done, start a short lock-on with haptic ticks, then
  // fire the shutter. Tearing down resets cleanly between steps and
  // on unmount.
  useEffect(() => {
    if (mode !== "quick") return;
    if (!ctrl.permission?.granted) return;
    if (ctrl.busy || ctrl.done) return;
    if (!ctrl.currentStep) return;

    let cancelled = false;
    setLocking(true);
    const ticks: ReturnType<typeof setTimeout>[] = [];
    for (let t = 0; t < LOCKON_MS; t += LOCKON_TICK_MS) {
      ticks.push(
        setTimeout(() => {
          if (!cancelled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }, t),
      );
    }
    const fire = setTimeout(() => {
      if (!cancelled) {
        setLocking(false);
        ctrl.capture();
      }
    }, LOCKON_MS);

    return () => {
      cancelled = true;
      ticks.forEach(clearTimeout);
      clearTimeout(fire);
      setLocking(false);
    };
    // We intentionally exclude `ctrl.capture` from deps — it's a
    // stable callback whose identity changes on every state update,
    // which would restart the lock-on loop mid-countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ctrl.permission?.granted, ctrl.busy, ctrl.done, ctrl.currentIndex]);

  if (!ctrl.permission) {
    return <CenterMessage label="Initializing camera…" />;
  }
  if (!ctrl.permission.granted) {
    return <PermissionGate ctrl={ctrl} onCancel={onCancel} />;
  }

  const step = ctrl.currentStep;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        ref={ctrl.cameraRef}
        style={{ flex: 1 }}
        facing="back"
        flash={step?.flash ? "on" : "off"}
        autofocus="on"
      >
        <SafeAreaView
          style={{ flex: 1, justifyContent: "space-between" }}
          pointerEvents="box-none"
        >
          <TopBar ctrl={ctrl} />
          <CardOverlay tilt={step?.tilt ?? "flat"} locking={locking} />
          <BottomBar ctrl={ctrl} />
        </SafeAreaView>
      </CameraView>

      {/*
        Close button is rendered at the screen root (outside the
        gradient + SafeArea layout) and given a generous hit area so
        it can't be eaten by the camera surface or a gradient layer.
      */}
      <CloseButton onCancel={onCancel} />
    </View>
  );
}

function CloseButton({ onCancel }: { onCancel: () => void }) {
  return (
    <SafeAreaView
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        elevation: 50,
      }}
      edges={["top"]}
    >
      <View pointerEvents="box-none" style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onCancel();
          }}
          hitSlop={20}
          accessibilityLabel="Close camera"
          accessibilityRole="button"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)",
          })}
        >
          <X size={22} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─────────────── Subviews ───────────────

function TopBar({ ctrl }: { ctrl: PhoneCaptureHook }) {
  // The close button lives at the screen root (see <CloseButton/>)
  // so the gradient + SafeArea inside the camera surface can't eat
  // the tap. We let touches fall through the gradient as well.
  const showSteps = ctrl.steps.length > 1;
  return (
    <LinearGradient
      pointerEvents="box-none"
      colors={["rgba(0,0,0,0.7)", "transparent"]}
      style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}
    >
      <View pointerEvents="box-none" className="items-center" style={{ paddingLeft: 60 }}>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-white/60">
          {ctrl.mode === "studio" ? "Studio Grade" : "Quick Scan"}
        </Text>
        {showSteps ? (
          <Text className="mt-0.5 text-sm font-semibold text-white">
            Step {Math.min(ctrl.currentIndex + 1, ctrl.steps.length)} of {ctrl.steps.length}
          </Text>
        ) : null}
      </View>
      {showSteps ? (
        <View pointerEvents="none" className="mt-3 flex-row justify-center gap-1.5">
          {ctrl.steps.map((s, i) => (
            <View
              key={s.index}
              style={{
                width: 22,
                height: 4,
                borderRadius: 2,
                backgroundColor:
                  i < ctrl.currentIndex
                    ? palette.accent.mint
                    : i === ctrl.currentIndex
                      ? "#fff"
                      : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

function CardOverlay({
  tilt,
  locking,
}: {
  tilt: "flat" | "top" | "bottom";
  locking?: boolean;
}) {
  // Approximate trading-card aspect (2.5 × 3.5 in → 0.714).
  const aspect = 2.5 / 3.5;
  const tiltStyle =
    tilt === "top"
      ? { transform: [{ perspective: 800 }, { rotateX: "-12deg" as const }] }
      : tilt === "bottom"
        ? { transform: [{ perspective: 800 }, { rotateX: "12deg" as const }] }
        : undefined;

  // Pulse the brackets while we're "locking on" so the user gets a
  // visible cue the camera is actively trying to capture.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!locking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [locking, pulse]);

  const opacity = locking
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
    : 1;
  const bracketColor = locking ? palette.accent.mint : "#fff";

  return (
    <View pointerEvents="none" className="items-center justify-center" style={{ flex: 1 }}>
      <Animated.View
        style={[
          {
            width: "78%",
            aspectRatio: aspect,
            opacity,
          },
          tiltStyle,
        ]}
      >
        {((["tl", "tr", "bl", "br"]) as const).map((corner) => (
          <View key={corner} style={cornerMarkStyle(corner, bracketColor)} />
        ))}
      </Animated.View>
    </View>
  );
}

function BottomBar({ ctrl }: { ctrl: PhoneCaptureHook }) {
  const step = ctrl.currentStep;
  const q = ctrl.lastQuality;
  return (
    <LinearGradient
      colors={["transparent", "rgba(0,0,0,0.85)"]}
      style={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 24, gap: 14 }}
    >
      {step ? (
        <View className="rounded-2xl bg-black/40 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-white/60">
              {step.label}
              {step.flash ? " · Flash" : ""}
              {step.tilt !== "flat" ? ` · Tilt ${step.tilt}` : ""}
            </Text>
            {q ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: q.ok
                    ? withAlpha(palette.accent.mint, 0.18)
                    : withAlpha(palette.accent.rose, 0.18),
                }}
              >
                <Text
                  className="text-[9px] font-semibold uppercase tracking-[2px]"
                  style={{ color: q.ok ? palette.accent.mint : palette.accent.rose }}
                >
                  {q.ok ? `Sharp ${(q.sharpness * 100).toFixed(0)}%` : "Rejected"}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-1 text-sm leading-5 text-white">{step.instruction}</Text>
        </View>
      ) : null}

      {ctrl.error ? (
        <View className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2">
          <Text className="text-xs text-rose-200">{ctrl.error}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={ctrl.retake}
          disabled={ctrl.captures.length === 0 || ctrl.busy}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retake last shot"
          className="h-12 w-12 items-center justify-center rounded-full bg-white/10"
          style={{ opacity: ctrl.captures.length === 0 ? 0.3 : 1 }}
        >
          <RotateCcw size={20} color="#fff" />
        </Pressable>

        <Pressable
          onPress={ctrl.capture}
          disabled={ctrl.busy || ctrl.done}
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
          className="items-center justify-center"
          style={{
            width: 78,
            height: 78,
            borderRadius: 39,
            borderWidth: 4,
            borderColor: "#fff",
            backgroundColor: ctrl.busy ? "rgba(255,255,255,0.4)" : "#fff",
          }}
        >
          {ctrl.busy ? (
            <ActivityIndicator color={palette.accent.mint} />
          ) : (
            <Camera size={28} color={palette.bg.base} />
          )}
        </Pressable>

        <View style={{ width: 48 }} />
      </View>
    </LinearGradient>
  );
}

function PermissionGate({ ctrl, onCancel }: { ctrl: PhoneCaptureHook; onCancel: () => void }) {
  // If the OS won't ask again (previous deny), requestPermission() is a
  // silent no-op — route the user to Settings instead so the gate isn't
  // a dead end.
  const mustOpenSettings = ctrl.permission ? !ctrl.permission.canAskAgain : false;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Camera size={48} color={palette.accent.mint} />
        <View className="items-center gap-2">
          <Text className="text-xl font-semibold text-ink">Camera access needed</Text>
          <Text className="text-center text-sm text-ink-muted">
            {mustOpenSettings
              ? "Camera access was denied. Open Settings → Loupe and enable Camera, then come back."
              : "Loupe uses your camera to capture cards for forensic grading. Photos stay on-device until you submit a scan."}
          </Text>
        </View>
        <View className="w-full gap-2">
          <PrimaryButton
            label={mustOpenSettings ? "Open Settings" : "Allow camera"}
            icon={Camera}
            variant="mint"
            onPress={async () => {
              if (mustOpenSettings) {
                Linking.openSettings().catch(() => {});
                return;
              }
              const next = await ctrl.requestPermission();
              if (!next.granted && !next.canAskAgain) {
                Linking.openSettings().catch(() => {});
              }
            }}
          />
          <PrimaryButton label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function CenterMessage({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator color={palette.accent.mint} />
      <Text className="mt-3 text-xs uppercase tracking-[2px] text-ink-dim">{label}</Text>
    </View>
  );
}

function cornerMarkStyle(corner: "tl" | "tr" | "bl" | "br", color: string = "#fff") {
  // Apple-style brackets: bigger L-shapes, no glow. Color is driven
  // by the lock-on state so they turn mint while the camera is arming.
  const SIZE = 28;
  const THICK = 3;
  const RADIUS = 4;
  const base = {
    position: "absolute" as const,
    width: SIZE,
    height: SIZE,
    borderColor: color,
  };
  switch (corner) {
    case "tl":
      return {
        ...base,
        top: -1,
        left: -1,
        borderTopWidth: THICK,
        borderLeftWidth: THICK,
        borderTopLeftRadius: RADIUS,
      };
    case "tr":
      return {
        ...base,
        top: -1,
        right: -1,
        borderTopWidth: THICK,
        borderRightWidth: THICK,
        borderTopRightRadius: RADIUS,
      };
    case "bl":
      return {
        ...base,
        bottom: -1,
        left: -1,
        borderBottomWidth: THICK,
        borderLeftWidth: THICK,
        borderBottomLeftRadius: RADIUS,
      };
    case "br":
      return {
        ...base,
        bottom: -1,
        right: -1,
        borderBottomWidth: THICK,
        borderRightWidth: THICK,
        borderBottomRightRadius: RADIUS,
      };
  }
}
