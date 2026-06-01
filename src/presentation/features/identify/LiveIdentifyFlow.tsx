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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import {
  extractMarketPriceUsd,
  usePokemonTcgCard,
} from "@/application/queries/pokemonTcg/usePokemonTcg";
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
import { cardDetector } from "@/infrastructure/native";
import {
  lookupCardByHash,
  rememberCardHash,
} from "@/infrastructure/cache/cardHashCache";

const CAPTURE_LONG_EDGE = 900;
const CAPTURE_QUALITY = 0.42;
/**
 * Min gap between identify calls. Keeps the device cool + bill low.
 * Tuned to ~450ms (vs the previous 900ms) because the server-side
 * Vision+rerank round-trip is consistently ~120–200ms when warm —
 * the previous interval meant the user perceived the carousel as
 * frozen between frames. We still gate on `inflightRef` so we never
 * stack requests, and capture / encode / upload are now pipelined so
 * the next frame starts as soon as the previous response lands.
 */
const CAPTURE_INTERVAL_MS = 1000;
/** Confidence at which we fire the success haptic + freeze the carousel. */
const LOCK_CONFIDENCE = 0.7;
/**
 * Consecutive frames returning zero high-confidence (>=0.5) candidates
 * before we surface the "can't find a match" fallback CTA. At the
 * CAPTURE_INTERVAL_MS (1000ms) cadence — chosen to stay under the
 * backend's 60/min identify rate limit so frames stop getting 429'd
 * mid-scan — this works out to ~3s of camera time before the user gets
 * the escape hatch. The live "Scanning…" pulse keeps the surface feeling
 * alive in the meantime.
 */
const NO_MATCH_THRESHOLD = 3;

// ── Native card-detector thresholds ─────────────────────────────────
// These are deliberately conservative: a single bad frame should never
// block identify, but a stretch of obvious blur / glare should suppress
// network calls to save battery + spend. Numbers calibrated against the
// scores returned by the iOS Vision/CoreImage pipeline in
// `LoupeScannerBridgeModule.swift` — `blurScore` is a Laplacian-variance
// log mapping and `glareScore` is a bright-pixel fraction.
const BLUR_REJECT = 0.55;
const GLARE_REJECT = 0.6;
/** Crop the detected card before upload only when quality is solid. */
const CROP_BLUR_LIMIT = 0.45;
const CROP_GLARE_LIMIT = 0.5;
/** Long-edge for the perspective-corrected card upload (px). */
const CROP_LONG_EDGE = 720;
const CROP_JPEG_QUALITY = 0.7;

/**
 * Shared "glass" surface system for everything floating over the camera.
 * The scanner is always rendered on a live (dark) camera feed regardless
 * of the app theme, so these are intentionally fixed dark-glass values —
 * one consistent material instead of the grab-bag of one-off rgba()s the
 * surface used to mix. GLASS = floating pills/controls, GLASS_STRONG =
 * result cards that need to stay legible over busy backgrounds.
 */
const GLASS = "rgba(20,20,23,0.66)";
const GLASS_STRONG = "rgba(14,14,16,0.94)";
const HAIRLINE = "rgba(255,255,255,0.10)";

/**
 * Frosted-glass circular button — a BlurView fill behind the icon so the
 * camera feed shows through, blurred. Used for the top-bar close/flash
 * controls. The Pressable stays the outer node so press feedback + hit
 * targets are unaffected; the BlurView is clipped to the circle.
 */
function GlassCircle({
  children,
  onPress,
  accessibilityLabel,
  tint = GLASS,
  borderColor = HAIRLINE,
  size = 38,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: string;
  borderColor?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        borderWidth: 1,
        borderColor,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <BlurView
        intensity={24}
        tint="dark"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint,
        }}
      >
        {children}
      </BlurView>
    </Pressable>
  );
}

/**
 * TCG hints surfaced as a chevron pill in the bottom bar. Each carries a
 * brand-ish accent so the pill can show a colored dot for the selected
 * game — a small, modern affordance that also makes a wrong auto-detect
 * (e.g. a Pokémon card read as Yu-Gi-Oh) visible at a glance.
 */
