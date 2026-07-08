/**
 * Card-identification viewfinder — a deliberate, camera-grade scan flow.
 *
 * Mounts a full-screen `expo-camera` preview with corner-bracket reticle.
 * Capturing is shutter-driven (matching the web scanner): the user frames
 * the card and taps the shutter; that one frame is downscaled and POSTed
 * to `/v1/cards/identify`. Each capture drops into the bottom session
 * tray as the photo just taken, then resolves in place to the matched
 * card — scan a whole stack tap by tap, then add them all to the vault.
 * There is NO continuous auto-capture loop: it spammed the camera with
 * shutter fire, burned identify quota on empty frames, and turned every
 * network blip into an error popup.
 *
 * Why this shape (vs the 4-shot Studio flow):
 *   • Studio = "grade this and bank it" — needs photometric frames,
 *     OCR is a side-effect.
 *   • Identify = "what IS this?" — one good frame per card, OCR +
 *     catalog re-rank, results land in the tray like a camera roll.
 *
 * Errors never modal: identify failures surface as a quiet auto-dismissing
 * banner above the shutter, and the shutter itself is the retry.
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
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Camera, CameraOff, X } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { usePublicSparklines } from "@/application/queries/catalog/usePublicSparklines";
import { useCompactUsd } from "@/shared/format";
import { usePro } from "@/presentation/features/pro";
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
import {
  GLASS,
  HAIRLINE,
  BLUR_INTENSITY,
  GlassCircle,
  ScannerTopBar,
  ScannerBottomPanel,
  candidateKey,
  scannerErrorCopy,
  isTransientCameraCaptureError,
  LOCK_CONFIDENCE,
  PREVIEW_CONFIDENCE,
  SESSION_RESULT_CONFIDENCE,
  ERROR_DISMISS_MS,
  HINT_DISMISS_MS,
  MAX_SCAN_SESSION_ITEMS,
  type ScanSessionItem,
} from "@/presentation/features/scan/overlay";

const CAPTURE_LONG_EDGE = 900;
const CAPTURE_QUALITY = 0.42;

/** Crop the detected card before upload only when quality is solid. */
const CROP_BLUR_LIMIT = 0.45;
const CROP_GLARE_LIMIT = 0.5;
/** Long-edge for the perspective-corrected card upload (px). */
const CROP_LONG_EDGE = 720;
const CROP_JPEG_QUALITY = 0.7;

/** Always-visible zoom presets over the viewfinder (FLIM / Apple Camera).
 *  Values are expo-camera's normalized 0..1 digital range; pinch covers
 *  everything in between and the nearest preset lights up. */
const ZOOM_PRESETS = [
  { label: "1×", value: 0 },
  { label: "2×", value: 0.25 },
  { label: "3×", value: 0.5 },
] as const;
const ZOOM_PRESET_TOLERANCE = 0.125;

interface LiveIdentifyFlowProps {
  onClose: () => void;
  /** Called when the user taps a matched capture in the session tray
   *  (→ card detail; "Add to collection" and grading live there). */
  onConfirm?: (
    candidate: IdentifyCandidate,
    identificationId: string,
  ) => void;
  /**
   * Called when the user taps "Add all" on the session tray. The host
   * route bulk-adds each matched candidate to the vault as a RAW
   * (ungraded) holding, then navigates away. When omitted, the "Add
   * all" affordance is hidden entirely.
   */
  onAddBatch?: (candidates: IdentifyCandidate[]) => void;
  /**
   * Called when the user taps a missed capture or the search button —
   * the manual escape hatch. Host route should push the catalog search.
   */
  onManualSearch?: () => void;
  /** Initial TCG hint (e.g. when launched from a TCG-filtered search). */
  initialTcg?: IdentifyTcgHint;
}

/**
 * Transient per-capture match state. Drives the "alive" chrome — reticle
 * tint, status line, shutter glow, and the floating price chip — while the
 * durable record of each capture lives in the `ScanSessionItem` tray.
 */
