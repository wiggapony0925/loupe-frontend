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
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  type GestureResponderEvent,
  type DimensionValue,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  ChevronRight,
  Gauge,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { AppNoticeModal } from "@/presentation/components/AppNoticeModal";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { usePublicSparklines } from "@/application/queries/catalog/usePublicSparklines";
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
import { pickCardImageUrl, type ImageVariant } from "@/shared/cardImage";

const CAPTURE_LONG_EDGE = 900;
const CAPTURE_QUALITY = 0.42;
/**
 * Min gap between identify calls. Tightened to 700ms (from 1000ms) for a
 * snappier "results stream as you hover" feel — the backend identify limit
 * was raised to 120/min to match, and most real cards now resolve via the
 * server pHash fast path with no Google Vision call, so the higher cadence
 * doesn't translate into proportional OCR spend. Capture/encode still
 * overlaps the previous request; network identify stays single-flight.
 */
const CAPTURE_INTERVAL_MS = 700;
/** Confidence at which we fire the success haptic + freeze the carousel. */
const LOCK_CONFIDENCE = 0.62;
/** Lowest confidence worth showing as a possible live match. */
const PREVIEW_CONFIDENCE = 0.35;
/** Confidence where tapping a preview should be treated as a real confirm. */
const CONFIRM_CONFIDENCE = 0.45;
/** Lowest candidate worth swapping into a captured-photo session tile. */
const SESSION_RESULT_CONFIDENCE = 0.2;
/**
 * Consecutive frames returning zero preview-worthy candidates
 * before we surface the "can't find a match" fallback CTA. At the
 * CAPTURE_INTERVAL_MS (700ms) cadence — kept under the backend's
 * 120/min identify rate limit so frames stop getting 429'd mid-scan —
 * this works out to ~4s of camera time before the user gets the escape
 * hatch. The live "Scanning…" pulse keeps the surface feeling alive in
 * the meantime.
 */
const NO_MATCH_THRESHOLD = 6;

// ── Native card-detector thresholds ─────────────────────────────────
// These are deliberately conservative: a single bad frame should never
// block identify, but a stretch of obvious blur / glare should suppress
// network calls to save battery + spend. Numbers calibrated against the
// scores returned by the iOS Vision/CoreImage pipeline in
// `LoupeScannerBridgeModule.swift` — `blurScore` is a Laplacian-variance
// log mapping and `glareScore` is a bright-pixel fraction.
//
// Tuned LOOSER than the original (0.55 / 0.6) after field reports of
// "won't scan anything": iOS continuous-AF sticks soft on flat cards
// held close, which kept `blurScore` just over the old gate and made
// the loop reject every single frame forever. We now only suppress on
// *severe* blur/glare and — crucially — force an identify through after
// a short run of skips so the scanner can never get permanently stuck.
const BLUR_REJECT = 0.68;
const GLARE_REJECT = 0.72;
/**
 * After this many consecutive frames skipped for blur/glare we upload
 * the next frame anyway. A soft-but-readable card is far better than a
 * scanner that silently refuses to ever try. The server's OCR is more
 * tolerant of mild blur than this client-side gate assumes.
 */
const FORCE_IDENTIFY_AFTER_SKIPS = 2;

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
// Overlay surfaces are SOLID, not see-through — camera controls have to read
// as real, tappable widgets over a busy, bright viewfinder. GLASS = floating
// pills/controls; GLASS_STRONG = result cards over the busiest backgrounds;
// HAIRLINE = the crisp edge that separates a control from the camera behind it.
const GLASS = "rgba(18,20,25,0.90)";
const GLASS_STRONG = "rgba(9,11,14,0.96)";
const HAIRLINE = "rgba(255,255,255,0.16)";

/** Circular camera overlay button — a solid dark disc with a crisp edge and
 *  a soft drop shadow so it lifts cleanly off the viewfinder (no more
 *  floating, background-less icons). */
function GlassCircle({
  children,
  onPress,
  accessibilityLabel,
  tint = GLASS,
  borderColor = HAIRLINE,
  size = 44,
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor,
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      })}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

function scannerErrorCopy(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("cameraview") ||
    lower.includes("takepicture") ||
    lower.includes("view with tag")
  ) {
    return "Camera lost the preview for a moment. Keep Loupe open, point at the card, and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Loupe could not reach the scanner service. Check your connection and try again.";
  }
  if (lower.includes("monthly budget") || lower.includes("budget")) {
    return "The live OCR fallback is temporarily unavailable. Try search or scan again in better light.";
  }
  return message.length > 150
    ? "Loupe could not scan that frame. Re-frame the card and try again."
    : message;
}

function isTransientCameraCaptureError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("image could not be captured") ||
    lower.includes("cameraview") ||
    lower.includes("takepicture") ||
    lower.includes("camera not ready") ||
    lower.includes("camera is not running") ||
    lower.includes("camera is closed")
  );
}

/**
 * TCG hints surfaced as a chevron pill in the bottom bar. Each carries a
 * brand-ish accent so the pill can show a colored dot for the selected
 * game — a small, modern affordance that also makes a wrong auto-detect
 * (e.g. a Pokémon card read as Yu-Gi-Oh) visible at a glance.
 */
