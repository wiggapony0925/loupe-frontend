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
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCameraPermissions } from "expo-camera";
import { Camera, CameraOff } from "lucide-react-native";
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
import { lookupCardByHash, rememberCardHash } from "@/infrastructure/cache/cardHashCache";
import { ApiError } from "@/infrastructure/http/client";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { usePro } from "@/presentation/features/pro";
import { useCreateGrade } from "@/application/queries/collection/useGradeMutations";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCompactUsd } from "@/shared/format";
import { routes } from "@/shared/routes";
import {
  candidateKey,
  scannerErrorCopy,
  ERROR_DISMISS_MS,
  LOCK_CONFIDENCE,
  SESSION_RESULT_CONFIDENCE,
  type ScanSessionItem,
} from "@/presentation/features/scan/overlay";
import { useScanSession } from "@/application/stores/scanSessionStore";
import {
  LoupeCameraView,
  isNativeCameraAvailable,
  type CaptureEvent,
  type CardDetectedEvent,
  type ScannerOverlayState,
} from "../../modules/loupe-scanner-bridge";

/** Live native-detector signal (iOS only today). */
type Detect = { detected: boolean; steady: boolean; fill: number };

/** RAW grade stamped on a batch-added card — Near Mint ≈ 9 (see identify.tsx). */
const BATCH_RAW_GRADE = 9;

