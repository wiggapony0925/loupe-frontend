/**
 * Native scan — `/scan/native`
 *
 * A first-party Swift (AVFoundation + Vision) / Kotlin (CameraX) camera
 * scanner with the SAME pro batch workflow and chrome as the expo-camera
 * `LiveIdentifyFlow` — it composes the shared scanner overlay
 * (`features/scan/overlay`) on top of the native camera, so the game
 * selector, the self-clearing banners, the framing-hint pill, the rolling
 * session tray (running total + "Add all"), the shutter, and the
 * manual-search escape hatch are pixel-identical to the RN flow. What's
 * unique here is the camera itself:
 *   • Native preview + a corner-bracket reticle that turns mint when the
 *     card is well-framed and held steady (all drawn in Swift).
 *   • Auto-capture — hold a card still in frame and it captures itself.
 *   • Pinch + 1×/2×/3× optical-feel zoom.
 *
 * Capture → native crop/deskew → the existing identify pipeline (with the
 * on-device OCR fallback). Falls back to the expo-camera `LiveIdentifyFlow`
 * when the native view isn't linked (Android without CameraX / older builds).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCameraPermissions } from "expo-camera";
import { Camera, CameraOff, Wand2 } from "lucide-react-native";
import {
  identifyCard,
  identifyCardFromText,
  type IdentifyCandidate,
  type IdentifyResponse,
  type IdentifyTcgHint,
  submitIdentifyFeedback,
} from "@/infrastructure/repositories/identifyRepository";
import {
  isOnDeviceOcrAvailable,
  recognizeTextOnDevice,
} from "@/infrastructure/ocr/onDeviceOcr";
import { cardDetector } from "@/infrastructure/native";
import { ApiError } from "@/infrastructure/http/client";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { usePro } from "@/presentation/features/pro";
import { useCreateGrade } from "@/application/queries/collection/useGradeMutations";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCompactUsd } from "@/shared/format";
import { routes } from "@/shared/routes";
import {
  BLUR_INTENSITY,
  GLASS,
  HAIRLINE,
  ScannerTopBar,
  ScannerBottomPanel,
  candidateKey,
  scannerErrorCopy,
  ERROR_DISMISS_MS,
  MAX_SCAN_SESSION_ITEMS,
  SESSION_RESULT_CONFIDENCE,
  type ScanSessionItem,
} from "@/presentation/features/scan/overlay";
import {
  LoupeCameraView,
  isNativeCameraAvailable,
  type CaptureEvent,
  type CardDetectedEvent,
} from "../../modules/loupe-scanner-bridge";

/** Live native-detector signal (iOS only today). */
type Detect = { detected: boolean; steady: boolean; fill: number };

/** RAW grade stamped on a batch-added card — Near Mint ≈ 9 (see identify.tsx). */
const BATCH_RAW_GRADE = 9;