interface IdentifyState {
  candidates: IdentifyCandidate[];
  /** Set true the first time confidence crosses LOCK_CONFIDENCE. */
  locked: boolean;
}

const EMPTY_STATE: IdentifyState = {
  candidates: [],
  locked: false,
};

export function LiveIdentifyFlow({
  onClose,
  onConfirm,
  onAddBatch,
  onManualSearch,
  initialTcg = null,
}: LiveIdentifyFlowProps) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  const formatUsd = useCompactUsd();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  /**
   * Guards the camera-bound capture+encode stage so a double-tapped
   * shutter can't fire two takePictureAsync calls into each other. The
   * network identify stage is NOT gated — each captured frame owns a
   * session tile and resolves independently, so scanning a stack fast
   * never drops a card.
   */
  const captureBusyRef = useRef(false);
  const activeIdentifyCountRef = useRef(0);
  const captureFailureCountRef = useRef(0);
  const cancelledRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  // Pinch-to-zoom (Apple-camera parity for small/far cards). expo-camera's
  // zoom is normalized 0..1 across the device's digital range.
  const [zoom, setZoom] = useState(0);
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
  const [scanSession, setScanSession] = useState<ScanSessionItem[]>([]);
  const scanSessionSeqRef = useRef(0);
  const addScanSessionItem = useCallback((photoUri: string) => {
    const id = `${Date.now()}-${scanSessionSeqRef.current++}`;
    setScanSession((prev) =>
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
  const updateScanSessionItem = useCallback(
    (
      id: string | null,
      patch: Partial<Omit<ScanSessionItem, "id">>,
    ) => {
      if (!id) return;
      setScanSession((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );
  const removeScanSessionItem = useCallback((id: string) => {
    setScanSession((prev) => prev.filter((item) => item.id !== id));
  }, []);
  // Errors are a quiet, self-clearing banner — never a modal, and never a
  // frozen scanner. The camera stays live and the shutter is the retry.
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showScannerError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setError(scannerErrorCopy(message));
    errorTimerRef.current = setTimeout(() => setError(null), ERROR_DISMISS_MS);
  }, []);
  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );
  /**
   * Per-capture guidance from the native card detector ("Center the
   * card", …) or the transient-capture-error path ("Hold steady…").
   * `null` when no actionable hint is needed or when the native module
   * isn't linked (Expo Go falls through to the legacy full-frame upload
   * path — see `cardDetector.isAvailable`). Without a capture loop to
   * refresh it, a hint is a toast: it clears itself after a few seconds
   * (or on the next shutter tap) instead of lingering as stale advice.
   */
  const [detectorHint, setDetectorHint] = useState<string | null>(null);
  const detectorHintRef = useRef<string | null>(null);
  const detectorHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateDetectorHint = useCallback((next: string | null) => {
    if (detectorHintTimerRef.current) {
      clearTimeout(detectorHintTimerRef.current);
      detectorHintTimerRef.current = null;
    }
    if (detectorHintRef.current !== next) {
      detectorHintRef.current = next;
      setDetectorHint(next);
    }
    if (next) {
      detectorHintTimerRef.current = setTimeout(() => {
        detectorHintRef.current = null;
        setDetectorHint(null);
      }, HINT_DISMISS_MS);
    }
  }, []);
  useEffect(
    () => () => {
      if (detectorHintTimerRef.current) clearTimeout(detectorHintTimerRef.current);
    },
    [],
  );
  /**
   * Whether the native detector currently sees a card-shaped rectangle.
   * Drives the reticle's "locked the card finder" colour the instant a
   * card is framed — Collectr-style live feedback, independent of
   * whether the backend has resolved a match yet. Ref-guarded so we
   * only re-render on transitions.
   */
  const [cardFound, setCardFound] = useState(false);
  const cardFoundRef = useRef(false);
  const updateCardFound = useCallback((next: boolean) => {
    if (cardFoundRef.current === next) return;
    cardFoundRef.current = next;
    setCardFound(next);
  }, []);

  // ─── Identify pipeline ───────────────────────────────────────────
  // One captured frame → one identify call → one session tile resolved
  // in place. Capture+encode is serialized by `captureBusyRef`; identify
  // calls run independently so a fast stack-scan never drops a card.
  const runIdentify = useCallback(
    async (
      uri: string,
      providedHash: string | null,
      scanItemId: string,
    ) => {
      activeIdentifyCountRef.current += 1;
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
                clientProvider: ocr.provider,
                ocrConfidence: ocr.confidence,
              });
              if (cancelledRef.current) return;
            } else {
              showScannerError("On-device OCR found no text. Try better lighting.");
            }
          } else {
            showScannerError(
              res.fallback_reason ?? "Scanner over monthly budget. Try again later.",
            );
          }
        }
        const topCandidate = res.candidates[0] ?? null;
        const top = topCandidate?.confidence ?? 0;
        const hasPreviewMatch = res.candidates.some(
          (c) => c.confidence >= PREVIEW_CONFIDENCE,
        );
        const hasSessionMatch = topCandidate != null && top >= SESSION_RESULT_CONFIDENCE;
        updateScanSessionItem(scanItemId, {
          candidate: hasSessionMatch ? topCandidate : null,
          identificationId: hasSessionMatch ? res.identification_id : null,
          confidence: top,
          status: hasSessionMatch ? "matched" : "missed",
        });
        setState((prev) => {
          const justLocked = hasPreviewMatch && !prev.locked && top >= LOCK_CONFIDENCE;
          if (justLocked) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
          }
          return {
            candidates: hasPreviewMatch ? res.candidates : prev.candidates,
            locked: prev.locked || justLocked,
          };
        });
        // ── On-device cache write ───────────────────────────────────
        // Only remember high-confidence answers — caching a low-conf
        // guess would teach the scanner the wrong card. We hash the
        // exact URI we just uploaded so subsequent frames of the same
        // card (which dHash to within a few bits) short-circuit on the
        // way in. Fire-and-forget; hash failure is non-fatal.
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
        updateScanSessionItem(scanItemId, { status: "missed" });
        const msg = e instanceof Error ? e.message : "Identification failed";
        showScannerError(msg);
      } finally {
        activeIdentifyCountRef.current = Math.max(0, activeIdentifyCountRef.current - 1);
        if (!cancelledRef.current && activeIdentifyCountRef.current === 0) {
          setScanning(false);
        }
      }
    },
    [tcgHint, showScannerError, updateScanSessionItem],
  );

  const captureOnce = useCallback(async () => {
    if (cancelledRef.current || captureBusyRef.current) return;
    const camera = cameraRef.current;
    if (!camera || !cameraReady) return;
    captureBusyRef.current = true;
    setError(null);
    updateDetectorHint(null); // a fresh capture invalidates stale guidance
    try {
      const photo = await camera.takePictureAsync({
        quality: CAPTURE_QUALITY,
        skipProcessing: Platform.OS === "android",
        exif: false,
        // Batch-scanning a stack means many captures in a row — the OS
        // shutter *click* on every tap reads as spam. Haptics carry the
        // capture feedback instead (no-op in shutter-sound-mandated regions).
        shutterSound: false,
      });
      if (!photo || cancelledRef.current) {
        captureBusyRef.current = false;
        return;
      }
      captureFailureCountRef.current = 0;
      // Release the camera lock the moment the sensor frame is ours —
      // everything below is CPU/network work, so the next shutter tap
      // can start capturing in parallel.
      captureBusyRef.current = false;
      // Every capture is deliberate, so every capture gets a session
      // tile — the photo lands in the tray instantly and resolves in
      // place to the match (or a retryable miss). The tile briefly shows
      // the full-res photo, then is patched to the small crop/downscale
      // below so the tray never holds more than one full-res bitmap.
      const scanItemId = addScanSessionItem(photo.uri);

      // ── Native card detector ──────────────────────────────────────
      // Runs on the FULL-RESOLUTION photo: `analyzeCardFrame` downscales
      // internally (512px) for Vision + blur/glare, but returns corners
      // mapped back to source pixels precisely so the perspective crop
      // can cut the card from the original sensor image. Cropping the
      // full-res source (instead of a pre-shrunk copy) is both the
      // accuracy lever — a sharp, detail-true card for pHash/OCR — and
      // the speed lever: the happy path skips the expensive
      // decode→resize→re-encode pass entirely and uploads ~30KB.
      // A user-initiated capture is NEVER dropped for quality — the
      // server OCR is tolerant of a soft frame.
      // In Expo Go (no native module) `analyzeFrame` returns the inert
      // NO_RESULT sentinel and we fall through to the legacy downscaled
      // full-frame upload path with no hint shown.
      let uploadUri: string | null = null;
      let cropUri: string | null = null;
      if (cardDetector.capabilities.analyze) {
        const report = await cardDetector.analyzeFrame(photo.uri);
        if (cancelledRef.current) return;
        updateCardFound(report.corners != null);
        if (!report.corners) {
          // Still upload the (downscaled) full frame — a card the
          // detector can't outline can often still be read server-side.
          updateDetectorHint("Center the card inside the corners");
        } else if (
          report.blurScore < CROP_BLUR_LIMIT &&
          report.glareScore < CROP_GLARE_LIMIT
        ) {
          try {
            const crop = await cardDetector.crop(
              photo.uri,
              report.corners,
              CROP_LONG_EDGE,
              CROP_JPEG_QUALITY,
            );
            if (cancelledRef.current) return;
            if (crop.uri && crop.bytes > 0) {
              uploadUri = crop.uri;
              cropUri = crop.uri;
              // The deskewed card also makes a nicer, cheaper tray tile
              // than the raw desk photo.
              updateScanSessionItem(scanItemId, { photoUri: crop.uri });
            }
          } catch {
            // Crop failure is non-fatal — fall through to full frame.
          }
        }
      }

      // No usable crop → downscale the full frame for upload (a raw
      // 12MP sensor JPEG is multi-MB; ~900px is what the server-side
      // variant matching + OCR were calibrated on).
      if (!uploadUri) {
        const longEdge = Math.max(photo.width, photo.height);
        const scale =
          longEdge > CAPTURE_LONG_EDGE ? CAPTURE_LONG_EDGE / longEdge : 1;
        if (scale < 1) {
          const processed = await manipulateAsync(
            photo.uri,
            [{ resize: { width: Math.round(photo.width * scale) } }],
            { compress: CAPTURE_QUALITY, format: SaveFormat.JPEG },
          );
          if (cancelledRef.current) return;
          uploadUri = processed.uri;
          updateScanSessionItem(scanItemId, { photoUri: processed.uri });
        } else {
          uploadUri = photo.uri;
        }
      }

      // ── On-device pHash cache short-circuit ───────────────────────
      // We prefer to hash the perspective-corrected crop (cleaner
      // signal, ignores the desk background). On platforms without
      // rectangle detection (Android today) we fall back to hashing
      // the downscaled frame — noisier, but still useful since the
      // user typically holds the phone in roughly the same position
      // across consecutive captures of the same card.
      let frameHash: string | null = null;
      const hashInputUri = cropUri ?? uploadUri;
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
            setState(() => ({
              candidates: [cachedCandidate],
              locked: true,
            }));
            // No real identification_id — cache hits aren't backend
            // events, so we deliberately leave this null. The tray tile
            // handler skips feedback POSTs when id is null.
            updateScanSessionItem(scanItemId, {
              candidate: cachedCandidate,
              identificationId: null,
              confidence: cachedCandidate.confidence,
              status: "matched",
            });
            // Bump LRU timestamp on the cache entry.
            rememberCardHash(frameHash, cachedCandidate, cachedCandidate.confidence).catch(
              () => {},
            );
            return;
          }
        }
      }

      // Fire-and-forget — the session tile tracks this frame's outcome.
      runIdentify(uploadUri, frameHash, scanItemId).catch(() => {});
    } catch (e) {
      captureBusyRef.current = false;
      if (cancelledRef.current) return;
      const msg = e instanceof Error ? e.message : "Capture failed";
      if (isTransientCameraCaptureError(msg)) {
        captureFailureCountRef.current += 1;
        updateDetectorHint(
          captureFailureCountRef.current > 1
            ? "Camera settling — keep the card in frame"
            : "Hold steady while the camera focuses",
        );
        refocus();
        if (captureFailureCountRef.current >= 3) {
          captureFailureCountRef.current = 0;
          setCameraReady(false);
          setCameraKey((key) => key + 1);
        }
        return;
      }
      showScannerError(msg);
    }
  }, [addScanSessionItem, cameraReady, refocus, runIdentify, showScannerError, updateCardFound, updateDetectorHint, updateScanSessionItem]);

  // There is deliberately NO auto-capture loop here. Capturing is the
  // user's call — the shutter fires the camera exactly once per tap, so
  // the scanner never spams identify requests (or error popups) while
  // someone is just framing a card. This mirrors the web viewfinder.
  // The cancelled flag only flips when the flow unmounts.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // expo-camera's continuous AF on iOS frequently "sticks" at infinity
  // when pointed at a flat card held close — the subject never changes
  // enough to retrigger the AF loop, so the preview stays soft. Nudge the
  // AF loop on mount and on a gentle cadence while the viewfinder is up
  // so the frame is already sharp when the user taps the shutter.
  useEffect(() => {
    if (!permission?.granted || paused) return;
    refocus();
    const id = setInterval(refocus, 2500);
    return () => clearInterval(id);
  }, [permission?.granted, paused, refocus]);

  // ─── Actions ─────────────────────────────────────────────────────
  const handlePickScanSessionItem = useCallback(
    (item: ScanSessionItem) => {
      const candidate = item.candidate;
      if (!candidate) return;
      const id = item.identificationId;
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
    [onConfirm],
  );

  // The shutter. One tap = one capture = one tray tile. Resets the
  // transient match state so each card gets a fresh lock/price moment.
  const handleManualCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState(EMPTY_STATE);
    setError(null);
    void captureOnce();
  }, [captureOnce]);

  // ─── Add the whole session ───────────────────────────────────────
  // "Add all" on the session tray hands every matched capture to the
  // host (bulk add-to-vault), de-duplicated by candidateKey so scanning
  // the same card twice doesn't save it twice.
  const sessionMatches = React.useMemo(() => {
    const seen = new Set<string>();
    const out: IdentifyCandidate[] = [];
    for (const item of scanSession) {
      if (item.status !== "matched" || !item.candidate) continue;
      const key = candidateKey(item.candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item.candidate);
    }
    return out;
  }, [scanSession]);

  // Free-tier awareness while scanning: know how many vault slots remain so
  // the tray can warn BEFORE a batch add slams into the 402 (which the host
  // still handles as the backstop).
  const { gatingActive, cardCount, cardLimit, openPaywall } = usePro();
  const slotsLeft =
    gatingActive && cardLimit != null ? Math.max(0, cardLimit - cardCount) : null;

  const handleAddSession = useCallback(() => {
    if (sessionMatches.length === 0) return;
    // At the cap with nothing addable → straight to the paywall with the
    // card-limit story instead of a doomed request.
    if (slotsLeft !== null && slotsLeft === 0) {
      openPaywall("card_limit");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    onAddBatch?.(sessionMatches);
    setScanSession([]);
  }, [sessionMatches, onAddBatch, slotsLeft, openPaywall]);

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

  // Fallback to our backend's public sparklines endpoint when the
  // market call has no resolved card_id (cache hits, unmatched cards)
  // but we still have an `upstream_id` like `pokemontcg:base1-4`. The
  // batch endpoint accepts composite upstream ids directly and each
  // series' LAST point is the current market price — served from the
  // backend's Redis SWR cache + API budget meter, so devices never
  // call metered third-party card APIs themselves. Unknown ids simply
  // come back missing, so this is safe to fire for any TCG on lock.
  const lockedUpstreamId = state.locked ? topCandidate?.upstream_id ?? null : null;
  const fallbackIds = React.useMemo(
    () => (lockedUpstreamId ? [lockedUpstreamId] : []),
    [lockedUpstreamId],
  );
  const fallbackSparklines = usePublicSparklines(fallbackIds);
  const fallbackMarketPriceUsd = fallbackSparklines.priceOf(lockedUpstreamId);

  const marketPriceUsd = ourMarketPriceUsd ?? fallbackMarketPriceUsd;
  const priceLoading =
    (market.isLoading || fallbackSparklines.isLoading) && marketPriceUsd == null;

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
        style={{ flex: 1, backgroundColor: p.bg.base, padding: 24, justifyContent: "center", alignItems: "center" }}
      >
        {/* Close stays reachable top-left even on the gate — a solid disc,
            pushed clear of the notch/Dynamic Island. */}
        <View style={{ position: "absolute", top: insets.top + 8, left: 16 }}>
          <GlassCircle onPress={onClose} accessibilityLabel="Close scanner" size={44}>
            <X size={24} color="#fff" strokeWidth={2.4} />
          </GlassCircle>
        </View>

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

        <Text style={{ marginTop: 20, color: p.ink.default, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          {mustOpenSettings ? "Turn on camera access" : "Let Loupe see your cards"}
        </Text>
        <Text style={{ marginTop: 8, color: p.ink.muted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300 }}>
          {mustOpenSettings
            ? "Camera access is off. Open Settings → Loupe → Camera to switch it on, then come back."
            : "Point your camera at a card and Loupe identifies it instantly — set, number, and live price. Nothing is uploaded until you save a card."}
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
              const next = await requestPermission();
              // If the OS still won't ask (user denied in the dialog),
              // bounce them to Settings on the next tap.
              if (!next.granted && !next.canAskAgain) {
                Linking.openSettings().catch(() => {});
              }
            }}
          />
          <PrimaryButton label="Not now" variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main view ───────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        key={cameraKey}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        // Continuous torch, not a capture-time flash: a flash fires INTO a
        // glossy card and blows the frame out with glare; the torch lights
        // the preview continuously so what you see (including any glare) is
        // exactly what gets captured.
        enableTorch={flashOn}
        zoom={zoom}
        autofocus={autofocusOn ? "on" : "off"}
        onCameraReady={() => setCameraReady(true)}
      />
      <ScannerOverlay
        state={state}
        error={error}
        detectorHint={detectorHint}
        tcgHint={tcgHint}
        tcgPickerOpen={tcgPickerOpen}
        scanning={scanning}
        paused={paused}
        flashOn={flashOn}
        cardFound={cardFound}
        scanSession={scanSession}
        sessionMatchCount={sessionMatches.length}
        batchEnabled={onAddBatch != null}
        slotsLeft={slotsLeft}
        marketPriceUsd={marketPriceUsd}
        priceLoading={priceLoading}
        formatUsd={formatUsd}
        palette={p}
        onClose={onClose}
        onToggleFlash={() => setFlashOn((v) => !v)}
        onOpenTcgPicker={() =>
          setTcgPickerOpen((v) => {
            const next = !v;
            setPaused(next);
            return next;
          })
        }
        onCloseTcgPicker={() => {
          setTcgPickerOpen(false);
          setPaused(false);
        }}
        onPickTcg={(t) => {
          setTcgHint(t);
          setTcgPickerOpen(false);
          setState(EMPTY_STATE);
          setError(null);
          setPaused(false);
          updateCardFound(false);
        }}
        onPickScanSessionItem={handlePickScanSessionItem}
        onRemoveScanSessionItem={removeScanSessionItem}
        onAddSession={handleAddSession}
        onDismissError={() => setError(null)}
        onManualCapture={handleManualCapture}
        onManualSearch={onManualSearch}
        onTapFocus={refocus}
        zoom={zoom}
        onZoom={setZoom}
      />
    </View>
  );
}