/** TCG hint → the label + accent the native overlay shows. */
const TCG_META: Record<string, { label: string; hex: string }> = {
  auto: { label: "Auto-detect", hex: "#16C09C" },
  pokemon: { label: "Pokémon", hex: "#F0B429" },
  magic: { label: "Magic", hex: "#3B82F6" },
  yugioh: { label: "Yu-Gi-Oh!", hex: "#8B5CF6" },
};

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

  // ── Identify / session ───────────────────────────────────────────
  // `capturing` = the brief camera encode window (gates re-triggering a
  // capture + auto-capture). `busy` = ≥1 identify in flight (drives the
  // "Identifying…" chrome). Identifies run in PARALLEL — the camera is
  // released the instant a frame is ours, so a stack scans without waiting
  // on each network round-trip (mirrors LiveIdentifyFlow).
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  // After a miss, auto-capture pauses briefly so it stops machine-gunning a
  // frame it can't read — the user gets a beat to re-frame.
  const [autoPaused, setAutoPaused] = useState(false);
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The scan session (tray) lives in a PERSISTED store, not local state, so
  // leaving the scanner and coming back lands the user right where they were.
  const session = useScanSession((s) => s.items);
  const tcgHint = useScanSession((s) => s.tcgHint);
  const setTcgHint = useScanSession((s) => s.setTcgHint);
  const addSessionItem = useScanSession((s) => s.add);
  const updateSessionItem = useScanSession((s) => s.patch);
  const removeSessionItemRaw = useScanSession((s) => s.remove);
  const clearSession = useScanSession((s) => s.clear);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"none" | "hit" | "miss">("none");
  const [adding, setAdding] = useState(false);
  const captureBusyRef = useRef(false);
  const activeIdentifyCountRef = useRef(0);
  // Hashes currently being identified over the network — so auto-capture
  // firing repeatedly at the SAME steady card doesn't queue duplicate calls.
  const inFlightHashesRef = useRef<Set<string>>(new Set());
  // Key of the most recently matched card — so holding one card steady under
  // auto-capture doesn't keep re-adding the SAME card as a fresh tile.
  const lastMatchedKeyRef = useRef<string | null>(null);
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
      if (autoPauseTimerRef.current) clearTimeout(autoPauseTimerRef.current);
    },
    [],
  );

  // Remaining free-tier vault slots (null = uncapped / Pro).
  const slotsLeft =
    gatingActive && cardLimit != null ? Math.max(0, cardLimit - cardCount) : null;

  // Tap the ✕ on a tile → drop it from the persisted session.
  const removeSessionItem = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      removeSessionItemRaw(id);
    },
    [removeSessionItemRaw],
  );

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

  // A miss keeps its captured photo in the tray (Collectr-style) — the tile
  // stays so the user can tap it to search or swipe it away; it does NOT
  // vanish. We just pause auto-capture briefly so it doesn't machine-gun the
  // same unreadable frame.
  const handleMiss = useCallback(() => {
    flashCue("miss");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setAutoPaused(true);
    if (autoPauseTimerRef.current) clearTimeout(autoPauseTimerRef.current);
    autoPauseTimerRef.current = setTimeout(() => setAutoPaused(false), 2500);
  }, [flashCue]);

  // ── Capture → identify ───────────────────────────────────────────
  // The shutter/auto-capture only gates on the encode window (captureBusyRef),
  // NOT on the identify — so you can keep capturing while results resolve.
  const triggerCapture = useCallback(() => {
    if (captureBusyRef.current) return;
    captureBusyRef.current = true;
    setCapturing(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCaptureReq(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  // The network identify — runs in parallel (one per captured frame). On a
  // confident match we remember the frame's pHash so the NEXT frame of the
  // same card resolves instantly from the on-device cache (no network).
  const runIdentify = useCallback(
    async (uploadUri: string, hash: string | null, itemId: string) => {
      activeIdentifyCountRef.current += 1;
      setBusy(true);
      try {
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
        if (matched && top) {
          lastMatchedKeyRef.current = candidateKey(top);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {},
          );
          flashCue("hit");
          // Cache high-confidence answers so repeat frames short-circuit.
          if (hash && conf >= LOCK_CONFIDENCE) {
            rememberCardHash(hash, top, conf).catch(() => {});
          }
        } else {
          handleMiss();
        }
      } catch (e) {
        updateSessionItem(itemId, { status: "missed" });
        handleMiss();
        showScannerError(e instanceof Error ? e.message : "Identification failed");
      } finally {
        if (hash) inFlightHashesRef.current.delete(hash);
        activeIdentifyCountRef.current = Math.max(0, activeIdentifyCountRef.current - 1);
        if (activeIdentifyCountRef.current === 0) setBusy(false);
      }
    },
    [tcgHint, updateSessionItem, flashCue, handleMiss, showScannerError],
  );

  // A captured frame → crop → pHash. The cache short-circuit is the big
  // latency win: a card we've already seen resolves with ZERO network. Only
  // on a cache miss do we upload the small crop for a live identify.
  const processCapture = useCallback(
    async (uri: string, corners: number[] | null) => {
      // Deskew/crop to the small (~30KB, 720px) upload the server expects.
      let uploadUri = uri;
      let cropUri: string | null = null;
      if (corners && corners.length === 8 && cardDetector.capabilities.crop) {
        try {
          const cropped = await cardDetector.crop(uri, corners, 720, 0.7);
          if (cropped?.uri) {
            uploadUri = cropped.uri;
            cropUri = cropped.uri;
          }
        } catch {
          /* fall back to the full frame */
        }
      }

      // On-device pHash cache short-circuit.
      let hash: string | null = null;
      if (cardDetector.capabilities.hash) {
        try {
          hash = await cardDetector.hash(cropUri ?? uploadUri);
        } catch {
          hash = null;
        }
        if (hash) {
          // Same card already being identified (auto-capture re-firing) → drop.
          if (inFlightHashesRef.current.has(hash)) return;
          const cached = await lookupCardByHash(hash);
          if (cached) {
            const cand: IdentifyCandidate = {
              ...cached.candidate,
              confidence: Math.max(cached.candidate.confidence, cached.confidence),
              source: "phash",
            };
            rememberCardHash(hash, cand, cand.confidence).catch(() => {}); // bump LRU
            // Still holding the card that just matched → don't spam a duplicate.
            if (candidateKey(cand) === lastMatchedKeyRef.current) return;
            lastMatchedKeyRef.current = candidateKey(cand);
            addSessionItem(cropUri ?? uri, { candidate: cand, confidence: cand.confidence });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => {},
            );
            flashCue("hit");
            return;
          }
        }
      }

      const itemId = addSessionItem(cropUri ?? uri);
      if (hash) inFlightHashesRef.current.add(hash);
      void runIdentify(uploadUri, hash, itemId);
    },
    [addSessionItem, runIdentify, flashCue],
  );

  const onCapture = useCallback(
    (e: { nativeEvent: CaptureEvent }) => {
      // Release the camera lock the instant the frame is ours — the crop +
      // identify below run off the capture path so the next frame can start.
      captureBusyRef.current = false;
      setCapturing(false);
      const { uri, corners, error: captureError } = e.nativeEvent;
      if (captureError || !uri) {
        flashCue("miss");
        return;
      }
      void processCapture(uri, corners ?? null);
    },
    [processCapture, flashCue],
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
    // Batch is banked — start the next session fresh.
    clearSession();
    router.replace(routes.vault());
  }, [sessionMatches, slotsLeft, openPaywall, createGrade, clearSession]);

  // Running session total from the server-priced matched candidates.
  const total = useMemo(
    () =>
      session.reduce(
        (s, it) =>
          s + (it.status === "matched" ? it.candidate?.market_price_usd ?? 0 : 0),
        0,
      ),
    [session],
  );

  // Everything the native SwiftUI overlay renders — one state record pushed
  // down each render. The live framing coach shows only before the first
  // capture so it doesn't fight the tray.
  const overlayState = useMemo<ScannerOverlayState>(() => {
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
    const meta = TCG_META[tcgHint ?? "auto"] ?? TCG_META.auto!;
    return {
      statusText: busy ? "Identifying…" : "Frame a card · tap the shutter",
      hintText: session.length === 0 && !busy ? liveHint : null,
      errorText: error,
      tcgLabel: meta.label,
      tcgAccentHex: meta.hex,
      torchOn: torch,
      autoOn: autoCapture,
      autoSupported: detectionSupported,
      zoom,
      slotsLeft: slotsLeft ?? -1,
      busy,
      matchedCount: sessionMatches.length,
      totalText: total > 0 ? formatUsd(total) : null,
      canAddAll: sessionMatches.length > 0,
      items: session.map((it) => {
        const matched = it.status === "matched" && it.candidate != null;
        const missed = it.status === "missed";
        const price = matched ? it.candidate?.market_price_usd ?? null : null;
        const copies = matched ? it.candidate?.copies_owned ?? 0 : 0;
        const slabs = matched ? it.candidate?.graded_copies ?? 0 : 0;
        const conf = it.confidence != null ? Math.round(it.confidence * 100) : null;
        const num = matched ? it.candidate?.number ?? null : null;
        const subtitle = matched
          ? [
              num ? `#${num}` : null,
              price != null ? formatUsd(price) : `${conf ?? 0}% match`,
              copies > 0 ? `Own ×${copies}${slabs > 0 ? ` (${slabs} graded)` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : missed
            ? "No match · tap to search"
            : "Reading…";
        return {
          id: it.id,
          imageUrl: matched ? it.candidate?.image_url ?? null : null,
          photoUri: it.photoUri,
          title: matched
            ? it.candidate?.name ?? "Matched card"
            : missed
              ? "Couldn’t read this card"
              : "Identifying…",
          subtitle,
          status: it.status,
        };
      }),
    };
  }, [
    busy,
    detect,
    detectionSupported,
    autoCapture,
    tcgHint,
    error,
    torch,
    zoom,
    slotsLeft,
    sessionMatches.length,
    total,
    session,
    formatUsd,
  ]);

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

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <LoupeCameraView
        style={StyleSheet.absoluteFill}
        active
        torchEnabled={torch}
        detectionEnabled={!capturing}
        autoCapture={
          autoCapture && !capturing && !autoPaused && (slotsLeft == null || slotsLeft > 0)
        }
        zoom={zoom}
        captureRequestId={captureReq}
        overlayStateJson={JSON.stringify(overlayState)}
        onCardDetected={onDetected}
        onCapture={onCapture}
        onOverlayClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onShutter={triggerCapture}
        onToggleTorch={() => setTorch((v) => !v)}
        onToggleAuto={() => setAutoCapture((v) => !v)}
        onZoomChange={(e) => setZoom(e.nativeEvent.zoom)}
        onManualSearch={() => router.replace("/search")}
        onDismissError={() => setError(null)}
        onPickTcg={(e) => {
          const t = e.nativeEvent.tcg;
          setTcgHint(t === "auto" ? null : (t as IdentifyTcgHint));
          setError(null);
        }}
        onPickCard={(e) => {
          const item = session.find((it) => it.id === e.nativeEvent.id);
          if (item) pickSessionItem(item);
        }}
        onRemoveCard={(e) => removeSessionItem(e.nativeEvent.id)}
        onAddAll={() => {
          void handleAddSession();
        }}
      />

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
