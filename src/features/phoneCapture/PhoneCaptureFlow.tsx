/**
 * Full-screen guided capture flow for phone-based grading.
 *
 * Renders the live camera preview with a card-shaped overlay, the current
 * step's instruction, a progress dot row, and the shutter. On the final
 * frame, calls `onComplete(captures)` so the parent can hand the captures
 * to the existing scan-job pipeline.
 */
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, RotateCcw, X } from "lucide-react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { palette } from "@/theme/tokens";
import type { PhotometricCapture } from "@/types/domain";
import { usePhoneCapture, type PhoneCaptureHook } from "./usePhoneCapture";
import type { PhoneCaptureMode } from "./captureSteps";

interface PhoneCaptureFlowProps {
  mode: PhoneCaptureMode;
  onComplete: (captures: PhotometricCapture[]) => void;
  onCancel: () => void;
}

export function PhoneCaptureFlow({ mode, onComplete, onCancel }: PhoneCaptureFlowProps) {
  const ctrl = usePhoneCapture(mode);

  useEffect(() => {
    if (ctrl.done && ctrl.captures.length === ctrl.steps.length) {
      onComplete(ctrl.captures);
    }
  }, [ctrl.done, ctrl.captures, ctrl.steps.length, onComplete]);

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
        <SafeAreaView style={{ flex: 1, justifyContent: "space-between" }}>
          <TopBar ctrl={ctrl} onCancel={onCancel} />
          <CardOverlay tilt={step?.tilt ?? "flat"} />
          <BottomBar ctrl={ctrl} />
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

// ─────────────── Subviews ───────────────

function TopBar({ ctrl, onCancel }: { ctrl: PhoneCaptureHook; onCancel: () => void }) {
  return (
    <LinearGradient
      colors={["rgba(0,0,0,0.7)", "transparent"]}
      style={{ paddingHorizontal: 20, paddingVertical: 16 }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onCancel}
          hitSlop={12}
          accessibilityLabel="Cancel capture"
          className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
        >
          <X size={18} color="#fff" />
        </Pressable>
        <View className="items-center">
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-white/60">
            {ctrl.mode === "studio" ? "Studio Grade" : "Quick Grade"}
          </Text>
          <Text className="mt-0.5 text-sm font-semibold text-white">
            Step {Math.min(ctrl.currentIndex + 1, ctrl.steps.length)} of {ctrl.steps.length}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <View className="mt-3 flex-row justify-center gap-1.5">
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
    </LinearGradient>
  );
}

function CardOverlay({ tilt }: { tilt: "flat" | "top" | "bottom" }) {
  // Approximate trading-card aspect (2.5 × 3.5 in → 0.714).
  const aspect = 2.5 / 3.5;
  const tiltStyle =
    tilt === "top"
      ? { transform: [{ perspective: 800 }, { rotateX: "-12deg" as const }] }
      : tilt === "bottom"
        ? { transform: [{ perspective: 800 }, { rotateX: "12deg" as const }] }
        : undefined;

  return (
    <View pointerEvents="none" className="items-center justify-center" style={{ flex: 1 }}>
      <View
        style={[
          {
            width: "78%",
            aspectRatio: aspect,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: "rgba(0,245,155,0.85)",
            shadowColor: palette.accent.mint,
            shadowOpacity: 0.6,
            shadowRadius: 12,
          },
          tiltStyle,
        ]}
      >
        {/* Corner marks */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <View key={corner} style={cornerMarkStyle(corner)} />
        ))}
      </View>
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
                  backgroundColor: q.ok ? "rgba(0,245,155,0.18)" : "rgba(255,69,58,0.18)",
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
          accessibilityLabel="Retake last shot"
          className="h-12 w-12 items-center justify-center rounded-full bg-white/10"
          style={{ opacity: ctrl.captures.length === 0 ? 0.3 : 1 }}
        >
          <RotateCcw size={20} color="#fff" />
        </Pressable>

        <Pressable
          onPress={ctrl.capture}
          disabled={ctrl.busy || ctrl.done}
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
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Camera size={48} color={palette.accent.mint} />
        <View className="items-center gap-2">
          <Text className="text-xl font-semibold text-ink">Camera access needed</Text>
          <Text className="text-center text-sm text-ink-muted">
            Loupe uses your camera to capture cards for forensic grading. Photos stay on-device
            until you submit a scan.
          </Text>
        </View>
        <View className="w-full gap-2">
          <PrimaryButton
            label="Allow camera"
            icon={Camera}
            variant="mint"
            onPress={() => ctrl.requestPermission()}
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

function cornerMarkStyle(corner: "tl" | "tr" | "bl" | "br") {
  const base = {
    position: "absolute" as const,
    width: 18,
    height: 18,
    borderColor: palette.accent.mint,
  };
  switch (corner) {
    case "tl":
      return { ...base, top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 };
    case "tr":
      return { ...base, top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 };
    case "bl":
      return { ...base, bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 };
    case "br":
      return { ...base, bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 };
  }
}