const TCG_OPTIONS: { key: IdentifyTcgHint; label: string; color: string }[] = [
  { key: null, label: "Auto-detect", color: palette.accent.mint },
  { key: "pokemon", label: "Pokémon", color: palette.accent.amber },
  { key: "magic", label: "Magic", color: palette.accent.blue },
  { key: "yugioh", label: "Yu-Gi-Oh!", color: palette.accent.purple },
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
  /**
   * The capture loop has two distinct stages with very different
   * runtimes — the camera-bound capture+encode (~50–120ms) and the
   * network-bound identify call (~120–250ms warm, much longer cold).
   * Holding a single lock across both stages serialises the whole
   * pipeline and leaves the camera idle for half the cycle. Splitting
   * them lets the next shutter fire as soon as the current frame's
   * bytes are off-device, overlapping encode/upload with the next
   * capture for roughly a 2x effective frame rate at the same backend
   * load.
   */
  const captureBusyRef = useRef(false);
  const networkBusyRef = useRef(false);
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
  /**
   * Per-frame guidance from the native card detector ("Hold steady",
   * "Reduce glare", …). `null` when no actionable hint is needed or
   * when the native module isn't linked (Expo Go falls through to the
   * legacy full-frame upload path — see `cardDetector.isAvailable`).
   * Updated on every camera frame, so we keep this in a ref-backed
   * state to avoid re-rendering the whole flow if the label doesn't
   * change.
   */
  const [detectorHint, setDetectorHint] = useState<string | null>(null);
  const detectorHintRef = useRef<string | null>(null);
  const updateDetectorHint = useCallback((next: string | null) => {
    if (detectorHintRef.current === next) return;
    detectorHintRef.current = next;
    setDetectorHint(next);
  }, []);

  // ─── Capture loop ────────────────────────────────────────────────
  // We deliberately drive the loop from a ref-guarded setTimeout chain
  // instead of setInterval — interval would happily stack calls when a
  // request takes longer than the cadence, melting both phone and
  // backend.
  // Two-stage pipeline. The camera-bound capture+encode (~50-120ms)
  // and the network-bound identify call (~120-250ms warm, much longer
  // cold) get separate locks so a frame's shutter can fire while the
  // previous frame is still uploading. This roughly doubles the
  // effective frame rate at the same backend load. We still cap
  // network concurrency at 1 so we never stack identify requests.
  const runIdentify = useCallback(
    async (uri: string, providedHash: string | null = null) => {
      if (networkBusyRef.current) return;
      networkBusyRef.current = true;
      setScanning(true);
      try {
        let res: IdentifyResponse = await identifyCard(uri, tcgHint);
        if (cancelledRef.current) return;
        if (res.fallback_required) {
          if (isOnDeviceOcrAvailable()) {
            const ocr = await recognizeTextOnDevice(uri);
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
              res.fallback_reason ?? "Scanner over monthly budget. Try again later.",
            );
          }
        }
        setState((prev) => {
          const top = res.candidates[0]?.confidence ?? 0;
          const justLocked = !prev.locked && top >= LOCK_CONFIDENCE;
          const hasUsefulMatch = res.candidates.some((c) => c.confidence >= 0.5);
          if (justLocked) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
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
        // ── On-device cache write ───────────────────────────────────
        // Only remember high-confidence answers — caching a low-conf
        // guess would teach the scanner the wrong card. We hash the
        // exact URI we just uploaded so subsequent frames of the same
        // card (which dHash to within a few bits) short-circuit on the
        // way in. Fire-and-forget; hash failure is non-fatal.
        const topCandidate = res.candidates[0];
        const topConfidence = topCandidate?.confidence ?? 0;
        if (
          providedHash &&
          topCandidate &&
          topConfidence >= LOCK_CONFIDENCE
        ) {
          rememberCardHash(providedHash, topCandidate, topConfidence).catch(() => {});
        } else if (
          !providedHash &&
          cardDetector.capabilities.hash &&
          topCandidate &&
          topConfidence >= LOCK_CONFIDENCE
        ) {
          cardDetector
            .hash(uri)
            .then((h) => {
              if (h) return rememberCardHash(h, topCandidate, topConfidence);
              return undefined;
            })
            .catch(() => {});
        }
      } catch (e) {
        if (cancelledRef.current) return;
        const msg = e instanceof Error ? e.message : "Identification failed";
        setError(msg);
      } finally {
        networkBusyRef.current = false;
        if (!cancelledRef.current) setScanning(false);
      }
    },
    [tcgHint],
  );

  const captureOnce = useCallback(async () => {
    if (cancelledRef.current || captureBusyRef.current) return;
    const camera = cameraRef.current;
    if (!camera) return;
    captureBusyRef.current = true;
    setError(null);
    try {
      const photo = await camera.takePictureAsync({
        quality: CAPTURE_QUALITY,
        skipProcessing: true,
        exif: false,
      });
      if (!photo || cancelledRef.current) {
        captureBusyRef.current = false;
        return;
      }
      const longEdge = Math.max(photo.width, photo.height);
      const scale =
        longEdge > CAPTURE_LONG_EDGE ? CAPTURE_LONG_EDGE / longEdge : 1;
      const processed =
        scale < 1
          ? await manipulateAsync(
              photo.uri,
              [{ resize: { width: Math.round(photo.width * scale) } }],
              { compress: CAPTURE_QUALITY, format: SaveFormat.JPEG },
            )
          : photo;
      // Release the camera lock immediately so the next shutter can
      // start firing in parallel with this frame's network identify.
      captureBusyRef.current = false;
      if (cancelledRef.current) return;

      // ── Native card detector ──────────────────────────────────────
      // On dev/prod builds this runs Vision + a Laplacian-variance blur
      // check + a glare estimator in ~10-20ms. We use it for two things:
      //   1. Suppress identify calls on obviously bad frames (battery + $).
      //   2. Perspective-crop the card so we upload ~30KB instead of
      //      ~200KB, which makes the round-trip dramatically faster on
      //      slow networks.
      // In Expo Go (no native module) `analyzeFrame` returns the inert
      // NO_RESULT sentinel and we fall through to the legacy full-frame
      // upload path with no hint shown.
      let uploadUri = processed.uri;
      let cropUri: string | null = null;
      if (cardDetector.capabilities.analyze) {
        const report = await cardDetector.analyzeFrame(processed.uri);
        if (cancelledRef.current) return;
        if (!report.corners) {
          // Don't yell at the user immediately — first 1-2 frames
          // often miss while they're framing. The capture loop fires
          // every CAPTURE_INTERVAL_MS so this self-corrects fast.
          updateDetectorHint("Position card in the frame");
        } else if (report.blurScore > BLUR_REJECT) {
          updateDetectorHint("Hold steady");
          return; // Skip identify; next frame in CAPTURE_INTERVAL_MS.
        } else if (report.glareScore > GLARE_REJECT) {
          updateDetectorHint("Reduce glare / tilt the card");
          return;
        } else {
          updateDetectorHint(null);
          if (
            report.blurScore < CROP_BLUR_LIMIT &&
            report.glareScore < CROP_GLARE_LIMIT
          ) {
            try {
              const crop = await cardDetector.crop(
                processed.uri,
                report.corners,
                CROP_LONG_EDGE,
                CROP_JPEG_QUALITY,
              );
              if (cancelledRef.current) return;
              if (crop.uri && crop.bytes > 0) {
                uploadUri = crop.uri;
                cropUri = crop.uri;
              }
            } catch {
              // Crop failure is non-fatal — fall through to full frame.
            }
          }
        }
      }

      // ── On-device pHash cache short-circuit ───────────────────────
      // We prefer to hash the perspective-corrected crop (cleaner
      // signal, ignores the desk background). On platforms without
      // rectangle detection (Android today) we fall back to hashing
      // the raw downscaled frame — noisier, but still useful since the
      // user typically holds the phone in roughly the same position
      // across consecutive frames of the same card.
      let frameHash: string | null = null;
      const hashInputUri = cropUri ?? processed.uri;
      if (cardDetector.capabilities.hash) {
        frameHash = await cardDetector.hash(hashInputUri);
        if (cancelledRef.current) return;
        if (frameHash) {
          const cached = await lookupCardByHash(frameHash);
          if (cancelledRef.current) return;
          if (cached) {
            // Apply the cached answer instantly. We mark the source as
            // "phash" so the candidate's UI badge reflects that it came
            // from the local cache rather than a live network result.
            const cachedCandidate: IdentifyCandidate = {
              ...cached.candidate,
              confidence: Math.max(cached.candidate.confidence, cached.confidence),
              source: "phash",
            };
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
            setState((prev) => ({
              candidates: [cachedCandidate],
              // No real identification_id — cache hits aren't backend
              // events, so we deliberately leave this null. The picker
              // handler skips feedback POSTs when id is null.
              identificationId: null,
              topConfidence: cachedCandidate.confidence,
              primarySource: "cache",
              locked: true,
              emptyAttempts: 0,
            }));
            // Bump LRU timestamp on the cache entry.
            rememberCardHash(frameHash, cachedCandidate, cachedCandidate.confidence).catch(
              () => {},
            );
            return;
          }
        }
      }

      // Fire-and-forget; network concurrency is gated by networkBusyRef.
      // If a previous identify is still in flight we drop this frame
      // (the next is only ~CAPTURE_INTERVAL_MS away).
      runIdentify(uploadUri, frameHash).catch(() => {});
    } catch (e) {
      captureBusyRef.current = false;
      if (cancelledRef.current) return;
      const msg = e instanceof Error ? e.message : "Capture failed";
      setError(msg);
    }
  }, [runIdentify, updateDetectorHint]);

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

  // expo-camera's continuous AF on iOS frequently "sticks" at infinity
  // when pointed at a flat card held close — the subject never changes
  // enough to retrigger the AF loop, so the preview stays soft and the
  // blur gate rejects every frame ("can't scan this card"). Nudge the AF
  // loop on mount and on a gentle cadence while we're actively hunting
  // so a freshly-presented card snaps sharp without the user tapping.
  useEffect(() => {
    if (!permission?.granted || paused || state.locked) return;
    refocus();
    const id = setInterval(refocus, 2500);
    return () => clearInterval(id);
  }, [permission?.granted, paused, state.locked, refocus]);

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
  const ourMarketPriceUsd = market.data?.snapshot.summary.raw?.amount ?? null;

  // Fallback to the public Pokémon TCG API when our backend has no
  // resolved card_id (cache hits, unmatched cards) but we still have
  // an `upstream_id` like `pokemontcg:base1-4`. Free tier covers this
  // by ~20x with an API key. Hook silently no-ops for non-Pokémon
  // candidates, so this is safe to call unconditionally on lock.
  const lockedUpstreamId = state.locked ? topCandidate?.upstream_id ?? null : null;
  const pokemonTcg = usePokemonTcgCard(lockedUpstreamId);
  const fallbackMarketPriceUsd = extractMarketPriceUsd(pokemonTcg.data);

  const marketPriceUsd = ourMarketPriceUsd ?? fallbackMarketPriceUsd;
  const priceLoading =
    (market.isLoading || pokemonTcg.isLoading) && marketPriceUsd == null;

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
            locked={state.locked}
            hasMatch={state.candidates.some((c) => c.confidence >= 0.5)}
            onToggleFlash={() => setFlashOn((v) => !v)}
          />

          <ReticleArea
            scanning={scanning && !paused}
            locked={state.locked}
            hasMatch={state.candidates.some((c) => c.confidence >= 0.5)}
            paused={paused}
            marketPriceUsd={marketPriceUsd}
            formatUsd={formatUsd}
            priceLoading={priceLoading}
            onTapFocus={refocus}
          />

          <BottomPanel
            state={state}
            error={error}
            detectorHint={detectorHint}
            tcgHint={tcgHint}
            tcgPickerOpen={tcgPickerOpen}
            onOpenTcgPicker={() => setTcgPickerOpen((v) => !v)}
            onCloseTcgPicker={() => setTcgPickerOpen(false)}
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
            priceLoading={priceLoading}
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
  locked,
  hasMatch,
  onToggleFlash,
}: {
  onClose: () => void;
  flashOn: boolean;
  locked: boolean;
  hasMatch: boolean;
  onToggleFlash: () => void;
}) {
  // Breathing status dot — gives the header a quiet "alive" pulse while
  // hunting, then snaps solid mint the moment we have a match/lock.
  const dot = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    if (locked || hasMatch) {
      dot.setValue(1);
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
  }, [locked, hasMatch, dot]);

  const status = locked
    ? "Locked in"
    : hasMatch
      ? "Match found"
      : "Looking for a card…";

  return (
    <LinearGradient
      colors={["rgba(0,0,0,0.74)", "transparent"]}
      style={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 30 }}
    >
      <View className="flex-row items-center justify-between">
        <GlassCircle onPress={onClose} accessibilityLabel="Close scanner">
          <X size={18} color="#fff" />
        </GlassCircle>

        {/* Centered title + live status. Top = current mode, bottom panel
            = the actual result, so they never duplicate. */}
        <View style={{ alignItems: "center", gap: 3 }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 15.5,
              fontWeight: "700",
              letterSpacing: -0.2,
            }}
          >
            Scan a card
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Animated.View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: palette.accent.mint,
                opacity: dot,
              }}
            />
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 11.5,
                fontWeight: "600",
                letterSpacing: 0.2,
              }}
            >
              {status}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onToggleFlash}
          hitSlop={12}
          accessibilityLabel={flashOn ? "Turn flash off" : "Turn flash on"}
          className="h-[38px] w-[38px] items-center justify-center rounded-full"
          style={({ pressed }) => ({
            overflow: "hidden",
            borderWidth: 1,
            borderColor: flashOn ? "transparent" : HAIRLINE,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {flashOn ? (
            <View
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.accent.amber,
              }}
            >
              <Zap size={16} color="#000" />
            </View>
          ) : (
            <BlurView
              intensity={24}
              tint="dark"
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: GLASS,
              }}
            >
              <ZapOff size={16} color="#fff" />
            </BlurView>
          )}
        </Pressable>
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

  // Laser sweep that travels top→bottom of the card frame while we're
  // hunting. Drives a translateY (0→1 interpolated to the card height
  // in render). Pure perceptual "we're scanning" feedback.
  const sweep = useRef(new Animated.Value(0)).current;
  const hunting = scanning && !locked && !hasMatch && !paused;
  useEffect(() => {
    if (!hunting) {
      sweep.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1700,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [hunting, sweep]);

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

  // Floating price chip entrance. Springs up + fades in the moment the
  // chip should be on screen (locked, and either loading or priced) so
  // the value "pops" into place rather than hard-cutting in.
  const priceChipVisible = locked && (priceLoading || marketPriceUsd != null);
  const priceChipAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!priceChipVisible) {
      priceChipAnim.setValue(0);
      return;
    }
    const anim = Animated.spring(priceChipAnim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 10,
      speed: 14,
    });
    anim.start();
    return () => anim.stop();
  }, [priceChipVisible, priceChipAnim]);

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

  // Card window sized in real pixels (not %) so the dim scrim's clear
  // cutout and the corner brackets line up exactly. 78% of the short
  // edge at the standard trading-card aspect (2.5:3.5) frames a card
  // held at a comfortable distance without crowding the price chip.
  const { width: winW, height: winH } = useWindowDimensions();
  const CARD_W = Math.round(Math.min(winW * 0.78, winH * 0.5 * (2.5 / 3.5)));
  const CARD_H = Math.round(CARD_W * (3.5 / 2.5));

  // No scrim. The user wants the live camera fully visible — the corner
  // brackets + thin card-window border do all the framing, no grey wash
  // over the feed.
  const scrim = "transparent";

  return (
    <Pressable
      onPress={handleTap}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      {/* Dimmed cutout scrim — darkens everything outside the card
          window so the eye (and the user) lands squarely on the card,
          the way Collectr / Google Lens frame a scan. Built from four
          panels around an explicitly-sized clear window so it needs no
          masking library and stays pixel-aligned with the brackets. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: scrim }} />
        <View style={{ flexDirection: "row", height: CARD_H }}>
          <View style={{ flex: 1, backgroundColor: scrim }} />
          <View
            style={{
              width: CARD_W,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: withAlpha("#FFFFFF", locked || hasMatch ? 0 : 0.18),
            }}
          />
          <View style={{ flex: 1, backgroundColor: scrim }} />
        </View>
        <View style={{ flex: 1, backgroundColor: scrim }} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={{
          width: CARD_W,
          height: CARD_H,
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
            <Animated.View
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
                opacity: priceChipAnim,
                transform: [
                  {
                    translateY: priceChipAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                  {
                    scale: priceChipAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
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
            </Animated.View>
          </View>
        ) : null}

        {/* Laser sweep — a soft mint band that glides down the card
            frame while hunting. Replaces the old static "Hold Steady"
            pill (which duplicated the bottom status). */}
        {hunting ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              top: 0,
              height: 56,
              opacity: pulse,
              transform: [
                {
                  translateY: sweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-28, CARD_H - 28],
                  }),
                },
              ],
            }}
          >
            <LinearGradient
              colors={[
                "transparent",
                withAlpha(palette.accent.mint, 0.18),
                withAlpha(palette.accent.mint, 0.0),
              ]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ flex: 1, borderRadius: 8 }}
            />
            <View
              style={{
                position: "absolute",
                left: 2,
                right: 2,
                top: 27,
                height: 2,
                borderRadius: 2,
                backgroundColor: withAlpha(palette.accent.mint, 0.9),
                shadowColor: palette.accent.mint,
                shadowOpacity: 0.8,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
          </Animated.View>
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
  // Rounded L-shaped bracket (Apple document-scanner aesthetic) — two
  // borders + a single rounded corner instead of two hard rectangles.
  const SIZE = bold ? 30 : 26;
  const THICK = bold ? 4 : 3;
  const RADIUS = 14;
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
          style={{
            ...base,
            top: -2,
            left: -2,
            borderTopWidth: THICK,
            borderLeftWidth: THICK,
            borderTopLeftRadius: RADIUS,
          }}
        />
      );
    case "tr":
      return (
        <View
          style={{
            ...base,
            top: -2,
            right: -2,
            borderTopWidth: THICK,
            borderRightWidth: THICK,
            borderTopRightRadius: RADIUS,
          }}
        />
      );
    case "bl":
      return (
        <View
          style={{
            ...base,
            bottom: -2,
            left: -2,
            borderBottomWidth: THICK,
            borderLeftWidth: THICK,
            borderBottomLeftRadius: RADIUS,
          }}
        />
      );
    case "br":
      return (
        <View
          style={{
            ...base,
            bottom: -2,
            right: -2,
            borderBottomWidth: THICK,
            borderRightWidth: THICK,
            borderBottomRightRadius: RADIUS,
          }}
        />
      );
  }
}

