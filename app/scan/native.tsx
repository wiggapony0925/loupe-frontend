/**
 * Native scan — `/scan/native`
 *
 * A first-party Swift camera scanner: the preview, the live card-tracking
 * reticle, and the still capture are all AVFoundation + Vision, drawn in
 * `LoupeCameraView` (modules/loupe-scanner-bridge/ios/LoupeCameraView.swift).
 * This screen is the JS chrome around it — header, framing hint, shutter,
 * and the identify → result flow — plus a graceful fallback to the
 * expo-camera `LiveIdentifyFlow` when the native view isn't available
 * (Android, older builds).
 */
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCameraPermissions } from "expo-camera";
import { ChevronLeft, Flashlight, X } from "lucide-react-native";
import { identifyCard } from "@/infrastructure/repositories/identifyRepository";
import type { IdentifyCandidate } from "@/infrastructure/repositories/identifyRepository";
import { cardDetector } from "@/infrastructure/native";
import { CardImage } from "@/presentation/components/CardImage";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useCreateGrade } from "@/application/queries/collection/useGradeMutations";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCompactUsd } from "@/shared/format";
import { routes } from "@/shared/routes";
import {
  LoupeCameraView,
  isNativeCameraAvailable,
  type CaptureEvent,
} from "../../modules/loupe-scanner-bridge";

type Phase = "framing" | "identifying" | "result" | "error";

export default function NativeScanScreen() {
  const p = useThemedPalette();
  const formatUsd = useCompactUsd();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [detected, setDetected] = useState(false);
  const [phase, setPhase] = useState<Phase>("framing");
  const [captureReq, setCaptureReq] = useState<string>("");
  const [candidate, setCandidate] = useState<IdentifyCandidate | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const busyRef = useRef(false);
  const createGrade = useCreateGrade();

  // Native camera is iOS-only today; fall back to the RN flow elsewhere.
  const useNative = Platform.OS === "ios" && isNativeCameraAvailable;

  React.useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  React.useEffect(() => {
    // Non-native platforms bounce to the proven expo-camera flow.
    if (!useNative) router.replace(routes.scanIdentify());
  }, [useNative]);

  const onShutter = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase("identifying");
    // A fresh id triggers the native capture; the result comes back on
    // onCapture with the same id.
    setCaptureReq(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  const runIdentify = useCallback(async (uri: string, corners: number[] | null) => {
    try {
      // Crop+deskew natively when we have the card corners — uploads ~30KB
      // instead of the full frame. The native detector converts normalized
      // corners to pixel space internally.
      let uploadUri = uri;
      if (corners && corners.length === 8 && cardDetector.capabilities.crop) {
        try {
          const cropped = await cardDetector.crop(uri, corners, 900, 0.82);
          if (cropped?.uri) uploadUri = cropped.uri;
        } catch {
          // Fall back to the full frame.
        }
      }
      const res = await identifyCard(uploadUri);
      const top = res.candidates?.[0] ?? null;
      if (top) {
        setCandidate(top);
        setPhase("result");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      } else {
        setErrorMsg("Couldn't read that card. Try a straighter, closer shot.");
        setPhase("error");
      }
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "Something went wrong identifying the card.",
      );
      setPhase("error");
    } finally {
      busyRef.current = false;
    }
  }, []);

  const onCapture = useCallback(
    (e: { nativeEvent: CaptureEvent }) => {
      const { uri, corners, error } = e.nativeEvent;
      if (error || !uri) {
        setErrorMsg(error ?? "Capture failed. Try again.");
        setPhase("error");
        busyRef.current = false;
        return;
      }
      void runIdentify(uri, corners ?? null);
    },
    [runIdentify],
  );

  const reset = useCallback(() => {
    setCandidate(null);
    setErrorMsg(null);
    setPhase("framing");
    busyRef.current = false;
  }, []);

  const onAdd = useCallback(() => {
    if (!candidate) return;
    const id = candidate.card_id ?? candidate.upstream_id;
    if (!id) return;
    createGrade.mutate(
      { cardId: id, grade: 9, house: "loupe", condition: "nm" },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {},
          );
          router.replace(routes.vault());
        },
      },
    );
  }, [candidate, createGrade]);

  const onView = useCallback(() => {
    if (!candidate) return;
    const id = candidate.card_id ?? candidate.upstream_id;
    if (id) router.push(routes.card(id));
  }, [candidate]);

  if (!useNative) {
    // The replace effect handles navigation; render nothing meanwhile.
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Native Swift camera preview + live reticle */}
      <LoupeCameraView
        style={{ flex: 1 }}
        active={phase === "framing" || phase === "identifying"}
        torchEnabled={torch}
        detectionEnabled={phase === "framing"}
        captureRequestId={captureReq}
        onCardDetected={(e) => setDetected(e.nativeEvent.detected)}
        onCapture={onCapture}
        onMountError={(e) => {
          setErrorMsg(e.nativeEvent.message);
          setPhase("error");
        }}
      />

      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ ...StyleSheetAbsoluteFill, justifyContent: "space-between" }}
        pointerEvents="box-none"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
          pointerEvents="box-none"
        >
          <GlassButton onPress={() => router.back()} label="Close">
            <ChevronLeft size={20} color="#fff" />
          </GlassButton>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              {phase === "identifying" ? "IDENTIFYING…" : detected ? "CARD FRAMED" : "FIND A CARD"}
            </Text>
          </View>
          <GlassButton
            onPress={() => setTorch((v) => !v)}
            label="Toggle torch"
            active={torch}
          >
            <Flashlight size={18} color={torch ? "#0B0B0D" : "#fff"} />
          </GlassButton>
        </View>

        {/* Framing hint */}
        {phase === "framing" ? (
          <View style={{ alignItems: "center", paddingBottom: 8 }} pointerEvents="none">
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                fontWeight: "600",
                textAlign: "center",
                maxWidth: 260,
              }}
            >
              {detected
                ? "Hold steady — tap to capture"
                : "Line the card up inside the frame"}
            </Text>
          </View>
        ) : null}

        {/* Shutter */}
        {phase === "framing" || phase === "identifying" ? (
          <View style={{ alignItems: "center", paddingBottom: 20 }} pointerEvents="box-none">
            <Pressable
              onPress={onShutter}
              disabled={phase === "identifying"}
              accessibilityRole="button"
              accessibilityLabel="Capture card"
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                borderWidth: 4,
                borderColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  backgroundColor:
                    phase === "identifying"
                      ? withAlpha(p.accent.mint, 0.5)
                      : detected
                        ? p.accent.mint
                        : "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {phase === "identifying" ? (
                  <ActivityIndicator color="#0B0B0D" />
                ) : null}
              </View>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Result sheet */}
      {phase === "result" && candidate ? (
        <ResultSheet
          candidate={candidate}
          formatUsd={formatUsd}
          onAdd={onAdd}
          onView={onView}
          onRetry={reset}
          adding={createGrade.isPending}
          palette={p}
        />
      ) : null}

      {/* Error sheet */}
      {phase === "error" ? (
        <BottomSheet palette={p}>
          <Text style={{ color: p.ink.default, fontSize: 16, fontWeight: "800" }}>
            Couldn&apos;t identify
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
            {errorMsg ?? "Try again."}
          </Text>
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="Try again" variant="mint" onPress={reset} />
          </View>
        </BottomSheet>
      ) : null}
    </View>
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
  children,
  onPress,
  label,
  active = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? "#16C09C" : "rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </Pressable>
  );
}

