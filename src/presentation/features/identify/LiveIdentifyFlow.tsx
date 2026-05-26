/**
 * Live card-identification viewfinder — the PriceCharting-style scan flow.
 *
 * Mounts a full-screen `expo-camera` preview with corner-bracket reticle.
 * While the user holds the phone over a card, a debounced loop snaps a
 * low-res frame every ~1.4s and POSTs it to `/v1/cards/identify`. The
 * top candidates stream into a horizontal carousel pinned to the bottom
 * of the camera surface, with a "Hold Steady…" pulse while in flight
 * and a haptic success tick the first time a high-confidence match
 * lands.
 *
 * Why this shape (vs the 4-shot Studio flow):
 *   • Studio = "grade this and bank it" — needs photometric frames,
 *     OCR is a side-effect.
 *   • Identify = "what IS this?" — single best-frame OCR + catalog
 *     re-rank, results stream in continuously like Google Lens. The
 *     UX has to feel alive; a static shutter would break the illusion
 *     of recognition.
 *
 * Feedback is opportunistic: when the user taps a candidate to confirm
 * we post `correct=true` so the backend can build a per-title popularity
 * prior. Closing without picking is silent (no negative signal — they
 * might have just abandoned).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  type GestureResponderEvent,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Pause,
  Play,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";

import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { useCompactUsd } from "@/shared/format";
import {
  identifyCard,
  identifyCardFromText,
  submitIdentifyFeedback,
  type IdentifyCandidate,
  type IdentifyResponse,
  type IdentifyTcgHint,
} from "@/infrastructure/repositories/identifyRepository";
import {
  isOnDeviceOcrAvailable,
  recognizeTextOnDevice,
} from "@/infrastructure/ocr/onDeviceOcr";

const CAPTURE_LONG_EDGE = 1100;
const CAPTURE_QUALITY = 0.5;
/** Min gap between identify calls. Keeps the device cool + bill low. */
const CAPTURE_INTERVAL_MS = 900;
/** Confidence at which we fire the success haptic + freeze the carousel. */
const LOCK_CONFIDENCE = 0.7;
/**
 * Consecutive frames returning zero high-confidence (>=0.5) candidates
 * before we surface the "can't find a match" fallback CTA. Tuned to
 * roughly 4–5 seconds of camera time so we don't flash the empty-state
 * card the instant a user lifts the phone.
 */
const NO_MATCH_THRESHOLD = 4;

/** TCG hints surfaced as a chevron pill in the bottom bar. */
const TCG_OPTIONS: { key: IdentifyTcgHint; label: string }[] = [
  { key: null, label: "Auto-detect" },
  { key: "pokemon", label: "Pokémon" },
  { key: "magic", label: "Magic" },
  { key: "yugioh", label: "Yu-Gi-Oh!" },
];

interface LiveIdentifyFlowProps {
  onClose: () => void;
  /** Called when the user picks a candidate (→ card detail). */
  onConfirm?: (
    candidate: IdentifyCandidate,
    identificationId: string,
  ) => void;
  /**
   * Called when the user taps "Add to vault" on the locked result
   * sheet. Distinct from `onConfirm` (which deep-links into the card
   * detail page) so the host route can fork into the grade/add flow.
   */
  onAddToVault?: (
    candidate: IdentifyCandidate,
    identificationId: string,
  ) => void;
  /**
   * Called when the user taps the "Search manually" escape hatch on the
   * no-match state. Host route should push to the catalog search screen.
   */
  onManualSearch?: () => void;
  /** Initial TCG hint (e.g. when launched from a TCG-filtered search). */
  initialTcg?: IdentifyTcgHint;
}

interface IdentifyState {
  candidates: IdentifyCandidate[];
  identificationId: string | null;
  topConfidence: number;
  primarySource: string | null;
  /** Set true the first time confidence crosses LOCK_CONFIDENCE. */
  locked: boolean;
  /**
   * Count of consecutive identify responses that returned no candidate
   * with confidence >= 0.5. When this crosses NO_MATCH_THRESHOLD the
   * bottom panel swaps the "Reading card…" pulse for an actionable
   * "can't find a match" card with a manual-search escape hatch.
   */
  emptyAttempts: number;
}