// ────────────────────────── Subviews ──────────────────────────

function ScannerOverlay({
  state,
  error,
  detectorHint,
  tcgHint,
  tcgPickerOpen,
  scanning,
  paused,
  flashOn,
  cardFound,
  scanSession,
  sessionMatchCount,
  batchEnabled,
  slotsLeft,
  marketPriceUsd,
  priceLoading,
  formatUsd,
  palette: themed,
  onClose,
  onToggleFlash,
  onOpenTcgPicker,
  onCloseTcgPicker,
  onPickTcg,
  onPickScanSessionItem,
  onRemoveScanSessionItem,
  onAddSession,
  onDismissError,
  onManualCapture,
  onManualSearch,
  onTapFocus,
  zoom,
  onZoom,
}: {
  state: IdentifyState;
  error: string | null;
  detectorHint: string | null;
  tcgHint: IdentifyTcgHint;
  tcgPickerOpen: boolean;
  scanning: boolean;
  paused: boolean;
  flashOn: boolean;
  cardFound: boolean;
  scanSession: ScanSessionItem[];
  sessionMatchCount: number;
  batchEnabled: boolean;
  /** Remaining free-tier vault slots (null = uncapped). */
  slotsLeft: number | null;
  marketPriceUsd: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  palette: ReturnType<typeof useThemedPalette>;
  onClose: () => void;
  onToggleFlash: () => void;
  onOpenTcgPicker: () => void;
  onCloseTcgPicker: () => void;
  onPickTcg: (t: IdentifyTcgHint) => void;
  onPickScanSessionItem: (item: ScanSessionItem) => void;
  onRemoveScanSessionItem: (id: string) => void;
  onAddSession: () => void;
  onDismissError: () => void;
  onManualCapture: () => void;
  onManualSearch?: () => void;
  onTapFocus: (point: { x: number; y: number }) => void;
  zoom: number;
  onZoom: (z: number) => void;
}) {
  const hasMatch = state.candidates.some((c) => c.confidence >= PREVIEW_CONFIDENCE);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      pointerEvents="box-none"
      style={{ ...StyleSheet.absoluteFillObject, justifyContent: "space-between" }}
    >
      <ScannerTopBar
        onClose={onClose}
        flashOn={flashOn}
        locked={state.locked}
        hasMatch={hasMatch}
        scanning={scanning}
        onToggleFlash={onToggleFlash}
        tcgHint={tcgHint}
        onOpenTcgPicker={onOpenTcgPicker}
        palette={themed}
      />

      <ReticleArea
        scanning={scanning && !paused}
        locked={state.locked}
        hasMatch={hasMatch}
        cardFound={cardFound}
        paused={paused}
        marketPriceUsd={marketPriceUsd}
        formatUsd={formatUsd}
        priceLoading={priceLoading}
        onTapFocus={onTapFocus}
        zoom={zoom}
        onZoom={onZoom}
      />

      <ScannerBottomPanel
        error={error}
        detectorHint={detectorHint}
        tcgHint={tcgHint}
        tcgPickerOpen={tcgPickerOpen}
        onCloseTcgPicker={onCloseTcgPicker}
        onPickTcg={onPickTcg}
        scanSession={scanSession}
        slotsLeft={slotsLeft}
        sessionMatchCount={sessionMatchCount}
        batchEnabled={batchEnabled}
        onPickScanSessionItem={onPickScanSessionItem}
        onRemoveScanSessionItem={onRemoveScanSessionItem}
        onAddSession={onAddSession}
        onDismissError={onDismissError}
        onManualCapture={onManualCapture}
        onManualSearch={onManualSearch}
        scanning={scanning}
        locked={state.locked}
        formatUsd={formatUsd}
        palette={themed}
      />
    </SafeAreaView>
  );
}