function BottomSheet({
  children,
  palette,
}: {
  children: React.ReactNode;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: 20,
        paddingBottom: 36,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        backgroundColor: palette.bg.base,
        borderTopWidth: 1,
        borderColor: palette.line.default,
      }}
    >
      {children}
    </View>
  );
}

function ResultSheet({
  candidate,
  formatUsd,
  onAdd,
  onView,
  onRetry,
  adding,
  palette,
}: {
  candidate: IdentifyCandidate;
  formatUsd: (v: number) => string;
  onAdd: () => void;
  onView: () => void;
  onRetry: () => void;
  adding: boolean;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const p = palette;
  const price = candidate.market_price_usd ?? null;
  const copies = candidate.copies_owned ?? 0;
  const graded = candidate.graded_copies ?? 0;
  const meta = [candidate.set_name, candidate.number ? `#${candidate.number}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <BottomSheet palette={p}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View
          style={{
            width: 64,
            height: 90,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: p.bg.sunken,
          }}
        >
          <CardImage
            uri={candidate.image_url ?? undefined}
            width={64}
            height={90}
            rounded={10}
            alt={candidate.name}
          />
        </View>
        <View style={{ flex: 1, justifyContent: "center", gap: 3 }}>
          <Text numberOfLines={2} style={{ color: p.ink.default, fontSize: 17, fontWeight: "800" }}>
            {candidate.name}
          </Text>
          {meta ? (
            <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 12.5 }}>
              {meta}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
            {price != null ? (
              <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "800" }}>
                {formatUsd(price)}
              </Text>
            ) : null}
            {copies > 0 ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: withAlpha(p.accent.mint, 0.14),
                }}
              >
                <Text style={{ color: p.accent.mint, fontSize: 10.5, fontWeight: "800" }}>
                  Own ×{copies}
                  {graded > 0 ? ` (${graded} graded)` : ""}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label={adding ? "Adding…" : "Add to vault"}
            variant="mint"
            loading={adding}
            onPress={onAdd}
          />
        </View>
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel="View card details"
          style={{
            paddingHorizontal: 18,
            justifyContent: "center",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
          }}
        >
          <Text style={{ color: p.ink.default, fontWeight: "700", fontSize: 14 }}>View</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Scan another"
        style={{ alignItems: "center", paddingTop: 14 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <X size={13} color={p.ink.muted} />
          <Text style={{ color: p.ink.muted, fontSize: 13, fontWeight: "600" }}>
            Scan another
          </Text>
        </View>
      </Pressable>
    </BottomSheet>
  );
}