export default function NativeScanScreen() {
  const p = useThemedPalette();
  const formatUsd = useCompactUsd();
  const [permission, requestPermission] = useCameraPermissions();
  const { gatingActive, cardCount, cardLimit, openPaywall } = usePro();
  const createGrade = useCreateGrade();

  // ── Camera controls ──────────────────────────────────────────────
  const [torch, setTorch] = useState(false);
  const [autoCapture, setAutoCapture] = useState(Platform.OS === "ios");
  const [zoom, setZoom] = useState(1);
  const [detect, setDetect] = useState<Detect>({ detected: false, steady: false, fill: 0 });
  const [captureReq, setCaptureReq] = useState("");
  const zoomBase = useRef(1);

  // ── Identify / session ───────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<ScanSessionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tcgHint, setTcgHint] = useState<IdentifyTcgHint>(null);
  const [tcgPickerOpen, setTcgPickerOpen] = useState(false);
  const [flash, setFlash] = useState<"none" | "hit" | "miss">("none");
  const [adding, setAdding] = useState(false);
  const busyRef = useRef(false);
  const sessionSeqRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Native camera resolves per-platform (Swift on iOS, CameraX on Android)
  // through the same LoupeCameraView contract; RN LiveIdentifyFlow is the
  // fallback when neither native view is linked (Expo Go, web, old builds).
  const useNative = isNativeCameraAvailable;
  // Live detection + auto-capture are iOS-only today (Android has no
  // rectangle-detection pass yet), so the AUTO toggle only applies there.
  const detectionSupported = Platform.OS === "ios";

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!useNative) router.replace(routes.scanIdentify());
  }, [useNative]);

  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  // Remaining free-tier vault slots (null = uncapped / Pro).
  const slotsLeft =
    gatingActive && cardLimit != null ? Math.max(0, cardLimit - cardCount) : null;

  // ── Session helpers (same ScanSessionItem lifecycle as LiveIdentifyFlow) ──
  const addSessionItem = useCallback((photoUri: string) => {
    const id = `${Date.now()}-${sessionSeqRef.current++}`;
    setSession((prev) =>
      [
        ...prev,
        {
          id,
          photoUri,
          candidate: null,
          identificationId: null,
          confidence: null,
          status: "scanning" as const,
        },
      ].slice(-MAX_SCAN_SESSION_ITEMS),
    );
    return id;
  }, []);

  const updateSessionItem = useCallback(
    (id: string, patch: Partial<Omit<ScanSessionItem, "id">>) => {
      setSession((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [],
  );

  const removeSessionItem = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSession((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const showScannerError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setError(scannerErrorCopy(message));
    errorTimerRef.current = setTimeout(() => setError(null), ERROR_DISMISS_MS);
  }, []);

  const flashCue = useCallback((kind: "hit" | "miss") => {
    setFlash(kind);
    setTimeout(() => setFlash("none"), 320);
  }, []);

  // ── Capture → identify ───────────────────────────────────────────
  const triggerCapture = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCaptureReq(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  const runIdentify = useCallback(
    async (uri: string, corners: number[] | null, itemId: string) => {
      try {
        let uploadUri = uri;
        if (corners && corners.length === 8 && cardDetector.capabilities.crop) {
          try {
            const cropped = await cardDetector.crop(uri, corners, 900, 0.82);
            if (cropped?.uri) uploadUri = cropped.uri;
          } catch {
            /* fall back to full frame */
          }
        }

        let res: IdentifyResponse = await identifyCard(uploadUri, tcgHint);
        // Server signalled the fast path missed — try on-device OCR, then
        // re-identify from the recognized text (same fallback the RN flow uses).
        if (res.fallback_required) {
          if (isOnDeviceOcrAvailable()) {
            const ocr = await recognizeTextOnDevice(uploadUri);
            if (ocr.text.length > 0) {
              res = await identifyCardFromText(ocr.text, tcgHint, {
                clientProvider: ocr.provider,
                ocrConfidence: ocr.confidence,
              });
            } else {
              showScannerError("On-device OCR found no text. Try better lighting.");
            }
          } else {
            showScannerError(
              res.fallback_reason ?? "Scanner over monthly budget. Try again later.",
            );
          }
        }

        const top = res.candidates?.[0] ?? null;
        const conf = top?.confidence ?? 0;
        const matched =
          top != null &&
          conf >= SESSION_RESULT_CONFIDENCE &&
          (top.card_id != null || top.upstream_id != null);
        updateSessionItem(itemId, {
          candidate: matched ? top : null,
          identificationId: matched ? res.identification_id : null,
          confidence: conf,
          status: matched ? "matched" : "missed",
        });
        if (matched) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {},
          );
          flashCue("hit");
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
            () => {},
          );
          flashCue("miss");
        }
      } catch (e) {
        updateSessionItem(itemId, { status: "missed" });
        flashCue("miss");
        showScannerError(e instanceof Error ? e.message : "Identification failed");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [tcgHint, updateSessionItem, flashCue, showScannerError],
  );

  const onCapture = useCallback(
    (e: { nativeEvent: CaptureEvent }) => {
      const { uri, corners, error: captureError } = e.nativeEvent;
      if (captureError || !uri) {
        busyRef.current = false;
        setBusy(false);
        flashCue("miss");
        return;
      }
      const itemId = addSessionItem(uri);
      void runIdentify(uri, corners ?? null, itemId);
    },
    [addSessionItem, runIdentify, flashCue],
  );

  const onDetected = useCallback((e: { nativeEvent: CardDetectedEvent }) => {
    const { detected, steady, fill } = e.nativeEvent;
    setDetect({ detected, steady, fill });
  }, []);

  // ── Session actions ──────────────────────────────────────────────
  const sessionMatches = useMemo(() => {
    const seen = new Set<string>();
    const out: IdentifyCandidate[] = [];
    for (const it of session) {
      if (it.status !== "matched" || !it.candidate) continue;
      const key = candidateKey(it.candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it.candidate);
    }
    return out;
  }, [session]);

  const pickSessionItem = useCallback((item: ScanSessionItem) => {
    const candidate = item.candidate;
    if (!candidate) return;
    Haptics.selectionAsync().catch(() => {});
    if (item.identificationId) {
      submitIdentifyFeedback(item.identificationId, {
        correct: true,
        chosen_card_id: candidate.card_id,
      }).catch(() => {});
    }
    const detailId = candidate.card_id ?? candidate.upstream_id ?? null;
    if (detailId) {
      router.replace(routes.card(detailId));
      return;
    }
    router.replace(
      routes.gradeNew({
        cardName: candidate.name,
        cardImage: candidate.image_url ?? undefined,
        cardSet: candidate.set_name ?? undefined,
      }),
    );
  }, []);

  const handleAddSession = useCallback(async () => {
    if (sessionMatches.length === 0) return;
    if (slotsLeft !== null && slotsLeft === 0) {
      openPaywall("card_limit");
      return;
    }
    setAdding(true);
    const results = await Promise.allSettled(
      sessionMatches.map((c) =>
        createGrade.mutateAsync({
          cardId: c.card_id ?? undefined,
          upstreamId: c.upstream_id ?? undefined,
          grade: BATCH_RAW_GRADE,
          house: "loupe",
          condition: "nm",
        }),
      ),
    );
    setAdding(false);
    const hitCap = results.some(
      (r) =>
        r.status === "rejected" && r.reason instanceof ApiError && r.reason.status === 402,
    );
    if (hitCap) {
      openPaywall("card_limit");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(routes.vault());
  }, [sessionMatches, slotsLeft, openPaywall, createGrade]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          zoomBase.current = zoom;
        })
        .onUpdate((e) => {
          setZoom(Math.max(1, Math.min(5, zoomBase.current * e.scale)));
        })
        .runOnJS(true),
    [zoom],
  );

  // ── Permission gate (parity with the RN flow) ────────────────────
  if (!useNative) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (permission && !permission.granted) {
    const mustOpenSettings = !permission.canAskAgain;
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          backgroundColor: p.bg.base,
          padding: 24,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.12),
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.28),
          }}
        >
          {mustOpenSettings ? (
            <CameraOff size={36} color={p.accent.mint} strokeWidth={1.8} />
          ) : (
            <Camera size={36} color={p.accent.mint} strokeWidth={1.8} />
          )}
        </View>
        <Text
          style={{
            marginTop: 20,
            color: p.ink.default,
            fontSize: 22,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          {mustOpenSettings ? "Turn on camera access" : "Let Loupe see your cards"}
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: p.ink.muted,
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          {mustOpenSettings
            ? "Camera access is off. Open Settings → Loupe → Camera to switch it on, then come back."
            : "Point your camera at a card and Loupe identifies it instantly — set, number, and live price."}
        </Text>
        <View style={{ height: 28 }} />
        <View style={{ alignSelf: "stretch", maxWidth: 360, width: "100%", gap: 12 }}>
          <PrimaryButton
            label={mustOpenSettings ? "Open Settings" : "Allow camera"}
            icon={Camera}
            variant="mint"
            onPress={async () => {
              if (mustOpenSettings) {
                Linking.openSettings().catch(() => {});
                return;
              }
              await requestPermission();
            }}
          />
          <PrimaryButton label="Not now" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  // Live framing coach — only before the first capture, so it doesn't fight
  // the session tray. Mirrors the RN flow's "coaching strip until first scan".
  const liveHint = !detectionSupported
    ? "Frame the card, then tap the shutter"
    : !detect.detected
      ? "Point at a card"
      : detect.fill < 0.2
        ? "Move closer"
        : detect.steady
          ? autoCapture
            ? "Hold steady — capturing…"
            : "Ready — tap to capture"
          : "Hold steady";
  const detectorHint = session.length === 0 && !busy ? liveHint : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <GestureDetector gesture={pinch}>
        <LoupeCameraView
          style={StyleSheet.absoluteFill}
          active
          torchEnabled={torch}
          detectionEnabled={!busy}
          autoCapture={autoCapture && !busy && (slotsLeft == null || slotsLeft > 0)}
          zoom={zoom}
          captureRequestId={captureReq}
          onCardDetected={onDetected}
          onCapture={onCapture}
        />
      </GestureDetector>

      {/* Capture flash cue — a quick mint/amber frame pulse on hit/miss. */}
      {flash !== "none" ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            borderWidth: 4,
            borderColor:
              flash === "hit"
                ? withAlpha(p.accent.mint, 0.9)
                : withAlpha(p.accent.amber, 0.9),
          }}
        />
      ) : null}

      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ ...StyleSheet.absoluteFillObject, justifyContent: "space-between" }}
        pointerEvents="box-none"
      >
        <ScannerTopBar
          onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          flashOn={torch}
          locked={false}
          hasMatch={false}
          scanning={busy}
          onToggleFlash={() => setTorch((v) => !v)}
          tcgHint={tcgHint}
          onOpenTcgPicker={() => setTcgPickerOpen(true)}
          palette={p}
          leadingExtra={
            detectionSupported ? (
              <AutoToggle
                on={autoCapture}
                mint={p.accent.mint}
                onPress={() => setAutoCapture((v) => !v)}
              />
            ) : undefined
          }
        />

        {/* Zoom presets — native 1×/2×/3× (pinch covers everything between). */}
        <View
          pointerEvents="box-none"
          style={{ alignItems: "center", justifyContent: "center", flex: 1 }}
        >
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", bottom: 8, flexDirection: "row", gap: 10 }}
          >
            {[1, 2, 3].map((z) => {
              const on = Math.round(zoom) === z;
              return (
                <Pressable
                  key={z}
                  onPress={() => setZoom(z)}
                  accessibilityRole="button"
                  accessibilityLabel={`Zoom ${z}x`}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    minWidth: on ? 44 : 34,
                    height: 34,
                    paddingHorizontal: on ? 12 : 0,
                    borderRadius: 999,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? p.accent.mint : GLASS,
                    borderWidth: on ? 0 : 1,
                    borderColor: HAIRLINE,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  {!on ? (
                    <BlurView
                      intensity={BLUR_INTENSITY}
                      tint="dark"
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : null}
                  <Text
                    style={{
                      color: on ? "#06140d" : "rgba(255,255,255,0.88)",
                      fontSize: on ? 13 : 11.5,
                      fontWeight: "800",
                    }}
                  >
                    {z}×
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScannerBottomPanel
          error={error}
          detectorHint={detectorHint}
          tcgHint={tcgHint}
          tcgPickerOpen={tcgPickerOpen}
          onCloseTcgPicker={() => setTcgPickerOpen(false)}
          onPickTcg={(t) => {
            setTcgHint(t);
            setTcgPickerOpen(false);
            setError(null);
          }}
          scanSession={session}
          sessionMatchCount={sessionMatches.length}
          batchEnabled
          slotsLeft={slotsLeft}
          onPickScanSessionItem={pickSessionItem}
          onRemoveScanSessionItem={removeSessionItem}
          onAddSession={() => {
            void handleAddSession();
          }}
          onDismissError={() => setError(null)}
          onManualCapture={triggerCapture}
          onManualSearch={() => router.replace("/search")}
          scanning={busy}
          locked={false}
          formatUsd={formatUsd}
          palette={p}
        />
      </SafeAreaView>

      {adding ? (
        <View
          pointerEvents="auto"
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : null}
    </View>
  );
}

/** The native-only AUTO-capture toggle, slotted into the top bar. */
function AutoToggle({
  on,
  mint,
  onPress,
}: {
  on: boolean;
  mint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Toggle auto capture"
      accessibilityState={{ selected: on }}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        height: 46,
        borderRadius: 23,
        overflow: "hidden",
        backgroundColor: on ? mint : GLASS,
        borderWidth: on ? 0 : StyleSheet.hairlineWidth * 2,
        borderColor: HAIRLINE,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {!on ? (
        <BlurView
          intensity={BLUR_INTENSITY}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <Wand2 size={15} color={on ? "#06140d" : "#fff"} strokeWidth={2.4} />
      <Text
        style={{
          color: on ? "#06140d" : "#fff",
          fontSize: 11.5,
          fontWeight: "800",
          letterSpacing: 0.5,
        }}
      >
        AUTO
      </Text>
    </Pressable>
  );
}