const EMPTY_STATE: IdentifyState = {
  candidates: [],
  identificationId: null,
  topConfidence: 0,
  primarySource: null,
  locked: false,
  emptyAttempts: 0,
};

export function LiveIdentifyFlow({
  onClose,
  onConfirm,
  onAddToVault,
  onManualSearch,
  initialTcg = null,
}: LiveIdentifyFlowProps) {
  const p = useThemedPalette();
  const formatUsd = useCompactUsd();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const inflightRef = useRef(false);
  const cancelledRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  // expo-camera on iOS doesn't re-focus when the subject changes. We
  // briefly toggle the `autofocus` prop off→on to force the AF loop
  // to re-run; the tap-to-focus handler in ReticleArea drives this.
  const [autofocusOn, setAutofocusOn] = useState(true);
  const refocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refocus = useCallback(() => {
    if (refocusTimer.current) clearTimeout(refocusTimer.current);
    setAutofocusOn(false);
    refocusTimer.current = setTimeout(() => setAutofocusOn(true), 80);
  }, []);
  useEffect(
    () => () => {
      if (refocusTimer.current) clearTimeout(refocusTimer.current);
    },
    [],
  );
  const [tcgHint, setTcgHint] = useState<IdentifyTcgHint>(initialTcg);
  const [tcgPickerOpen, setTcgPickerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<IdentifyState>(EMPTY_STATE);

  // ─── Capture loop ────────────────────────────────────────────────
  // We deliberately drive the loop from a ref-guarded setTimeout chain
  // instead of setInterval — interval would happily stack calls when a
  // request takes longer than the cadence, melting both phone and
  // backend.
  const captureOnce = useCallback(async () => {
    if (cancelledRef.current || inflightRef.current) return;
    const camera = cameraRef.current;
    if (!camera) return;
    inflightRef.current = true;
    setScanning(true);
    setError(null);
    try {
      // quality=0.5 (vs 1.0) cuts the iOS encode step ~3x without any
      // perceptible loss for OCR \u2014 we resize to 1100px long-edge below
      // anyway, so a higher source quality is wasted bytes and latency.
      const photo = await camera.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        exif: false,
      });
      if (!photo || cancelledRef.current) return;
      const longEdge = Math.max(photo.width, photo.height);
      const scale = longEdge > CAPTURE_LONG_EDGE ? CAPTURE_LONG_EDGE / longEdge : 1;
      const processed =
        scale < 1
          ? await manipulateAsync(
              photo.uri,
              [{ resize: { width: Math.round(photo.width * scale) } }],
              { compress: CAPTURE_QUALITY, format: SaveFormat.JPEG },
            )
          : photo;

      let res: IdentifyResponse = await identifyCard(processed.uri, tcgHint);
      if (cancelledRef.current) return;

      // Server signalled the monthly Vision budget is exhausted. Run
      // OCR on-device (Apple Vision / ML Kit) and resubmit the parsed
      // text to /v1/cards/identify/text. Falls back to the empty
      // response when the native module isn't linked (Expo Go).
      if (res.fallback_required) {
        if (isOnDeviceOcrAvailable()) {
          const ocr = await recognizeTextOnDevice(processed.uri);
          if (cancelledRef.current) return;
          if (ocr.text.length > 0) {
            res = await identifyCardFromText(ocr.text, tcgHint, {
              clientProvider: "mlkit",
              ocrConfidence: ocr.confidence,
            });
            if (cancelledRef.current) return;
          } else {
            setError("On-device OCR found no text. Try better lighting.");
          }
        } else {
          setError(
            res.fallback_reason ??
              "Scanner over monthly budget. Try again later.",
          );
        }
      }
      // Success haptic only when we cross the lock threshold \u2014 the
      // previous per-frame light tick was constant background noise on
      // a loop that fires every ~900ms.
      setState((prev) => {
        const top = res.candidates[0]?.confidence ?? 0;
        const justLocked = !prev.locked && top >= LOCK_CONFIDENCE;
        const hasUsefulMatch = res.candidates.some((c) => c.confidence >= 0.5);
        if (justLocked) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {},
          );
        }
        return {
          candidates: res.candidates,
          identificationId: res.identification_id,
          topConfidence: top,
          primarySource: res.primary_source,
          locked: prev.locked || justLocked,
          emptyAttempts: hasUsefulMatch ? 0 : prev.emptyAttempts + 1,
        };
      });
    } catch (e) {
      if (cancelledRef.current) return;
      const msg = e instanceof Error ? e.message : "Identification failed";
      setError(msg);
    } finally {
      inflightRef.current = false;
      if (!cancelledRef.current) setScanning(false);
    }
  }, [tcgHint]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!permission?.granted || paused || state.locked) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      captureOnce().finally(() => {
        if (cancelledRef.current || paused || state.locked) return;
        timeoutId = setTimeout(tick, CAPTURE_INTERVAL_MS);
      });
    };
    tick();
    return () => {
      cancelledRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [permission?.granted, paused, state.locked, captureOnce]);

  // ─── Actions ─────────────────────────────────────────────────────
  const handlePick = useCallback(
    (candidate: IdentifyCandidate) => {
      const id = state.identificationId;
      Haptics.selectionAsync().catch(() => {});
      if (id) {
        submitIdentifyFeedback(id, {
          correct: true,
          chosen_card_id: candidate.card_id,
        }).catch(() => {
          // Anonymous users hit a 401 — that's fine, swallow it. The
          // identification itself is still recorded.
        });
      }
      onConfirm?.(candidate, id ?? "");
    },
    [state.identificationId, onConfirm],
  );

  const handleRescan = useCallback(() => {
    setState(EMPTY_STATE);
    setError(null);
    setPaused(false);
  }, []);

  const handleAddToVault = useCallback(
    (candidate: IdentifyCandidate) => {
      const id = state.identificationId;
      Haptics.selectionAsync().catch(() => {});
      if (id) {
        submitIdentifyFeedback(id, {
          correct: true,
          chosen_card_id: candidate.card_id,
        }).catch(() => {});
      }
      onAddToVault?.(candidate, id ?? "");
    },
    [state.identificationId, onAddToVault],
  );

  // ─── Live price for the locked candidate ────────────────
  // Once we've locked onto a top candidate with a resolved catalog
  // id, fetch its raw market price so the floating chip + result
  // sheet can show a live number (TCGplayer / PriceCharting style).
  // `useCardMarket` is gated by truthy id, so this stays a no-op for
  // anonymous / unresolved candidates.
  const topCandidate = state.candidates[0] ?? null;
  const lockedCardId = state.locked ? topCandidate?.card_id ?? null : null;
  const market = useCardMarket(lockedCardId ?? undefined);
  const marketPriceUsd = market.data?.snapshot.summary.raw?.amount ?? null;

  // ─── Permission gates ────────────────────────────────────────────
  if (!permission) {
    return <CenterMessage label="Initializing camera…" />;
  }
  if (!permission.granted) {
    // If iOS/Android has revoked the "ask again" right (user previously
    // hit Deny, or Simulator was reset), calling requestPermission()
    // silently no-ops — the OS prompt never appears. We need to send
    // them to Settings instead. The button label flips so they know
    // what tap does.
    const mustOpenSettings = !permission.canAskAgain;
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: p.bg.base, padding: 24, justifyContent: "center" }}
      >
        <Text className="text-2xl font-semibold text-ink">Camera access</Text>
        <Text className="mt-2 text-sm text-ink-muted">
          {mustOpenSettings
            ? "Camera access was denied. Open Settings → Loupe and enable Camera, then come back."
            : "Loupe needs the camera to identify cards. Grant access to continue."}
        </Text>
        <View style={{ height: 24 }} />
        <PrimaryButton
          label={mustOpenSettings ? "Open Settings" : "Allow camera"}
          onPress={async () => {
            if (mustOpenSettings) {
              Linking.openSettings().catch(() => {});
              return;
            }
            const next = await requestPermission();
            // If the OS still won't ask (user denied in the dialog),
            // bounce them to Settings on the next tap.
            if (!next.granted && !next.canAskAgain) {
              Linking.openSettings().catch(() => {});
            }
          }}
        />
        <View style={{ height: 12 }} />
        <PrimaryButton label="Close" variant="ghost" onPress={onClose} />
      </SafeAreaView>
    );
  }

  // ─── Main view ───────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        flash={flashOn ? "on" : "off"}
        autofocus={autofocusOn ? "on" : "off"}
      >
        <SafeAreaView style={{ flex: 1, justifyContent: "space-between" }}>
          <TopBar
            onClose={onClose}
            flashOn={flashOn}
            paused={paused}
            onToggleFlash={() => setFlashOn((v) => !v)}
            onTogglePause={() => setPaused((v) => !v)}
          />

          <ReticleArea
            scanning={scanning && !paused}
            locked={state.locked}
            hasMatch={state.candidates.some((c) => c.confidence >= 0.5)}
            paused={paused}
            marketPriceUsd={marketPriceUsd}
            formatUsd={formatUsd}
            priceLoading={state.locked && !!lockedCardId && market.isLoading}
            onTapFocus={refocus}
          />

          <BottomPanel
            state={state}
            error={error}
            tcgHint={tcgHint}
            tcgPickerOpen={tcgPickerOpen}
            onOpenTcgPicker={() => setTcgPickerOpen((v) => !v)}
            onPickTcg={(t) => {
              setTcgHint(t);
              setTcgPickerOpen(false);
            }}
            onPickCandidate={handlePick}
            onAddToVault={handleAddToVault}
            onRescan={handleRescan}
            onManualCapture={captureOnce}
            onManualSearch={onManualSearch}
            scanning={scanning}
            marketPriceUsd={marketPriceUsd}
            priceLoading={state.locked && !!lockedCardId && market.isLoading}
            formatUsd={formatUsd}
            palette={p}
          />
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