const TCG_OPTIONS: {
  key: IdentifyTcgHint;
  label: string;
  accent: keyof ReturnType<typeof useThemedPalette>["accent"];
}[] = [
  { key: null, label: "Auto-detect", accent: "mint" },
  { key: "pokemon", label: "Pokémon", accent: "amber" },
  { key: "magic", label: "Magic", accent: "blue" },
  { key: "yugioh", label: "Yu-Gi-Oh!", accent: "purple" },
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
   * Called when the user taps "Grade this card" on the locked result sheet —
   * forks into the photometric grade flow for the recognised card. Distinct
   * from `onAddToVault` (log it) — this is "estimate the grade".
   */
  onGrade?: (candidate: IdentifyCandidate, identificationId: string) => void;
  /**
   * Called when the user finalizes a batch ("stack") of scanned cards.
   * The host route bulk-adds each candidate to the vault as a RAW
   * (ungraded) holding, then navigates away. When omitted, the batch
   * tray and its "Add to stack" affordances are hidden entirely.
   */
  onAddBatch?: (candidates: IdentifyCandidate[]) => void;
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

interface ScanSessionItem {
  id: string;
  photoUri: string;
  candidate: IdentifyCandidate | null;
  identificationId: string | null;
  confidence: number | null;
  status: "scanning" | "matched" | "missed";
}

const MAX_SCAN_SESSION_ITEMS = 8;

const EMPTY_STATE: IdentifyState = {
  candidates: [],
  identificationId: null,
  topConfidence: 0,
  primarySource: null,
  locked: false,
  emptyAttempts: 0,
};

/**
 * Stable identity for a candidate, used to de-dupe the batch stack so
 * scanning the same card twice doesn't queue it twice. Falls back to
 * name+number when neither catalog id is resolved yet.
 */
function candidateKey(c: IdentifyCandidate): string {
  return (
    c.card_id ??
    c.upstream_id ??
    `${c.name.toLowerCase()}|${c.number ?? ""}`
  );
}

function upstreamProvider(candidate: IdentifyCandidate): string {
  const upstream = candidate.upstream_id ?? "";
  const colon = upstream.indexOf(":");
  if (colon > 0) return upstream.slice(0, colon).toLowerCase();
  return (candidate.tcg ?? "").toLowerCase();
}

function upstreamCardId(candidate: IdentifyCandidate): string | null {
  const upstream = candidate.upstream_id?.trim();
  if (!upstream) return null;
  const colon = upstream.indexOf(":");
  return colon >= 0 ? upstream.slice(colon + 1) : upstream;
}

function pokemonImageUrl(id: string, hires = false): string | undefined {
  const dash = id.indexOf("-");
  if (dash <= 0 || dash >= id.length - 1) return undefined;
  const setCode = id.slice(0, dash);
  const cardNumber = id.slice(dash + 1);
  const suffix = hires ? "_hires" : "";
  return `https://images.pokemontcg.io/${encodeURIComponent(setCode)}/${encodeURIComponent(cardNumber)}${suffix}.png`;
}

function derivedCandidateImageUrl(
  candidate: IdentifyCandidate,
  variant: ImageVariant,
  fallback = false,
): string | undefined {
  const provider = upstreamProvider(candidate);
  const id = upstreamCardId(candidate);
  if (!id) return undefined;

  if (provider.includes("pokemon") || provider.includes("pokemontcg")) {
    const preferHires = variant === "hero" || variant === "large" || variant === "normal";
    return pokemonImageUrl(id, fallback ? !preferHires : preferHires);
  }

  if (provider.includes("yugioh") || provider.includes("ygopro")) {
    return fallback
      ? `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(id)}.jpg`
      : `https://images.ygoprodeck.com/images/cards/${encodeURIComponent(id)}.jpg`;
  }

  if (provider.includes("magic") || provider.includes("scryfall")) {
    const version = variant === "thumb" || variant === "small" ? "small" : "normal";
    const fallbackVersion = version === "small" ? "normal" : "small";
    return `https://api.scryfall.com/cards/${encodeURIComponent(id)}?format=image&version=${fallback ? fallbackVersion : version}`;
  }

  return undefined;
}

function candidateImageUrls(candidate: IdentifyCandidate, variant: ImageVariant) {
  const derived = derivedCandidateImageUrl(candidate, variant);
  const derivedFallback = derivedCandidateImageUrl(candidate, variant, true);
  const uri = pickCardImageUrl(
    {
      image_url: candidate.image_url ?? derived,
      images: null,
      attributes: {},
    },
    variant,
  );
  const fallbackUri = pickCardImageUrl(
    {
      image_url: candidate.image_url ? derived ?? derivedFallback : derivedFallback,
      images: null,
      attributes: {},
    },
    variant,
  );
  return {
    uri,
    fallbackUri: fallbackUri && fallbackUri !== uri ? fallbackUri : undefined,
  };
}

function candidateSourceLabel(source: string | null | undefined): string {
  const normalized = (source ?? "").toLowerCase();
  if (normalized.includes("phash") || normalized.includes("cache")) return "Instant";
  if (normalized.includes("feedback")) return "Confirmed";
  if (normalized.includes("text") || normalized.includes("ocr")) return "OCR";
  return "Catalog";
}

function CandidateCardImage({
  candidate,
  variant = "small",
  width = "100%",
  height = "100%",
  rounded = 9,
  priority = "normal",
}: {
  candidate: IdentifyCandidate;
  variant?: ImageVariant;
  width?: DimensionValue;
  height?: DimensionValue;
  rounded?: number;
  priority?: "low" | "normal" | "high";
}) {
  const { uri, fallbackUri } = candidateImageUrls(candidate, variant);
  return (
    <CardImage
      uri={uri}
      fallbackUri={fallbackUri}
      width={width}
      height={height}
      rounded={rounded}
      priority={priority}
      recyclingKey={`${candidateKey(candidate)}:${uri ?? "missing"}`}
      alt={candidate.name}
      showSkeleton={false}
      loadTimeoutMs={4500}
      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
    />
  );
}

export function LiveIdentifyFlow({
  onClose,
  onConfirm,
  onAddToVault,
  onGrade,
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
   * The capture loop has two distinct stages with very different
   * runtimes — the camera-bound capture+encode (~50–120ms) and the
    * network-bound identify call, which can take multiple seconds while
    * Google Vision is in the loop.
   * Holding a single lock across both stages serialises the whole
   * pipeline and leaves the camera idle for half the cycle. Splitting
   * them lets the next shutter fire as soon as the current frame's
   * bytes are off-device, overlapping encode/upload with the next
   * capture for roughly a 2x effective frame rate at the same backend
   * load.
   */
  const captureBusyRef = useRef(false);
  const networkBusyRef = useRef(false);
  const activeIdentifyCountRef = useRef(0);
  const captureFailureCountRef = useRef(0);
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
      patch: Partial<Omit<ScanSessionItem, "id" | "photoUri">>,
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
  const showScannerError = useCallback((message: string) => {
    setError(scannerErrorCopy(message));
    setPaused(true);
  }, []);
  /**
   * The batch "stack" — confirmed cards queued up while scanning a pile.
   * Each tap on "Add to stack" pushes the locked candidate here and
   * resets the scanner for the next card. Finalized together via
   * `onAddBatch`. De-duplicated by `candidateKey`.
   */
  const [batch, setBatch] = useState<IdentifyCandidate[]>([]);
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
  /**
   * Consecutive frames skipped by the blur/glare gate. Once this hits
   * `FORCE_IDENTIFY_AFTER_SKIPS` we upload the next frame regardless so
   * the scanner can never get permanently wedged on a soft preview
   * (the classic iOS stuck-autofocus failure mode).
   */
  const skippedFramesRef = useRef(0);
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

  // ─── Capture loop ────────────────────────────────────────────────
  // We deliberately drive the loop from a ref-guarded setTimeout chain
  // instead of setInterval — interval would happily stack calls when a
  // request takes longer than the cadence, melting both phone and
  // backend.
  // Two-stage pipeline. The camera-bound capture+encode (~50-120ms)
  // and the network-bound identify call get separate locks so a frame's
  // shutter can fire while the
  // previous frame is still uploading. This roughly doubles the
  // effective frame rate at the same backend load. We still cap
  // network concurrency at 1 so we never stack identify requests.
  const runIdentify = useCallback(
    async (
      uri: string,
      providedHash: string | null = null,
      scanItemId: string | null = null,
    ) => {
      const manualCapture = scanItemId != null;
      if (!manualCapture && networkBusyRef.current) return;
      if (!manualCapture) networkBusyRef.current = true;
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
                clientProvider: "mlkit",
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
            identificationId: hasPreviewMatch
              ? res.identification_id
              : prev.identificationId,
            topConfidence: hasPreviewMatch ? top : prev.topConfidence,
            primarySource: hasPreviewMatch ? res.primary_source : prev.primarySource,
            locked: prev.locked || justLocked,
            emptyAttempts: hasPreviewMatch ? 0 : prev.emptyAttempts + 1,
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
        if (!manualCapture) networkBusyRef.current = false;
        activeIdentifyCountRef.current = Math.max(0, activeIdentifyCountRef.current - 1);
        if (!cancelledRef.current && activeIdentifyCountRef.current === 0) {
          setScanning(false);
        }
      }
    },
    [tcgHint, showScannerError, updateScanSessionItem],
  );

  const captureOnce = useCallback(async (recordSessionItem = false) => {
    if (cancelledRef.current || captureBusyRef.current) return;
    const camera = cameraRef.current;
    if (!camera || !cameraReady) return;
    captureBusyRef.current = true;
    setError(null);
    try {
      const photo = await camera.takePictureAsync({
        quality: CAPTURE_QUALITY,
        skipProcessing: Platform.OS === "android",
        exif: false,
      });
      if (!photo || cancelledRef.current) {
        captureBusyRef.current = false;
        return;
      }
      captureFailureCountRef.current = 0;
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
      const scanItemId = recordSessionItem ? addScanSessionItem(processed.uri) : null;

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
        updateCardFound(report.corners != null);
        // We only HARD-skip a frame when blur/glare is severe AND we
        // haven't already skipped a run of frames. The forced-through
        // path guarantees the scanner always makes progress even on a
        // soft preview (stuck iOS autofocus), trading a little extra
        // OCR spend for never appearing "broken".
        const severelyBlurred = report.blurScore > BLUR_REJECT;
        const severeGlare = report.glareScore > GLARE_REJECT;
        const mustForce =
          skippedFramesRef.current >= FORCE_IDENTIFY_AFTER_SKIPS;
        if (!report.corners) {
          // Don't yell at the user immediately — first 1-2 frames
          // often miss while they're framing. The capture loop fires
          // every CAPTURE_INTERVAL_MS so this self-corrects fast. We
          // still upload the full frame so a card the detector can't
          // outline (busy background, odd angle) can still be read.
          updateDetectorHint("Hold steady / reduce glare");
        } else if ((severelyBlurred || severeGlare) && !mustForce && !scanItemId) {
          skippedFramesRef.current += 1;
          updateDetectorHint(
            severeGlare ? "Reduce glare / tilt the card" : "Hold steady",
          );
          return; // Skip identify; next frame in CAPTURE_INTERVAL_MS.
        } else {
          skippedFramesRef.current = 0;
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

      // Fire-and-forget; network concurrency is gated by networkBusyRef.
      // If a previous identify is still in flight we drop this frame
      // (the next is only ~CAPTURE_INTERVAL_MS away).
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
        }).catch(() => {});
      }
      onConfirm?.(candidate, id ?? "");
    },
    [onConfirm],
  );

  const handleRescan = useCallback(() => {
    setState(EMPTY_STATE);
    setError(null);
    setPaused(false);
    setCameraReady(false);
    setCameraKey((key) => key + 1);
    captureFailureCountRef.current = 0;
    skippedFramesRef.current = 0;
    updateDetectorHint(null);
    updateCardFound(false);
  }, [updateCardFound, updateDetectorHint]);

  const handleManualCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState(EMPTY_STATE);
    setError(null);
    setPaused(false);
    void captureOnce(true);
  }, [captureOnce]);

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

  const handleGrade = useCallback(
    (candidate: IdentifyCandidate) => {
      Haptics.selectionAsync().catch(() => {});
      onGrade?.(candidate, state.identificationId ?? "");
    },
    [state.identificationId, onGrade],
  );

  // ─── Batch stack ─────────────────────────────────────────────────
  // Push the current card onto the stack, record positive feedback,
  // then reset the scanner so the next card in the pile can be read.
  const handleAddToBatch = useCallback(
    (candidate: IdentifyCandidate) => {
      const id = state.identificationId;
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      if (id) {
        submitIdentifyFeedback(id, {
          correct: true,
          chosen_card_id: candidate.card_id,
        }).catch(() => {});
      }
      setBatch((prev) =>
        prev.some((c) => candidateKey(c) === candidateKey(candidate))
          ? prev
          : [...prev, candidate],
      );
      setState(EMPTY_STATE);
      setError(null);
      setPaused(false);
    },
    [state.identificationId],
  );

  const handleRemoveFromBatch = useCallback((key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setBatch((prev) => prev.filter((c) => candidateKey(c) !== key));
  }, []);

  const handleFinishBatch = useCallback(() => {
    if (batch.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    onAddBatch?.(batch);
    setBatch([]);
  }, [batch, onAddBatch]);

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
  // 1-year trend for the locked card — drives the Robinhood-style
  // green/red delta line under the hero price. Only our backend snapshot
  // carries it; the Pokémon TCG fallback has no history, so this stays
  // null for cache/upstream-only matches and the delta line is hidden.
  const marketChangePct1y = market.data?.snapshot.summary.change_pct_1y ?? null;
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
        flash={flashOn ? "on" : "off"}
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
        batch={batch}
        scanSession={scanSession}
        batchEnabled={onAddBatch != null}
        marketPriceUsd={marketPriceUsd}
        marketChangePct1y={marketChangePct1y}
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
          skippedFramesRef.current = 0;
          updateCardFound(false);
        }}
        onPickCandidate={handlePick}
        onAddToVault={handleAddToVault}
        onGrade={handleGrade}
        onAddToBatch={handleAddToBatch}
        onRemoveFromBatch={handleRemoveFromBatch}
        onPickScanSessionItem={handlePickScanSessionItem}
        onRemoveScanSessionItem={removeScanSessionItem}
        onFinishBatch={handleFinishBatch}
        onRescan={handleRescan}
        onManualCapture={handleManualCapture}
        onManualSearch={onManualSearch}
        onTapFocus={refocus}
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
  batch,
  scanSession,
  batchEnabled,
  marketPriceUsd,
  marketChangePct1y,
  priceLoading,
  formatUsd,
  palette: themed,
  onClose,
  onToggleFlash,
  onOpenTcgPicker,
  onCloseTcgPicker,
  onPickTcg,
  onPickCandidate,
  onAddToVault,
  onGrade,
  onAddToBatch,
  onRemoveFromBatch,
  onPickScanSessionItem,
  onRemoveScanSessionItem,
  onFinishBatch,
  onRescan,
  onManualCapture,
  onManualSearch,
  onTapFocus,
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
  batch: IdentifyCandidate[];
  scanSession: ScanSessionItem[];
  batchEnabled: boolean;
  marketPriceUsd: number | null;
  marketChangePct1y: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  palette: ReturnType<typeof useThemedPalette>;
  onClose: () => void;
  onToggleFlash: () => void;
  onOpenTcgPicker: () => void;
  onCloseTcgPicker: () => void;
  onPickTcg: (t: IdentifyTcgHint) => void;
  onPickCandidate: (c: IdentifyCandidate) => void;
  onAddToVault: (c: IdentifyCandidate) => void;
  onGrade: (c: IdentifyCandidate) => void;
  onAddToBatch: (c: IdentifyCandidate) => void;
  onRemoveFromBatch: (key: string) => void;
  onPickScanSessionItem: (item: ScanSessionItem) => void;
  onRemoveScanSessionItem: (id: string) => void;
  onFinishBatch: () => void;
  onRescan: () => void;
  onManualCapture: () => void;
  onManualSearch?: () => void;
  onTapFocus: (point: { x: number; y: number }) => void;
}) {
  const hasMatch = state.candidates.some((c) => c.confidence >= PREVIEW_CONFIDENCE);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      pointerEvents="box-none"
      style={{ ...StyleSheet.absoluteFillObject, justifyContent: "space-between" }}
    >
      <TopBar
        onClose={onClose}
        flashOn={flashOn}
        locked={state.locked}
        hasMatch={hasMatch}
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
      />

      <BottomPanel
        state={state}
        error={null}
        detectorHint={detectorHint}
        tcgHint={tcgHint}
        tcgPickerOpen={tcgPickerOpen}
        onCloseTcgPicker={onCloseTcgPicker}
        onPickTcg={onPickTcg}
        onPickCandidate={onPickCandidate}
        onAddToVault={onAddToVault}
        onGrade={onGrade}
        batch={batch}
        scanSession={scanSession}
        batchEnabled={batchEnabled}
        onAddToBatch={onAddToBatch}
        onRemoveFromBatch={onRemoveFromBatch}
        onPickScanSessionItem={onPickScanSessionItem}
        onRemoveScanSessionItem={onRemoveScanSessionItem}
        onFinishBatch={onFinishBatch}
        onRescan={onRescan}
        onManualCapture={onManualCapture}
        onManualSearch={onManualSearch}
        scanning={scanning}
        marketPriceUsd={marketPriceUsd}
        marketChangePct1y={marketChangePct1y}
        priceLoading={priceLoading}
        formatUsd={formatUsd}
        palette={themed}
      />
      <AppNoticeModal
        visible={error != null}
        variant="danger"
        title="Could not scan that frame"
        message={error ?? undefined}
        primaryAction={{ label: "Try again", onPress: onRescan }}
        secondaryAction={
          onManualSearch ? { label: "Search manually", onPress: onManualSearch } : undefined
        }
        onClose={onRescan}
      />
    </SafeAreaView>
  );
}