function BottomPanel({
  state,
  error,
  detectorHint,
  tcgHint,
  tcgPickerOpen,
  onOpenTcgPicker,
  onCloseTcgPicker,
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
  detectorHint: string | null;
  tcgHint: IdentifyTcgHint;
  tcgPickerOpen: boolean;
  onOpenTcgPicker: () => void;
  onCloseTcgPicker: () => void;
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
  const tcgOption = useMemo(
    () => TCG_OPTIONS.find((o) => o.key === tcgHint) ?? TCG_OPTIONS[0]!,
    [tcgHint],
  );
  const tcgLabel = tcgOption.label;
  const tcgColor = tcgOption.color;
  const shutterLocked = state.locked;

  // Pulsing "halo" ring around the shutter once we lock — a gentle
  // expanding/fading mint pulse that signals "got it, tap to view".
  const shutterPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shutterLocked) {
      shutterPulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(shutterPulse, {
        toValue: 1,
        duration: 1300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [shutterLocked, shutterPulse]);

  return (
    <LinearGradient
      colors={["transparent", "rgba(0,0,0,0.92)"]}
      style={{ paddingHorizontal: 14, paddingBottom: 8, paddingTop: 14, gap: 10 }}
    >
      <TcgPickerSheet
        visible={tcgPickerOpen}
        selected={tcgHint}
        onSelect={(t) => onPickTcg(t)}
        onClose={onCloseTcgPicker}
      />

      {state.locked && state.candidates[0] ? (
        <LockedResultSheet
          candidate={state.candidates[0]}
          candidates={state.candidates}
          confidence={state.topConfidence}
          marketPriceUsd={marketPriceUsd}
          priceLoading={priceLoading}
          formatUsd={formatUsd}
          themed={themed}
          onViewDetails={() => {
            const c = state.candidates[0];
            if (c) onPickCandidate(c);
          }}
          onPickAlternate={onPickCandidate}
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
          detectorHint={detectorHint}
          scanning={scanning}
          onPickCandidate={onPickCandidate}
          onRescan={onRescan}
          onManualSearch={onManualSearch}
        />
      )}

      <View
        className="flex-row items-center"
        style={{ paddingHorizontal: 6, paddingTop: 6 }}
      >
        {/* Left cluster — equal flex so the shutter stays dead-center
            regardless of the pill/Search label widths. */}
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          {/* TCG selector pill — glassy dark to sit quietly on the camera
              surface (the shutter is the only bright element), with a
              per-game color dot so a wrong auto-detect is obvious. */}
          <Pressable
            onPress={onOpenTcgPicker}
            accessibilityRole="button"
            accessibilityLabel="Change TCG hint"
            style={({ pressed }) => ({
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: HAIRLINE,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <BlurView
              intensity={24}
              tint="dark"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingLeft: 11,
                paddingRight: 12,
                paddingVertical: 10,
                backgroundColor: GLASS,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: tcgColor,
                }}
              />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{tcgLabel}</Text>
              <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
            </BlurView>
          </Pressable>
        </View>

        {/* Manual shutter — the single bright focal point. Picks up a mint
            ring + glow the instant we lock so the control reflects state. */}
        <View style={{ width: 74, height: 74, alignItems: "center", justifyContent: "center" }}>
          {shutterLocked ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 74,
                height: 74,
                borderRadius: 37,
                borderWidth: 2,
                borderColor: palette.accent.mint,
                opacity: shutterPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: shutterPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.7],
                    }),
                  },
                ],
              }}
            />
          ) : null}
          <Pressable
            onPress={onManualCapture}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Capture frame now"
            style={({ pressed }) => ({
              width: 74,
              height: 74,
              borderRadius: 37,
              borderWidth: 4,
              borderColor: shutterLocked ? palette.accent.mint : "rgba(255,255,255,0.95)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.65 : 1,
              shadowColor: shutterLocked ? palette.accent.mint : "#000",
              shadowOpacity: shutterLocked ? 0.55 : 0.3,
              shadowRadius: shutterLocked ? 14 : 8,
              shadowOffset: { width: 0, height: 0 },
              elevation: shutterLocked ? 10 : 4,
            })}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: shutterLocked ? palette.accent.mint : "#fff",
              }}
            />
          </Pressable>
        </View>

        {/* Right cluster — manual search escape hatch. */}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Pressable
            onPress={onManualSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search the catalog manually"
            disabled={!onManualSearch}
            style={({ pressed }) => ({
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: HAIRLINE,
              opacity: pressed ? 0.7 : onManualSearch ? 1 : 0.4,
            })}
          >
            <BlurView
              intensity={24}
              tint="dark"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 13,
                paddingVertical: 10,
                backgroundColor: GLASS,
              }}
            >
              <Search size={15} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Search</Text>
            </BlurView>
          </Pressable>
        </View>
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
  detectorHint,
  scanning,
  onPickCandidate,
  onRescan,
  onManualSearch,
}: {
  state: IdentifyState;
  error: string | null;
  detectorHint: string | null;
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
    // Surface live detector guidance ("Hold steady" / "Reduce glare")
    // first — it's more actionable than the generic reading pulse, and
    // it only fires when the native module is linked AND has a clear
    // opinion on the current frame.
    if (detectorHint) {
      return <HintPill label={detectorHint} />;
    }
    // No useful candidates yet. Show the no-match escape hatch once
    // we've burned NO_MATCH_THRESHOLD frames on nothing; otherwise a
    // live "Scanning…" pulse so the surface always feels alive (the
    // capture loop is running continuously while mounted).
    if (state.emptyAttempts >= NO_MATCH_THRESHOLD) {
      return <NoMatchCard onManualSearch={onManualSearch} onRescan={onRescan} />;
    }
    return <HintPill label="Scanning…" pulse />;
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
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: GLASS,
        borderWidth: 1,
        borderColor: HAIRLINE,
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
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: HAIRLINE,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <BlurView
        intensity={32}
        tint="dark"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 12,
          backgroundColor: "rgba(14,14,16,0.72)",
        }}
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
      </BlurView>
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
        padding: 16,
        borderRadius: 20,
        backgroundColor: GLASS_STRONG,
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.amber, 0.3),
        gap: 10,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: -0.2 }}>
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