// ────────────────────────── Subviews ──────────────────────────

function TopBar({
  onClose,
  flashOn,
  paused,
  onToggleFlash,
  onTogglePause,
}: {
  onClose: () => void;
  flashOn: boolean;
  paused: boolean;
  onToggleFlash: () => void;
  onTogglePause: () => void;
}) {
  return (
    <LinearGradient
      colors={["rgba(0,0,0,0.78)", "transparent"]}
      style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 22 }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Close scanner"
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
        >
          <X size={18} color="#fff" />
        </Pressable>

        <Text
          style={{
            color: "#fff",
            fontSize: 15,
            fontWeight: "700",
            letterSpacing: -0.2,
          }}
        >
          Scan a card
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onTogglePause}
            hitSlop={10}
            accessibilityLabel={paused ? "Resume scanning" : "Pause scanning"}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: paused
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.14)",
            }}
          >
            {paused ? (
              <Play size={16} color="#000" />
            ) : (
              <Pause size={16} color="#fff" />
            )}
          </Pressable>
          <Pressable
            onPress={onToggleFlash}
            hitSlop={10}
            accessibilityLabel={flashOn ? "Turn flash off" : "Turn flash on"}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: flashOn
                ? palette.accent.amber
                : "rgba(255,255,255,0.14)",
            }}
          >
            {flashOn ? (
              <Zap size={16} color="#000" />
            ) : (
              <ZapOff size={16} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

function ReticleArea({
  scanning,
  locked,
  hasMatch,
  paused,
  marketPriceUsd,
  priceLoading,
  formatUsd,
  onTapFocus,
}: {
  scanning: boolean;
  locked: boolean;
  hasMatch: boolean;
  paused: boolean;
  marketPriceUsd: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  onTapFocus: (point: { x: number; y: number }) => void;
}) {
  const pulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (!scanning) {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scanning, pulse]);

  // Reticle hugs roughly the trading-card aspect of 2.5:3.5. The
  // tint reacts to detection so the user gets feedback even before we
  // commit to a lock: dim mint while hunting, bright mint the moment
  // we have a candidate ≥ 0.5, locked-mint when we commit.
  const tint = locked
    ? palette.accent.mint
    : hasMatch
      ? palette.accent.mint
      : withAlpha(palette.accent.mint, 0.55);

  // Subtle breathing scale so the frame feels alive even before we
  // have a lock (we don't have native edge-detection yet — this is
  // pure perceptual feedback that the camera is doing something).
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (locked) {
      Animated.spring(breathe, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 8,
      }).start();
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.015,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [locked, breathe]);

  // Tap-to-focus ripple. expo-camera on iOS does not refocus when the
  // subject changes — we hand the tap coordinate to the parent which
  // toggles the `autofocus` prop to force a refocus pass.
  const [focusRing, setFocusRing] = useState<{ x: number; y: number; key: number } | null>(null);
  const focusRingAnim = useRef(new Animated.Value(0)).current;
  const handleTap = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const key = Date.now();
      setFocusRing({ x: locationX, y: locationY, key });
      onTapFocus({ x: locationX, y: locationY });
      focusRingAnim.setValue(0);
      Animated.timing(focusRingAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setFocusRing((f) => (f && f.key === key ? null : f)));
    },
    [onTapFocus, focusRingAnim],
  );

  return (
    <Pressable
      onPress={handleTap}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          width: "72%",
          aspectRatio: 2.5 / 3.5,
          transform: [{ scale: breathe }],
        }}
      >
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <CornerBracket key={c} corner={c} color={tint} bold={hasMatch || locked} />
        ))}

        {/* Floating price chip — TCGplayer / Collectr style. Hovers
            just above the top edge of the card once we've locked on
            and the market endpoint has returned a raw price. Shows a
            quiet "Pricing…" pulse while the request is in flight. */}
        {locked && (priceLoading || marketPriceUsd != null) ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -46,
              alignItems: "center",
            }}
          >
            <View
              style={{
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: "#fff",
                shadowColor: "#000",
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {marketPriceUsd != null ? (
                <>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: palette.accent.mint,
                    }}
                  />
                  <Text
                    style={{
                      color: "#0B0B0D",
                      fontWeight: "800",
                      fontSize: 17,
                      letterSpacing: -0.3,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatUsd(marketPriceUsd)}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(0,0,0,0.45)",
                      fontSize: 10,
                      fontWeight: "700",
                      letterSpacing: 1.2,
                      marginLeft: 2,
                    }}
                  >
                    RAW
                  </Text>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color="#0B0B0D" />
                  <Text
                    style={{
                      color: "rgba(0,0,0,0.55)",
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1.2,
                    }}
                  >
                    PRICING…
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : null}

        {/* Subtle scan beam — only while hunting. Replaces the old
            "Hold Steady" pill (which duplicated the bottom status). */}
        {scanning && !locked && !paused && !hasMatch ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              top: "50%",
              height: 2,
              borderRadius: 2,
              backgroundColor: withAlpha(palette.accent.mint, 0.7),
              opacity: pulse,
            }}
          />
        ) : null}
      </Animated.View>

      {/* Tap-to-focus ring. */}
      {focusRing ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: focusRing.x - 32,
            top: focusRing.y - 32,
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 1.5,
            borderColor: palette.accent.amber,
            opacity: focusRingAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              {
                scale: focusRingAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.3, 0.85],
                }),
              },
            ],
          }}
        />
      ) : null}
    </Pressable>
  );
}