function TopBar({
  onClose,
  flashOn,
  locked,
  hasMatch,
  onToggleFlash,
  tcgHint,
  onOpenTcgPicker,
  palette: themed,
}: {
  onClose: () => void;
  flashOn: boolean;
  locked: boolean;
  hasMatch: boolean;
  onToggleFlash: () => void;
  tcgHint: IdentifyTcgHint;
  onOpenTcgPicker: () => void;
  palette: ReturnType<typeof useThemedPalette>;
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

  const tcgOption = TCG_OPTIONS.find((o) => o.key === tcgHint) ?? TCG_OPTIONS[0]!;
  const tcgColor = themed.accent[tcgOption.accent];
  const status = locked
    ? "Locked in"
    : hasMatch
      ? "Match found"
      : "Looking for a card…";

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
      <View className="flex-row items-center justify-between">
        <GlassCircle onPress={onClose} accessibilityLabel="Close scanner" size={46}>
          <X size={24} color="#fff" strokeWidth={2.4} />
        </GlassCircle>

        {/* Game selector — front and center, the way a pro scanner leads with
            "what am I scanning?" (Collectr's "Trading Card Games ▼"). Tapping
            opens the picker sheet mounted in the bottom panel. */}
        <Pressable
          onPress={onOpenTcgPicker}
          accessibilityRole="button"
          accessibilityLabel={`Game: ${tcgOption.label}. Tap to change.`}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 14,
              paddingRight: 12,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: GLASS,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: HAIRLINE,
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tcgColor }}
            />
            <Text
              style={{
                color: "#fff",
                fontWeight: "800",
                fontSize: 14.5,
                letterSpacing: 0.1,
              }}
            >
              {tcgOption.label}
            </Text>
            <ChevronDown size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.4} />
          </View>
        </Pressable>

        <GlassCircle
          onPress={onToggleFlash}
          accessibilityLabel={flashOn ? "Turn flash off" : "Turn flash on"}
          size={46}
          tint={flashOn ? withAlpha(themed.accent.amber, 0.22) : GLASS}
          borderColor={flashOn ? withAlpha(themed.accent.amber, 0.55) : HAIRLINE}
        >
          {flashOn ? (
            <Zap size={23} color={themed.accent.amber} strokeWidth={2.4} />
          ) : (
            <ZapOff size={23} color="#fff" strokeWidth={2.2} />
          )}
        </GlassCircle>
      </View>

      {/* Slim live-status line under the header — subtle feedback, doesn't
          compete with the game selector or the bottom result card. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Animated.View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor:
              locked || hasMatch ? themed.accent.mint : "rgba(255,255,255,0.8)",
            opacity: dot,
          }}
        />
        <Text
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.2,
            textShadowColor: "rgba(0,0,0,0.6)",
            textShadowRadius: 6,
          }}
        >
          {status}
        </Text>
      </View>
    </View>
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

  // A subtle cutout scrim darkens everything OUTSIDE the card window so the
  // eye lands squarely on the card and the floating controls read cleanly —
  // the Collectr / Google Lens frame. Kept gentle (not a heavy grey wash) so
  // the live feed stays clearly visible; it lifts slightly once we lock.
  const scrim = withAlpha("#000000", locked || hasMatch ? 0.2 : 0.34);

  return (
    <Pressable
      onPress={handleTap}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      {/* Four panels around an explicitly-sized clear window — no masking
          library needed, stays pixel-aligned with the brackets. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: scrim }} />
        <View style={{ flexDirection: "row", height: CARD_H }}>
          <View style={{ flex: 1, backgroundColor: scrim }} />
          <View
            style={{
              width: CARD_W,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: withAlpha("#FFFFFF", locked || hasMatch ? 0 : 0.5),
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
  onCloseTcgPicker,
  onPickTcg,
  onPickCandidate,
  onAddToVault,
  onGrade,
  batch,
  scanSession,
  batchEnabled,
  onAddToBatch,
  onRemoveFromBatch,
  onPickScanSessionItem,
  onRemoveScanSessionItem,
  onFinishBatch,
  onRescan,
  onManualCapture,
  onManualSearch,
  scanning,
  marketPriceUsd,
  marketChangePct1y,
  priceLoading,
  formatUsd,
  palette: themed,
}: {
  state: IdentifyState;
  error: string | null;
  detectorHint: string | null;
  tcgHint: IdentifyTcgHint;
  tcgPickerOpen: boolean;
  onCloseTcgPicker: () => void;
  onPickTcg: (t: IdentifyTcgHint) => void;
  onPickCandidate: (c: IdentifyCandidate) => void;
  onAddToVault: (c: IdentifyCandidate) => void;
  onGrade: (c: IdentifyCandidate) => void;
  batch: IdentifyCandidate[];
  scanSession: ScanSessionItem[];
  batchEnabled: boolean;
  onAddToBatch: (c: IdentifyCandidate) => void;
  onRemoveFromBatch: (key: string) => void;
  onPickScanSessionItem: (item: ScanSessionItem) => void;
  onRemoveScanSessionItem: (id: string) => void;
  onFinishBatch: () => void;
  onRescan: () => void;
  onManualCapture: () => void;
  onManualSearch?: () => void;
  scanning: boolean;
  marketPriceUsd: number | null;
  marketChangePct1y: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const shutterLocked = state.locked;
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compactLockedSheet = screenHeight < 760 || batch.length > 0;
  const hasScanSession = scanSession.length > 0;

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
      colors={["transparent", "rgba(0,0,0,0.72)", "rgba(0,0,0,0.96)"]}
      locations={[0, 0.24, 1]}
      style={{
        paddingHorizontal: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 12,
        gap: 8,
      }}
    >
      <TcgPickerSheet
        visible={tcgPickerOpen}
        selected={tcgHint}
        onSelect={(t) => onPickTcg(t)}
        onClose={onCloseTcgPicker}
        themed={themed}
      />

      {state.locked && state.candidates[0] && !hasScanSession ? (
        <LockedResultSheet
          candidate={state.candidates[0]}
          candidates={state.candidates}
          confidence={state.topConfidence}
          marketPriceUsd={marketPriceUsd}
          marketChangePct1y={marketChangePct1y}
          priceLoading={priceLoading}
          formatUsd={formatUsd}
          themed={themed}
          batchEnabled={batchEnabled}
          compact={compactLockedSheet}
          onViewDetails={() => {
            const c = state.candidates[0];
            if (c) onPickCandidate(c);
          }}
          onPickAlternate={onPickCandidate}
          onAddToVault={() => {
            const c = state.candidates[0];
            if (c) onAddToVault(c);
          }}
          onGrade={() => {
            const c = state.candidates[0];
            if (c) onGrade(c);
          }}
          onAddToBatch={() => {
            const c = state.candidates[0];
            if (c) onAddToBatch(c);
          }}
          onRescan={onRescan}
        />
      ) : !hasScanSession ? (
        <ResultArea
          state={state}
          error={error}
          detectorHint={detectorHint}
          scanning={scanning}
          onPickCandidate={onPickCandidate}
          onRescan={onRescan}
          onManualSearch={onManualSearch}
          themed={themed}
        />
      ) : null}

      {batchEnabled && batch.length > 0 ? (
        <BatchTray
          batch={batch}
          themed={themed}
          formatUsd={formatUsd}
          onPick={onPickCandidate}
          onRemove={onRemoveFromBatch}
          onFinish={onFinishBatch}
        />
      ) : null}

      {hasScanSession ? (
        <ScanSessionTray
          items={scanSession}
          themed={themed}
          formatUsd={formatUsd}
          onPick={onPickScanSessionItem}
          onRemove={onRemoveScanSessionItem}
          onSearchManually={onManualSearch}
        />
      ) : null}

      <View style={{ height: 76, justifyContent: "center", paddingTop: 2 }}>
        {/* Manual shutter — the single bright focal point. Picks up a mint
            ring + glow the instant we lock so the control reflects state.
            The game selector now lives in the top bar, so the shutter owns
            the center and the search escape hatch sits on the right. */}
        <View style={{ width: 68, height: 68, alignSelf: "center", alignItems: "center", justifyContent: "center" }}>
          {shutterLocked ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 68,
                height: 68,
                borderRadius: 34,
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
              width: 68,
              height: 68,
              borderRadius: 34,
              borderWidth: 3.5,
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
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: shutterLocked ? palette.accent.mint : "#fff",
              }}
            />
          </Pressable>
          {batchEnabled && batch.length > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 24,
                height: 24,
                paddingHorizontal: 7,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.accent.mint,
                borderWidth: 2,
                borderColor: "rgba(0,0,0,0.82)",
              }}
            >
              <Text
                style={{
                  color: "#08110D",
                  fontSize: 11,
                  fontWeight: "900",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {batch.length}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right cluster — manual search escape hatch. */}
        <View style={{ position: "absolute", right: 2, top: 14, alignItems: "flex-end" }}>
          <Pressable
            onPress={onManualSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search the catalog manually"
            disabled={!onManualSearch}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: GLASS,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: HAIRLINE,
              opacity: pressed ? 0.82 : onManualSearch ? 1 : 0.4,
              transform: [{ scale: pressed ? 0.94 : 1 }],
              shadowColor: "#000",
              shadowOpacity: 0.5,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            })}
          >
            <Search size={25} color="#fff" strokeWidth={2.2} />
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
 *   • preview-match  — at least one preview-worthy candidate, not yet locked.
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
  themed,
}: {
  state: IdentifyState;
  error: string | null;
  detectorHint: string | null;
  scanning: boolean;
  onPickCandidate: (c: IdentifyCandidate) => void;
  onRescan: () => void;
  onManualSearch?: () => void;
  themed: ReturnType<typeof useThemedPalette>;
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

  const visible = state.candidates.filter((c) => c.confidence >= PREVIEW_CONFIDENCE);
  const top = visible[0];

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
      return (
        <NoMatchCard
          onManualSearch={onManualSearch}
          onRescan={onRescan}
          themed={themed}
        />
      );
    }
    return <HintPill label="Scanning…" pulse />;
  }

  return <PreviewMatchTray candidates={visible} onPickCandidate={onPickCandidate} />;
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
function PreviewMatchTray({
  candidates,
  onPickCandidate,
}: {
  candidates: IdentifyCandidate[];
  onPickCandidate: (c: IdentifyCandidate) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 2, gap: 10 }}
    >
      {candidates.slice(0, 6).map((candidate, index) => (
        <PreviewMatchCard
          key={`${candidateKey(candidate)}:${index}`}
          candidate={candidate}
          primary={index === 0}
          onConfirm={() => onPickCandidate(candidate)}
        />
      ))}
    </ScrollView>
  );
}