function ReticleArea({
  scanning,
  locked,
  hasMatch,
  cardFound,
  paused,
  marketPriceUsd,
  priceLoading,
  formatUsd,
  onTapFocus,
  zoom,
  onZoom,
}: {
  scanning: boolean;
  locked: boolean;
  hasMatch: boolean;
  cardFound: boolean;
  paused: boolean;
  marketPriceUsd: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  onTapFocus: (point: { x: number; y: number }) => void;
  zoom: number;
  onZoom: (z: number) => void;
}) {
  // Pinch-to-zoom over the viewfinder (two fingers; single taps still hit
  // the tap-to-focus Pressable below). Sensitivity 0.5 ≈ a comfortable
  // full-range sweep in one pinch; state lives in the parent so the
  // CameraView's `zoom` prop tracks it.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pinchStartRef = useRef(0);
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => {
          pinchStartRef.current = zoomRef.current;
        })
        .onUpdate((e) => {
          const next = Math.max(
            0,
            Math.min(1, pinchStartRef.current + (e.scale - 1) * 0.5),
          );
          onZoom(next);
        }),
    [onZoom],
  );
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
  // commit to a lock: dim mint while hunting, brighter the moment the
  // native card-finder outlines a card, full mint once we have a
  // candidate ≥ 0.5 / lock. This is the Collectr-style "the finder has
  // your card" affordance that the old static bracket lacked.
  const tint =
    locked || hasMatch
      ? palette.accent.mint
      : cardFound
        ? withAlpha(palette.accent.mint, 0.9)
        : withAlpha(palette.accent.mint, 0.5);

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
  const insets = useSafeAreaInsets();
  const cardAspect = 2.5 / 3.5;
  const reservedChrome = insets.top + insets.bottom + 286;
  const maxCardHeight = Math.max(320, winH - reservedChrome);
  const CARD_W = Math.round(Math.min(winW * 0.8, maxCardHeight * cardAspect, 336));
  const CARD_H = Math.round(CARD_W * (3.5 / 2.5));

  return (
    <GestureDetector gesture={pinch}>
    <Pressable
      onPress={handleTap}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      {/* NO scrim. The old grey cutout wash only spanned this middle flex
          region, so it ended in a visible seam right above the shutter —
          and a washed-out live feed is the opposite of a camera. Apple
          Camera frames with chrome, not shade: the corner brackets + this
          hairline card window do the framing over a clean feed. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", height: CARD_H }}>
          <View style={{ flex: 1 }} />
          <View
            style={{
              width: CARD_W,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: withAlpha("#FFFFFF", locked || hasMatch ? 0 : 0.5),
            }}
          />
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ flex: 1 }} />
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
          <CornerBracket
            key={c}
            corner={c}
            color={tint}
            bold={hasMatch || locked || cardFound}
          />
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

      {/* Zoom presets — FLIM/Apple-camera style: always visible above the
          shutter, tap to jump, pinch for anything in between. The nearest
          preset lights up mint; the others sit in small frosted circles. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: 14,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {ZOOM_PRESETS.map((preset) => {
          const active =
            Math.abs(zoom - preset.value) <
            ZOOM_PRESET_TOLERANCE + (preset.value === 0 && zoom < 0.02 ? 0.02 : 0);
          return (
            <Pressable
              key={preset.label}
              onPress={() => onZoom(preset.value)}
              accessibilityRole="button"
              accessibilityLabel={`Zoom ${preset.label}`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                minWidth: active ? 44 : 34,
                height: active ? 34 : 34,
                paddingHorizontal: active ? 12 : 0,
                borderRadius: 999,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? palette.accent.mint : GLASS,
                borderWidth: active ? 0 : 1,
                borderColor: HAIRLINE,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {!active ? (
                <BlurView
                  intensity={BLUR_INTENSITY}
                  tint="dark"
                  style={StyleSheet.absoluteFillObject}
                />
              ) : null}
              <Text
                style={{
                  color: active ? "#06140d" : "rgba(255,255,255,0.88)",
                  fontSize: active ? 13 : 11.5,
                  fontWeight: "800",
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
    </GestureDetector>
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

function CenterMessage({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000", gap: 18 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(palette.accent.mint, 0.12),
          borderWidth: 1,
          borderColor: withAlpha(palette.accent.mint, 0.25),
        }}
      >
        <Camera size={30} color={palette.accent.mint} strokeWidth={1.8} />
      </View>
      <View style={{ alignItems: "center", gap: 10 }}>
        <ActivityIndicator color="#fff" />
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" }}>{label}</Text>
      </View>
    </View>
  );
}