function CornerBracket({
  corner,
  color,
  bold,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  color: string;
  bold?: boolean;
}) {
  const SIZE = bold ? 32 : 26;
  const THICK = bold ? 5 : 4;
  const base = { position: "absolute" as const, width: SIZE, height: SIZE };
  const horiz = { position: "absolute" as const, height: THICK, width: SIZE, backgroundColor: color };
  const vert = { position: "absolute" as const, width: THICK, height: SIZE, backgroundColor: color };
  switch (corner) {
    case "tl":
      return (
        <View style={{ ...base, top: -2, left: -2 }}>
          <View style={{ ...horiz, top: 0, left: 0 }} />
          <View style={{ ...vert, top: 0, left: 0 }} />
        </View>
      );
    case "tr":
      return (
        <View style={{ ...base, top: -2, right: -2 }}>
          <View style={{ ...horiz, top: 0, right: 0 }} />
          <View style={{ ...vert, top: 0, right: 0 }} />
        </View>
      );
    case "bl":
      return (
        <View style={{ ...base, bottom: -2, left: -2 }}>
          <View style={{ ...horiz, bottom: 0, left: 0 }} />
          <View style={{ ...vert, bottom: 0, left: 0 }} />
        </View>
      );
    case "br":
      return (
        <View style={{ ...base, bottom: -2, right: -2 }}>
          <View style={{ ...horiz, bottom: 0, right: 0 }} />
          <View style={{ ...vert, bottom: 0, right: 0 }} />
        </View>
      );
  }
}