function PreviewMatchCard({
  candidate,
  primary,
  onConfirm,
}: {
  candidate: IdentifyCandidate;
  primary: boolean;
  onConfirm: () => void;
}) {
  const confidencePct = Math.round(candidate.confidence * 100);
  const confidenceLabel =
    candidate.confidence >= 0.5 ? `${confidencePct}% MATCH` : `${confidencePct}% POSSIBLE`;
  const confirmable = candidate.confidence >= CONFIRM_CONFIDENCE;
  const setMeta = [candidate.set_name, candidate.number ? `#${candidate.number}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={confirmable ? onConfirm : undefined}
      accessibilityRole="button"
      accessibilityLabel={
        confirmable
          ? `Tap to confirm match: ${candidate.name}`
          : `Possible match: ${candidate.name}`
      }
      style={({ pressed }) => ({
        width: primary ? 292 : 238,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: primary ? withAlpha(palette.accent.mint, 0.24) : HAIRLINE,
        opacity: pressed && confirmable ? 0.85 : 1,
      })}
    >
      <BlurView
        intensity={28}
        tint="dark"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 10,
          backgroundColor: GLASS_STRONG,
        }}
      >
      <View
        style={{
          width: primary ? 48 : 42,
          aspectRatio: 2.5 / 3.5,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        <CandidateCardImage
          candidate={candidate}
          variant="small"
          rounded={8}
          priority="high"
        />
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
              color: confirmable ? palette.accent.mint : palette.accent.amber,
              fontSize: 9.5,
              fontWeight: "800",
              letterSpacing: 1.2,
            }}
          >
            {confidenceLabel} · {confirmable ? "TAP TO CONFIRM" : "KEEP SCANNING"}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ color: "#fff", fontSize: primary ? 14.5 : 13, fontWeight: "700", letterSpacing: 0 }}
        >
          {candidate.name}
        </Text>
        {setMeta ? (
          <Text
            numberOfLines={1}
            style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: "500" }}
          >
            {setMeta}
          </Text>
        ) : null}
        {!confirmable ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.42)",
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
            }}
          >
            Waiting for a cleaner read
          </Text>
        ) : null}
      </View>

      {confirmable ? <ChevronRight size={17} color="rgba(255,255,255,0.5)" /> : null}
      </BlurView>
    </Pressable>
  );
}

function NoMatchCard({
  onManualSearch,
  onRescan,
  themed,
}: {
  onManualSearch?: () => void;
  onRescan: () => void;
  themed: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <View
      style={{
        padding: 13,
        borderRadius: 18,
        backgroundColor: GLASS_STRONG,
        borderWidth: 1,
        borderColor: withAlpha(themed.accent.amber, 0.28),
        gap: 8,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
        Still searching
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: 17 }}>
        Hold the card flat inside the corners, tap the shutter for a sharper frame,
        or search by name.
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
              backgroundColor: themed.accent.mint,
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
            borderColor: withAlpha("#fff", 0.16),
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
  themed,
}: {
  visible: boolean;
  selected: IdentifyTcgHint;
  onSelect: (t: IdentifyTcgHint) => void;
  onClose: () => void;
  themed: ReturnType<typeof useThemedPalette>;
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
              backgroundColor: themed.bg.elevated,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 10,
              paddingBottom: Platform.OS === "ios" ? 8 : 16,
              borderTopWidth: 1,
              borderColor: themed.line.default,
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", paddingBottom: 6 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: withAlpha(themed.ink.default, 0.22),
                }}
              />
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
              <Text
                style={{
                  color: themed.ink.dim,
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
                  color: themed.ink.default,
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 4,
                }}
              >
                Identify cards from
              </Text>
            </View>

            <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
              {TCG_OPTIONS.map((o) => {
                const active = o.key === selected;
                const optionColor = themed.accent[o.accent];
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
                        ? withAlpha(optionColor, 0.14)
                        : pressed
                          ? withAlpha(themed.ink.default, 0.05)
                          : "transparent",
                      borderWidth: 1,
                      borderColor: active
                        ? withAlpha(optionColor, 0.4)
                        : themed.line.default,
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
                          ? optionColor
                          : withAlpha(themed.ink.default, 0.08),
                      }}
                    >
                      {active ? (
                        <Check size={16} color="#0B0B0D" strokeWidth={3} />
                      ) : (
                        <Sparkles size={14} color={withAlpha(themed.ink.default, 0.55)} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: themed.ink.default,
                          fontSize: 15,
                          fontWeight: active ? "700" : "600",
                        }}
                      >
                        {o.label}
                      </Text>
                      {o.key === null ? (
                        <Text
                          style={{
                            color: themed.ink.muted,
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

// ─────────────── Batch stack tray ───────────────
// A scrollable, frosted strip of the cards queued up while scanning a
// pile. Sits above the control row whenever the stack is non-empty so
// the user can review what's been captured, prune mistakes, and add the
// whole batch to the vault in one tap.

function BatchTray({
  batch,
  themed,
  formatUsd,
  onPick,
  onRemove,
  onFinish,
}: {
  batch: IdentifyCandidate[];
  themed: ReturnType<typeof useThemedPalette>;
  formatUsd: (v: number) => string;
  onPick: (candidate: IdentifyCandidate) => void;
  onRemove: (key: string) => void;
  onFinish: () => void;
}) {
  const count = batch.length;
  // Live running total — the Collectr signature. One batch request prices
  // the whole cart; unpriced cards simply don't count toward the total.
  const ids = batch
    .map((c) => c.upstream_id ?? c.card_id)
    .filter((id): id is string => id != null);
  const { priceOf, totalUsd } = usePublicSparklines(ids);
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: withAlpha(themed.accent.mint, 0.2),
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <BlurView
        intensity={24}
        tint="dark"
        style={{ backgroundColor: GLASS_STRONG, paddingTop: 10, paddingBottom: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            marginBottom: 8,
            gap: 10,
          }}
        >
          <View style={{ gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Layers size={15} color={themed.accent.mint} />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                Scan cart
              </Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 10, fontWeight: "700" }}>
              {count} card{count === 1 ? "" : "s"} ready
            </Text>
          </View>
          {totalUsd != null ? (
            <View style={{ flex: 1, alignItems: "flex-end", gap: 1 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.48)",
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                }}
              >
                TOTAL
              </Text>
              <Text
                style={{
                  color: themed.accent.mint,
                  fontSize: 17,
                  fontWeight: "900",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -0.3,
                }}
              >
                {formatUsd(totalUsd)}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            onPress={onFinish}
            accessibilityRole="button"
            accessibilityLabel={`Add all ${count} cards to vault`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: withAlpha(themed.accent.mint, 0.96),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Plus size={14} color="#08110D" />
            <Text style={{ color: "#08110D", fontWeight: "800", fontSize: 13 }}>
              Add all
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          {batch.map((c) => {
            const key = candidateKey(c);
            const confidencePct = Math.round(c.confidence * 100);
            const price = priceOf(c.upstream_id ?? c.card_id);
            return (
              <Pressable
                key={key}
                onPress={() => onPick(c)}
                accessibilityRole="button"
                accessibilityLabel={`View ${c.name} from scan cart`}
                style={({ pressed }) => ({
                  width: 68,
                  alignItems: "center",
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <View style={{ width: 68, height: 94 }}>
                  <CandidateCardImage
                    candidate={c}
                    variant="thumb"
                    width={68}
                    height={94}
                    rounded={10}
                    priority="low"
                  />
                  {/* Price when we know it (the number the user actually
                      cares about in a cart); confidence % until then. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 4,
                      bottom: 4,
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: "rgba(0,0,0,0.78)",
                      borderWidth: 1,
                      borderColor: withAlpha(themed.accent.mint, 0.35),
                    }}
                  >
                    <Text
                      style={{
                        color: price != null ? themed.accent.mint : "#fff",
                        fontSize: 8.5,
                        fontWeight: "900",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {price != null ? formatUsd(price) : `${confidencePct}%`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onRemove(key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${c.name} from stack`}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "rgba(8,8,10,0.92)",
                      borderWidth: 1,
                      borderColor: withAlpha("#fff", 0.18),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={13} color="#fff" />
                  </Pressable>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 10,
                    fontWeight: "600",
                    marginTop: 4,
                    maxWidth: 68,
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </BlurView>
    </View>
  );
}