// ─────────────── TCG hint picker (bottom sheet) ───────────────
// Replaces the previous inline pill list, which looked cramped sitting
// inside the gradient and competed with the candidate carousel for
// real-estate. The new sheet rides on top of the camera surface via a
// transparent Modal — iOS gets the native pageSheet detents (grabber +
// swipe-to-dismiss), Android gets a rounded bottom sheet with a scrim.

function TcgPickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: IdentifyTcgHint;
  onSelect: (t: IdentifyTcgHint) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss picker"
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
      >
        {/* Stop propagation: tapping inside the sheet shouldn't dismiss. */}
        <Pressable onPress={() => {}}>
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: "#0F0F11",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 10,
              paddingBottom: Platform.OS === "ios" ? 8 : 16,
              borderTopWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", paddingBottom: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.22)",
                }}
              />
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                }}
              >
                Game
              </Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: "800",
                  letterSpacing: -0.4,
                  marginTop: 4,
                }}
              >
                Identify cards from…
              </Text>
            </View>

            <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
              {TCG_OPTIONS.map((o) => {
                const active = o.key === selected;
                return (
                  <Pressable
                    key={String(o.key)}
                    onPress={() => onSelect(o.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      marginVertical: 2,
                      borderRadius: 14,
                      backgroundColor: active
                        ? withAlpha(palette.accent.mint, 0.14)
                        : pressed
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                      borderWidth: 1,
                      borderColor: active
                        ? withAlpha(palette.accent.mint, 0.4)
                        : "rgba(255,255,255,0.05)",
                    })}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active
                          ? palette.accent.mint
                          : "rgba(255,255,255,0.08)",
                      }}
                    >
                      {active ? (
                        <Check size={16} color="#0B0B0D" strokeWidth={3} />
                      ) : (
                        <Sparkles size={14} color="rgba(255,255,255,0.55)" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 15,
                          fontWeight: active ? "700" : "600",
                          letterSpacing: -0.2,
                        }}
                      >
                        {o.label}
                      </Text>
                      {o.key === null ? (
                        <Text
                          style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          Let Loupe decide from the frame
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────── Locked-state hero result sheet ───────────────
// Once auto-capture locks on a high-confidence match we trade the
// thin candidate strip for a full-width "matched card" sheet, à la
// TCGplayer / Collectr: card thumbnail on the left, name + set +
// market price on the right, three CTAs underneath.

function LockedResultSheet({
  candidate,
  candidates,
  confidence,
  marketPriceUsd,
  priceLoading,
  formatUsd,
  themed,
  onViewDetails,
  onPickAlternate,
  onAddToVault,
  onRescan,
}: {
  candidate: IdentifyCandidate;
  candidates: IdentifyCandidate[];
  confidence: number;
  marketPriceUsd: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  themed: ReturnType<typeof useThemedPalette>;
  onViewDetails: () => void;
  onPickAlternate: (c: IdentifyCandidate) => void;
  onAddToVault: () => void;
  onRescan: () => void;
}) {
  const confidencePct = Math.round(confidence * 100);
  const setMeta = [candidate.set_name, candidate.number ? `#${candidate.number}` : null]
    .filter(Boolean)
    .join(" · ");
  // Alternate printings: every candidate after the locked top. Critical
  // for reprint ties (e.g. Base Set vs Base Set 2 Charizard share name +
  // number + art) where the auto-lock can't tell two near-identical
  // printings apart — the user picks the exact one they're holding.
  const alternates = candidates.slice(1, 7);

  // Entrance: the sheet swaps in for the thin candidate strip the moment
  // we lock, so spring it up from below + fade in to make the lock feel
  // like a deliberate, satisfying "snap" rather than a layout jump.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 9,
      speed: 13,
    });
    anim.start();
    return () => anim.stop();
  }, [enter]);

  return (
    <Animated.View
      style={{
        backgroundColor: GLASS_STRONG,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.mint, 0.22),
        gap: 14,
        shadowColor: palette.accent.mint,
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
          {
            scale: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
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

      {/* Alternate printings — horizontal thumbnail strip. Lets the user
          correct a reprint-tie lock (right name + number, wrong set) by
          tapping the exact printing they're holding. Tapping deep-links
          straight to that card's detail page. */}
      {alternates.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 1.2,
            }}
          >
            NOT THIS PRINTING? PICK THE EXACT ONE
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
          >
            {alternates.map((alt) => {
              const altMeta = [
                alt.set_name,
                alt.number ? `#${alt.number}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Pressable
                  key={alt.card_id ?? alt.upstream_id ?? alt.name}
                  onPress={() => onPickAlternate(alt)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick ${alt.name}${
                    altMeta ? `, ${altMeta}` : ""
                  }`}
                  style={({ pressed }) => ({
                    width: 92,
                    gap: 5,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 92,
                      aspectRatio: 2.5 / 3.5,
                      borderRadius: 8,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    {alt.image_url ? (
                      <Image
                        source={{ uri: alt.image_url }}
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
                        <Sparkles size={16} color={withAlpha("#fff", 0.4)} />
                      </View>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    {altMeta || alt.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

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
    </Animated.View>
  );
}
