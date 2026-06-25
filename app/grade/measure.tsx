/**
 * `/grade/measure` — measure a card's centering from a photo.
 *
 * True pixel-CV auto-detection (the web's `detectCard`) needs raw pixel
 * access, which isn't reliably shippable over the air on RN. Instead this is
 * a deterministic, user-guided measurement: snap a photo, tap the four card
 * corners then the four print-border corners, and the SHARED
 * `measureCentering()` (from @loupe/grade) computes the exact PSA split — no
 * flaky vision, and the result writes straight back into the playground.
 */
import React, { useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Camera, Check, RotateCcw, Undo2, X } from "lucide-react-native";
import { measureCentering, type Frame } from "@loupe/grade";
import { useGradePlaygroundStore } from "@/application/stores/gradePlaygroundStore";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { gradeColor, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type Pt = { x: number; y: number };
type Photo = { uri: string; width: number; height: number };

/** Bounding box of the tapped points → a normalized [0,1] frame. */
function bbox(pts: Pt[]): Frame {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

export default function GradeMeasureScreen() {
  const p = useThemedPalette();
  const setSub = useGradePlaygroundStore((s) => s.setSub);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  // Tap collection: first 4 = outer card corners, next 4 = inner border corners.
  const [outer, setOuter] = useState<Pt[]>([]);
  const [inner, setInner] = useState<Pt[]>([]);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const stage: "outer" | "inner" | "done" =
    outer.length < 4 ? "outer" : inner.length < 4 ? "inner" : "done";

  const result = useMemo(() => {
    if (outer.length < 4 || inner.length < 4) return null;
    return measureCentering(bbox(outer), bbox(inner));
  }, [outer, inner]);

  const take = async () => {
    const cam = cameraRef.current;
    if (!cam || busy) return;
    setBusy(true);
    try {
      const shot = await cam.takePictureAsync({ quality: 0.7, exif: false });
      if (shot) setPhoto({ uri: shot.uri, width: shot.width, height: shot.height });
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    setPhoto(null);
    setOuter([]);
    setInner([]);
  };

  const undo = () => {
    if (inner.length > 0) setInner((a) => a.slice(0, -1));
    else if (outer.length > 0) setOuter((a) => a.slice(0, -1));
  };

  const onTap = (e: GestureResponderEvent) => {
    if (box.w <= 0 || box.h <= 0) return;
    const pt: Pt = {
      x: Math.max(0, Math.min(1, e.nativeEvent.locationX / box.w)),
      y: Math.max(0, Math.min(1, e.nativeEvent.locationY / box.h)),
    };
    if (outer.length < 4) setOuter((a) => [...a, pt]);
    else if (inner.length < 4) setInner((a) => [...a, pt]);
  };

  const useResult = () => {
    if (result) {
      setSub("centering", result.grade);
      router.back();
    }
  };

  // ── Permission gate ──
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: p.bg.base, padding: 24, justifyContent: "center", gap: 16 }}
      >
        <Text style={{ color: p.ink.default, fontSize: 20, fontWeight: "800" }}>
          Camera access
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 14, lineHeight: 20 }}>
          Allow the camera to photograph the card and measure its centering.
        </Text>
        <PrimaryButton label="Allow camera" icon={Camera} variant="mint" onPress={() => void requestPermission()} />
        <PrimaryButton label="Not now" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  // ── Capture phase ──
  if (!photo) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        <SafeAreaView edges={["top", "bottom"]} style={{ ...StyleSheetAbsoluteFill, justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-start", padding: 16 }}>
            <GlassButton onPress={() => router.back()} label="Close">
              <X size={22} color="#fff" strokeWidth={2.2} />
            </GlassButton>
          </View>

          {/* Card-shaped guide */}
          <View pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: "72%",
                aspectRatio: 2.5 / 3.5,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: withAlpha("#fff", 0.85),
              }}
            />
            <Text style={{ color: "#fff", marginTop: 16, fontSize: 13, fontWeight: "600", textShadowColor: "#000", textShadowRadius: 6 }}>
              Fill the frame with the card, then snap
            </Text>
          </View>

          <View style={{ alignItems: "center", paddingBottom: 12 }}>
            <Pressable
              onPress={take}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={({ pressed }) => ({
                width: 76,
                height: 76,
                borderRadius: 38,
                borderWidth: 5,
                borderColor: "#fff",
                backgroundColor: withAlpha("#fff", pressed ? 0.5 : 0.25),
                opacity: busy ? 0.5 : 1,
              })}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Mark phase ──
  const tint = result ? gradeColor(result.grade) : p.accent.mint;
  const placed = [...outer, ...inner];
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <X size={18} color={p.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Measure centering
        </Text>
        <Pressable
          onPress={retake}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retake photo"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <RotateCcw size={15} color={p.ink.muted} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, gap: 14 }}>
        {/* Instruction */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: withAlpha(p.accent.mint, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.25),
          }}
        >
          <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700", flex: 1 }}>
            {stage === "outer"
              ? `Tap the 4 corners of the card (${outer.length}/4)`
              : stage === "inner"
                ? `Now the 4 inside corners of the printed border (${inner.length}/4)`
                : "Centering measured ✓"}
          </Text>
          {placed.length > 0 ? (
            <Pressable onPress={undo} hitSlop={8} accessibilityLabel="Undo last tap">
              <Undo2 size={16} color={p.ink.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Photo + tap surface (box aspect matches the photo so taps map 1:1). */}
        <View style={{ alignItems: "center" }}>
          <Pressable
            onLayout={(e: LayoutChangeEvent) =>
              setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
            }
            onPress={onTap}
            style={{
              width: "100%",
              aspectRatio: photo.width / photo.height,
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: p.bg.sunken,
            }}
          >
            <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            {/* Tap dots */}
            {placed.map((pt, i) => {
              const isInner = i >= outer.length;
              return (
                <View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: pt.x * box.w - 7,
                    top: pt.y * box.h - 7,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: "#fff",
                    backgroundColor: isInner ? p.accent.amber : p.accent.mint,
                  }}
                />
              );
            })}
          </Pressable>
        </View>

        {/* Result */}
        {result ? (
          <View
            style={{
              borderRadius: 16,
              padding: 16,
              backgroundColor: withAlpha(tint, 0.1),
              borderWidth: 1,
              borderColor: withAlpha(tint, 0.3),
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Text style={{ color: tint, fontSize: 40, fontWeight: "900", letterSpacing: -1 }}>
              {result.grade}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "800" }}>
                Centering sub-grade
              </Text>
              <Text style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}>
                L/R {result.hLabel}   ·   T/B {result.vLabel}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: p.ink.dim, fontSize: 12, textAlign: "center" }}>
            Tip: tap the very corners — the closer your marks, the truer the read.
          </Text>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: 8 }}>
          <PrimaryButton
            label="Use this centering"
            icon={Check}
            variant="mint"
            disabled={!result}
            onPress={useResult}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function GlassButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha("#000", pressed ? 0.5 : 0.35),
        borderWidth: 1,
        borderColor: withAlpha("#fff", 0.2),
      })}
    >
      {children}
    </Pressable>
  );
}