function ScanSessionTray({
  items,
  themed,
  formatUsd,
  onPick,
  onRemove,
  onSearchManually,
}: {
  items: ScanSessionItem[];
  themed: ReturnType<typeof useThemedPalette>;
  formatUsd: (v: number) => string;
  onPick: (item: ScanSessionItem) => void;
  onRemove: (id: string) => void;
  onSearchManually?: () => void;
}) {
  const matched = items.filter((i) => i.status === "matched" && i.candidate != null);
  // Running session total — one batch request prices every matched capture.
  const ids = matched
    .map((i) => i.candidate?.upstream_id ?? i.candidate?.card_id)
    .filter((id): id is string => id != null);
  const { totalUsd } = usePublicSparklines(ids);
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: withAlpha("#fff", 0.12),
        backgroundColor: GLASS_STRONG,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingTop: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Camera size={14} color={themed.accent.mint} strokeWidth={2.2} />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
            This session
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {matched.length}/{items.length} matched
          </Text>
        </View>
        {totalUsd != null ? (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.48)",
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 1.1,
              }}
            >
              TOTAL
            </Text>
            <Text
              style={{
                color: themed.accent.mint,
                fontSize: 16,
                fontWeight: "900",
                fontVariant: ["tabular-nums"],
                letterSpacing: -0.3,
              }}
            >
              {formatUsd(totalUsd)}
            </Text>
          </View>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 10,
          paddingVertical: 10,
          gap: 10,
          alignItems: "stretch",
        }}
      >
        {items.map((item, index) => (
          <ScanSessionCard
            key={item.id}
            item={item}
            index={index}
            themed={themed}
            onPick={onPick}
            onRemove={onRemove}
            onSearchManually={onSearchManually}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ScanSessionCard({
  item,
  index,
  themed,
  onPick,
  onRemove,
  onSearchManually,
}: {
  item: ScanSessionItem;
  index: number;
  themed: ReturnType<typeof useThemedPalette>;
  onPick: (item: ScanSessionItem) => void;
  onRemove: (id: string) => void;
  onSearchManually?: () => void;
}) {
  const matched = item.status === "matched" && item.candidate != null;
  const missed = item.status === "missed";
  const confidencePct = item.confidence != null ? Math.round(item.confidence * 100) : null;
  const title = matched
    ? item.candidate?.name ?? "Matched card"
    : missed
      ? "No match found"
      : "Reading photo";
  // A missed capture must never be a dead end — tapping it opens manual
  // search (the Collectr "Tap here to search manually" affordance).
  const subtitle = matched
    ? `${confidencePct ?? 0}% match`
    : missed
      ? onSearchManually
        ? "Tap to search manually"
        : "Try another angle"
      : "Photo captured";

  return (
    <Pressable
      onPress={
        matched
          ? () => onPick(item)
          : missed && onSearchManually
            ? onSearchManually
            : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={
        matched
          ? `Open scanned card ${title}`
          : missed && onSearchManually
            ? "No match found. Search the catalog manually."
            : `Captured scan ${index + 1}`
      }
      style={({ pressed }) => ({
        width: 190,
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 9,
        borderRadius: 16,
        backgroundColor: matched ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: matched
          ? withAlpha(themed.accent.mint, 0.28)
          : missed
            ? withAlpha(themed.accent.amber, 0.3)
            : withAlpha("#fff", 0.08),
        opacity: pressed && (matched || (missed && onSearchManually)) ? 0.76 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          aspectRatio: 2.5 / 3.5,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          borderColor: withAlpha("#fff", 0.08),
        }}
      >
        {matched && item.candidate ? (
          <CandidateCardImage
            candidate={item.candidate}
            variant="thumb"
            rounded={8}
            priority="normal"
          />
        ) : (
          <Image
            source={{ uri: item.photoUri }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: matched
                ? themed.accent.mint
                : item.status === "missed"
                  ? themed.accent.amber
                  : themed.accent.blue,
            }}
          />
          <Text
            style={{
              color: "rgba(255,255,255,0.54)",
              fontSize: 9,
              fontWeight: "900",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {matched ? "Scanned" : item.status === "missed" ? "Needs retry" : "Processing"}
          </Text>
        </View>
        <Text numberOfLines={2} style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color:
              missed && onSearchManually
                ? themed.accent.mint
                : "rgba(255,255,255,0.52)",
            fontSize: 10.5,
            fontWeight: missed && onSearchManually ? "800" : "600",
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Pressable
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove captured scan ${index + 1}`}
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.48)",
        }}
      >
        <X size={12} color="rgba(255,255,255,0.88)" />
      </Pressable>
    </Pressable>
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
  marketChangePct1y,
  priceLoading,
  formatUsd,
  themed,
  batchEnabled,
  compact,
  onViewDetails,
  onPickAlternate,
  onAddToVault,
  onGrade,
  onAddToBatch,
  onRescan,
}: {
  candidate: IdentifyCandidate;
  candidates: IdentifyCandidate[];
  confidence: number;
  marketPriceUsd: number | null;
  marketChangePct1y: number | null;
  priceLoading: boolean;
  formatUsd: (v: number) => string;
  themed: ReturnType<typeof useThemedPalette>;
  batchEnabled: boolean;
  compact: boolean;
  onViewDetails: () => void;
  onPickAlternate: (c: IdentifyCandidate) => void;
  onAddToVault: () => void;
  onGrade: () => void;
  onAddToBatch: () => void;
  onRescan: () => void;
}) {
  const confidencePct = Math.round(confidence * 100);
  const setMeta = [candidate.set_name, candidate.number ? `#${candidate.number}` : null]
    .filter(Boolean)
    .join(" · ");
  const sourceLabel = candidateSourceLabel(candidate.source);
  // Robinhood-style trend: green up / red down delta line under the
  // hero price. Hidden when we have no history (cache / upstream-only).
  const hasTrend = marketChangePct1y != null && Number.isFinite(marketChangePct1y);
  const trendUp = (marketChangePct1y ?? 0) >= 0;
  const trendColor = trendUp ? palette.accent.mint : palette.accent.rose;
  // Alternate printings: every candidate after the locked top. Critical
  // for reprint ties (e.g. Base Set vs Base Set 2 Charizard share name +
  // number + art) where the auto-lock can't tell two near-identical
  // printings apart — the user picks the exact one they're holding.
  const alternates = candidates.slice(1, compact ? 4 : 7);

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

  const heroImageWidth = compact ? 70 : 78;
  const altWidth = compact ? 72 : 82;

  return (
    <Animated.View
      style={{
        backgroundColor: GLASS_STRONG,
        borderRadius: 22,
        padding: compact ? 12 : 14,
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.mint, 0.18),
        gap: compact ? 10 : 14,
        shadowColor: palette.accent.mint,
        shadowOpacity: 0.12,
        shadowRadius: 18,
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
            width: heroImageWidth,
            aspectRatio: 2.5 / 3.5,
            borderRadius: 11,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <CandidateCardImage
            candidate={candidate}
            variant="normal"
            rounded={11}
            priority="high"
          />
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
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: withAlpha("#fff", 0.08),
                  borderWidth: 1,
                  borderColor: withAlpha("#fff", 0.1),
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: "800" }}>
                  {sourceLabel}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: "#fff",
                fontSize: compact ? 16 : 17,
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
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: compact ? 24 : 28,
                    fontWeight: "800",
                    letterSpacing: -0.8,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatUsd(marketPriceUsd)}
                </Text>
                {hasTrend ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 2,
                      paddingBottom: 3,
                    }}
                  >
                    <Text style={{ color: trendColor, fontSize: 12, fontWeight: "800" }}>
                      {trendUp ? "▲" : "▼"}
                    </Text>
                    <Text
                      style={{
                        color: trendColor,
                        fontSize: 13,
                        fontWeight: "800",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {Math.abs(marketChangePct1y!).toFixed(1)}%
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 10,
                        fontWeight: "700",
                        marginLeft: 1,
                      }}
                    >
                      1Y
                    </Text>
                  </View>
                ) : null}
              </View>
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

      {/* Add to stack — the fast batch path. Tapping queues this card
          and instantly re-arms the scanner for the next one in the pile,
          so a whole stack can be logged without leaving the camera. */}
      {batchEnabled ? (
        <Pressable
          onPress={onAddToBatch}
          accessibilityRole="button"
          accessibilityLabel="Add to stack and scan next"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: withAlpha(palette.accent.mint, 0.96),
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Layers size={17} color="#08110D" />
          <Text style={{ color: "#08110D", fontWeight: "800", fontSize: 14 }}>
            Add to scan cart
          </Text>
        </Pressable>
      ) : null}

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
            backgroundColor: batchEnabled
              ? "rgba(255,255,255,0.06)"
              : palette.accent.mint,
            borderWidth: batchEnabled ? 1 : 0,
            borderColor: withAlpha("#fff", 0.16),
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: batchEnabled ? "#fff" : "#08110D",
              fontWeight: "800",
              fontSize: 14,
            }}
          >
            View details
          </Text>
          <ChevronRight size={16} color={batchEnabled ? "#fff" : "#08110D"} />
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
            minWidth: compact ? 102 : 112,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha("#fff", 0.18),
            backgroundColor: "rgba(255,255,255,0.04)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Plus size={16} color="#fff" />
          <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
            Add one
          </Text>
        </Pressable>
      </View>

      {/* Grade path — the other verb. Take the recognised card into the
          photometric grade flow (centering / edges / corners / surface). */}
      <Pressable
        onPress={onGrade}
        accessibilityRole="button"
        accessibilityLabel="Grade this card"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          paddingVertical: 11,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: withAlpha(palette.accent.purple, 0.45),
          backgroundColor: withAlpha(palette.accent.purple, 0.12),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Gauge size={16} color={palette.accent.purple} />
        <Text style={{ color: palette.accent.purple, fontWeight: "700", fontSize: 14 }}>
          Grade this card
        </Text>
      </Pressable>

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
                    width: altWidth,
                    gap: 5,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: altWidth,
                      aspectRatio: 2.5 / 3.5,
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <CandidateCardImage
                      candidate={alt}
                      variant="thumb"
                      rounded={10}
                      priority="low"
                    />
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