function BottomPanel({
  state,
  error,
  tcgHint,
  tcgPickerOpen,
  onOpenTcgPicker,
  onPickTcg,
  onPickCandidate,
  onAddToVault,
  onRescan,
  onManualCapture,
  onManualSearch,
  scanning,
  marketPriceUsd,
  priceLoading,
  formatUsd,
  palette: themed,
}: {
  state: IdentifyState;
  error: string | null;
  tcgHint: IdentifyTcgHint;
  tcgPickerOpen: boolean;
  onOpenTcgPicker: () => void;
  onPickTcg: (t: IdentifyTcgHint) => void;
  onPickCandidate: (c: IdentifyCandidate) => void;
  onAddToVault: (c: IdentifyCandidate) => void;
  onRescan: () => void;
  onManualCapture: () => void;
  onManualSearch?: () => void;
  scanning: boolean;
  marketPriceUsd: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const tcgLabel = useMemo(
    () => TCG_OPTIONS.find((o) => o.key === tcgHint)?.label ?? "Auto-detect",
    [tcgHint],
  );

  return (
    <LinearGradient
      colors={["transparent", "rgba(0,0,0,0.92)"]}
      style={{ paddingHorizontal: 14, paddingBottom: 8, paddingTop: 14, gap: 10 }}
    >
      {tcgPickerOpen ? (
        <View
          style={{
            backgroundColor: "rgba(20,20,22,0.96)",
            borderRadius: 14,
            paddingVertical: 6,
            marginBottom: 4,
          }}
        >
          {TCG_OPTIONS.map((o) => (
            <Pressable
              key={String(o.key)}
              onPress={() => onPickTcg(o.key)}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 16,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  color: o.key === tcgHint ? palette.accent.mint : "#fff",
                  fontWeight: o.key === tcgHint ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {state.locked && state.candidates[0] ? (
        <LockedResultSheet
          candidate={state.candidates[0]}
          confidence={state.topConfidence}
          marketPriceUsd={marketPriceUsd}
          priceLoading={priceLoading}
          formatUsd={formatUsd}
          themed={themed}
          onViewDetails={() => {
            const c = state.candidates[0];
            if (c) onPickCandidate(c);
          }}
          onAddToVault={() => {
            const c = state.candidates[0];
            if (c) onAddToVault(c);
          }}
          onRescan={onRescan}
        />
      ) : (
        <ResultArea
          state={state}
          error={error}
          scanning={scanning}
          onPickCandidate={onPickCandidate}
          onRescan={onRescan}
          onManualSearch={onManualSearch}
        />
      )}

      <View
        className="flex-row items-center justify-between"
        style={{ paddingHorizontal: 6, paddingTop: 6 }}
      >
        {/* TCG selector pill */}
        <Pressable
          onPress={onOpenTcgPicker}
          accessibilityRole="button"
          accessibilityLabel="Change TCG hint"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.95)",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#000", fontWeight: "700", fontSize: 13 }}>{tcgLabel}</Text>
          <ChevronDown size={14} color="#000" />
        </Pressable>

        {/* Manual shutter — always usable as an override for the auto loop. */}
        <Pressable
          onPress={onManualCapture}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Capture frame now"
          style={({ pressed }) => ({
            width: 66,
            height: 66,
            borderRadius: 33,
            borderWidth: 4,
            borderColor: "rgba(255,255,255,0.95)",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" }} />
        </Pressable>

        {/* Manual search escape hatch — replaces the inert search/barcode
            segmented control. When no match arrives the user can jump
            straight to the catalog search screen. */}
        <Pressable
          onPress={onManualSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Search the catalog manually"
          disabled={!onManualSearch}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.14)",
            opacity: pressed ? 0.7 : onManualSearch ? 1 : 0.4,
          })}
        >
          <Search size={15} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Search</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

/**
 * Bottom card that swaps between four states while the loop is hunting:
 *
 *   • error          — last identify call threw
 *   • no-match       — `emptyAttempts >= NO_MATCH_THRESHOLD` → show a
 *                      manual-search escape hatch
 *   • reading        — scanning, no useful candidates yet
 *   • preview-match  — at least one >= 0.5 candidate, not yet locked.
 *                      Shows the top candidate as a single Collectr-style
 *                      card with a "Tap to confirm" CTA and a chevron
 *                      to alt matches.
 */
function ResultArea({
  state,
  error,
  scanning,
  onPickCandidate,
  onRescan,
  onManualSearch,
}: {
  state: IdentifyState;
  error: string | null;
  scanning: boolean;
  onPickCandidate: (c: IdentifyCandidate) => void;
  onRescan: () => void;
  onManualSearch?: () => void;
}) {
  if (error) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 16,
          backgroundColor: withAlpha(palette.accent.rose, 0.16),
          borderWidth: 1,
          borderColor: withAlpha(palette.accent.rose, 0.4),
        }}
      >
        <Text style={{ color: "#fff", fontSize: 12, flex: 1, fontWeight: "600" }}>
          {error}
        </Text>
        <Pressable onPress={onRescan} hitSlop={8}>
          <Text
            style={{
              color: palette.accent.mint,
              fontWeight: "800",
              fontSize: 12,
            }}
          >
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  const visible = state.candidates.filter((c) => c.confidence >= 0.5);
  const top = visible[0];
  const alts = visible.length - 1;

  if (!top) {
    // No useful candidates yet. Show the no-match escape hatch once
    // we've burned NO_MATCH_THRESHOLD frames on nothing; otherwise a
    // quiet "reading" pulse so the camera surface stays focused.
    if (state.emptyAttempts >= NO_MATCH_THRESHOLD) {
      return <NoMatchCard onManualSearch={onManualSearch} onRescan={onRescan} />;
    }
    if (!scanning && state.emptyAttempts === 0) {
      // Permission granted but we haven't fired our first request yet.
      return <HintPill label="Center the card in the frame" />;
    }
    return <HintPill label="Reading card…" pulse />;
  }

  return (
    <PreviewMatchCard candidate={top} alts={alts} onConfirm={() => onPickCandidate(top)} />
  );
}

function HintPill({ label, pulse = false }: { label: string; pulse?: boolean }) {
  return (
    <View
      style={{
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
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
 * The Collectr-style preview card. Single result, big thumbnail on the
 * left, name + set + confidence on the right. Tap anywhere on the card
 * to confirm and open card detail. A chevron in the corner hints that
 * more matches exist; the user can also keep moving the camera and the
 * card will update live as confidence climbs.
 */
function PreviewMatchCard({
  candidate,
  alts,
  onConfirm,
}: {
  candidate: IdentifyCandidate;
  alts: number;
  onConfirm: () => void;
}) {
  const confidencePct = Math.round(candidate.confidence * 100);
  const setMeta = [candidate.set_name, candidate.number ? `#${candidate.number}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={onConfirm}
      accessibilityRole="button"
      accessibilityLabel={`Tap to confirm match: ${candidate.name}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 18,
        backgroundColor: "rgba(15,15,17,0.94)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 54,
          aspectRatio: 2.5 / 3.5,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        {candidate.image_url ? (
          <Image
            source={{ uri: candidate.image_url }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color={withAlpha("#fff", 0.4)} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: palette.accent.mint,
            }}
          />
          <Text
            style={{
              color: palette.accent.mint,
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 1.3,
            }}
          >
            {confidencePct}% MATCH · TAP TO CONFIRM
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }}
        >
          {candidate.name}
        </Text>
        {setMeta ? (
          <Text
            numberOfLines={1}
            style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "500" }}
          >
            {setMeta}
          </Text>
        ) : null}
        {alts > 0 ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
            }}
          >
            +{alts} other match{alts === 1 ? "" : "es"}
          </Text>
        ) : null}
      </View>

      <ChevronRight size={18} color="rgba(255,255,255,0.55)" />
    </Pressable>
  );
}

function NoMatchCard({
  onManualSearch,
  onRescan,
}: {
  onManualSearch?: () => void;
  onRescan: () => void;
}) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: "rgba(15,15,17,0.94)",
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.amber, 0.35),
        gap: 10,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
        Can't read this one
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 17 }}>
        Try moving closer, flattening the card against a dark surface, or turning
        on the flash. If you already know what it is, search the catalog by name.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
        {onManualSearch ? (
          <Pressable
            onPress={onManualSearch}
            accessibilityRole="button"
            accessibilityLabel="Search the catalog manually"
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: palette.accent.mint,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Search size={14} color="#08110D" />
            <Text style={{ color: "#08110D", fontWeight: "800", fontSize: 13 }}>
              Search catalog
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onRescan}
          accessibilityRole="button"
          accessibilityLabel="Reset and try scanning again"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <RotateCcw size={13} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CenterMessage({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
      <ActivityIndicator color="#fff" />
      <Text style={{ color: "#fff", marginTop: 12, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

// ─────────────── Locked-state hero result sheet ───────────────
// Once auto-capture locks on a high-confidence match we trade the
// thin candidate strip for a full-width "matched card" sheet, à la
// TCGplayer / Collectr: card thumbnail on the left, name + set +
// market price on the right, three CTAs underneath.

function LockedResultSheet({
  candidate,
  confidence,
  marketPriceUsd,
  priceLoading,
  formatUsd,
  themed,
  onViewDetails,
  onAddToVault,
  onRescan,
}: {
  candidate: IdentifyCandidate;
  confidence: number;
  marketPriceUsd: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  themed: ReturnType<typeof useThemedPalette>;
  onViewDetails: () => void;
  onAddToVault: () => void;
  onRescan: () => void;
}) {
  const confidencePct = Math.round(confidence * 100);
  const setMeta = [candidate.set_name, candidate.number ? `#${candidate.number}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        backgroundColor: "rgba(15,15,17,0.96)",
        borderRadius: 22,
        padding: 14,
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.mint, 0.18),
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        {/* Card thumbnail */}
        <View
          style={{
            width: 86,
            aspectRatio: 2.5 / 3.5,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          {candidate.image_url ? (
            <Image
              source={{ uri: candidate.image_url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={20} color={withAlpha("#fff", 0.5)} />
            </View>
          )}
        </View>

        {/* Identity + price */}
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: palette.accent.mint,
                }}
              />
              <Text
                style={{
                  color: palette.accent.mint,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 1.4,
                }}
              >
                MATCH · {confidencePct}%
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: "#fff",
                fontSize: 17,
                fontWeight: "700",
                letterSpacing: -0.3,
                lineHeight: 21,
              }}
            >
              {candidate.name}
            </Text>
            {setMeta ? (
              <Text
                numberOfLines={1}
                style={{
                  color: "rgba(255,255,255,0.62)",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                {setMeta}
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: 8 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.48)",
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1.2,
              }}
            >
              MARKET PRICE
            </Text>
            {marketPriceUsd != null ? (
              <Text
                style={{
                  color: palette.accent.mint,
                  fontSize: 24,
                  fontWeight: "800",
                  letterSpacing: -0.6,
                  fontVariant: ["tabular-nums"],
                  marginTop: 2,
                }}
              >
                {formatUsd(marketPriceUsd)}
              </Text>
            ) : priceLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <ActivityIndicator size="small" color={palette.accent.mint} />
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                  Fetching latest sales…
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 14,
                  fontWeight: "600",
                  marginTop: 2,
                }}
              >
                No recent sales
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Action row */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onViewDetails}
          accessibilityRole="button"
          accessibilityLabel="View card details"
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: palette.accent.mint,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#08110D", fontWeight: "800", fontSize: 14 }}>
            View details
          </Text>
          <ChevronRight size={16} color="#08110D" />
        </Pressable>
        <Pressable
          onPress={onAddToVault}
          accessibilityRole="button"
          accessibilityLabel="Add to vault"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha("#fff", 0.18),
            backgroundColor: "rgba(255,255,255,0.04)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Plus size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Vault</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRescan}
        accessibilityRole="button"
        accessibilityLabel="Scan another card"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <RotateCcw size={13} color={withAlpha("#fff", 0.6)} />
        <Text style={{ color: withAlpha("#fff", 0.65), fontSize: 12, fontWeight: "600" }}>
          Not it? Scan again
        </Text>
      </Pressable>
    </View>
  );
}
