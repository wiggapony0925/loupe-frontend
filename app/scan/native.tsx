/**
 * Native scan — `/scan/native`
 *
 * A first-party Swift camera scanner (AVFoundation + Vision) with a pro
 * batch workflow:
 *   • Native preview + a corner-bracket reticle that turns mint when the
 *     card is well-framed and held steady (all drawn in Swift).
 *   • Auto-capture — hold a card still in frame and it captures itself.
 *   • Smart framing hints driven by the native detection signals.
 *   • Pinch-to-zoom.
 *   • A session tray: scan a whole stack, see a running count + total
 *     value, then "Add all" to the vault in one tap.
 *
 * Capture → native crop/deskew → the existing identify pipeline. Falls
 * back to the expo-camera `LiveIdentifyFlow` when the native view isn't
 * linked (Android / older builds).
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCameraPermissions } from "expo-camera";
import {
  ChevronLeft,
  Flashlight,
  Sparkles,
  Wand2,
  X,
} from "lucide-react-native";
import {
  identifyCard,
  type IdentifyCandidate,
} from "@/infrastructure/repositories/identifyRepository";
import { cardDetector } from "@/infrastructure/native";
import { ApiError } from "@/infrastructure/http/client";
import { CardImage } from "@/presentation/components/CardImage";
import { usePro } from "@/presentation/features/pro";
import { useCreateGrade } from "@/application/queries/collection/useGradeMutations";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useCompactUsd } from "@/shared/format";
import { routes } from "@/shared/routes";
import {
  LoupeCameraView,
  isNativeCameraAvailable,
  type CaptureEvent,
  type CardDetectedEvent,
} from "../../modules/loupe-scanner-bridge";

type Detect = { detected: boolean; steady: boolean; fill: number };

/** One identified card captured in this scanning session. */
interface SessionCard {
  key: string;
  candidate: IdentifyCandidate;
}

export default function NativeScanScreen() {
  const p = useThemedPalette();
  const formatUsd = useCompactUsd();
  const [permission, requestPermission] = useCameraPermissions();
  const { gatingActive, cardCount, cardLimit, openPaywall } = usePro();
  const createGrade = useCreateGrade();

  const [torch, setTorch] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [detect, setDetect] = useState<Detect>({ detected: false, steady: false, fill: 0 });
  const [busy, setBusy] = useState(false);
  const [captureReq, setCaptureReq] = useState("");
  const [session, setSession] = useState<SessionCard[]>([]);
  const [flash, setFlash] = useState<"none" | "hit" | "miss">("none");
  const [adding, setAdding] = useState(false);
  const busyRef = useRef(false);
  const zoomBase = useRef(1);

  const useNative = Platform.OS === "ios" && isNativeCameraAvailable;

  React.useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  React.useEffect(() => {
    if (!useNative) router.replace(routes.scanIdentify());
  }, [useNative]);

  // Remaining free-tier vault slots (null = uncapped / Pro).
  const slotsLeft =
    gatingActive && cardLimit != null
      ? Math.max(0, cardLimit - cardCount - session.length)
      : null;

  const total = useMemo(
    () => session.reduce((s, c) => s + (c.candidate.market_price_usd ?? 0), 0),
    [session],
  );

  const flashCue = useCallback((kind: "hit" | "miss") => {
    setFlash(kind);
    setTimeout(() => setFlash("none"), 320);
  }, []);

  const triggerCapture = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCaptureReq(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  const runIdentify = useCallback(
    async (uri: string, corners: number[] | null) => {
      try {
        let uploadUri = uri;
        if (corners && corners.length === 8 && cardDetector.capabilities.crop) {
          try {
            const cropped = await cardDetector.crop(uri, corners, 900, 0.82);
            if (cropped?.uri) uploadUri = cropped.uri;
          } catch {
            /* full frame */
          }
        }
        const res = await identifyCard(uploadUri);
        const top = res.candidates?.[0] ?? null;
        if (top && (top.card_id || top.upstream_id)) {
          // Dedup by resolved id so scanning the same card twice in a
          // stack doesn't double-add it.
          const id = top.card_id ?? top.upstream_id!;
          setSession((prev) =>
            prev.some((c) => (c.candidate.card_id ?? c.candidate.upstream_id) === id)
              ? prev
              : [...prev, { key: `${id}-${Date.now()}`, candidate: top }],
          );
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
      } catch {
        flashCue("miss");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [flashCue],
  );

  const onCapture = useCallback(
    (e: { nativeEvent: CaptureEvent }) => {
      const { uri, corners, error } = e.nativeEvent;
      if (error || !uri) {
        busyRef.current = false;
        setBusy(false);
        flashCue("miss");
        return;
      }
      void runIdentify(uri, corners ?? null);
    },
    [runIdentify, flashCue],
  );

  const onDetected = useCallback((e: { nativeEvent: CardDetectedEvent }) => {
    const { detected, steady, fill } = e.nativeEvent;
    setDetect({ detected, steady, fill });
  }, []);

  const removeCard = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSession((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const addAll = useCallback(async () => {
    if (session.length === 0) return;
    setAdding(true);
    const results = await Promise.allSettled(
      session.map((c) =>
        createGrade.mutateAsync({
          cardId: c.candidate.card_id ?? undefined,
          upstreamId: c.candidate.upstream_id ?? undefined,
          grade: 9,
          house: "loupe",
          condition: "nm",
        }),
      ),
    );
    const hitCap = results.some(
      (r) => r.status === "rejected" && r.reason instanceof ApiError && r.reason.status === 402,
    );
    setAdding(false);
    if (hitCap) {
      openPaywall("card_limit");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(routes.vault());
  }, [session, createGrade, openPaywall]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          zoomBase.current = zoom;
        })
        .onUpdate((e) => {
          const next = Math.max(1, Math.min(5, zoomBase.current * e.scale));
          setZoom(next);
        })
        .runOnJS(true),
    [zoom],
  );

  if (!useNative) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  const hint = !detect.detected
    ? "Point at a card"
    : detect.fill < 0.2
      ? "Move closer"
      : detect.steady
        ? autoCapture
          ? "Hold steady — capturing…"
          : "Ready — tap to capture"
        : "Hold steady";

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <GestureDetector gesture={pinch}>
        <LoupeCameraView
          style={{ flex: 1 }}
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

      {/* Capture flash cue */}
      {flash !== "none" ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: 4,
            borderColor:
              flash === "hit" ? withAlpha(p.accent.mint, 0.9) : withAlpha(p.accent.amber, 0.9),
          }}
        />
      ) : null}

      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between" }}
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

          <View style={{ flexDirection: "row", gap: 8 }} pointerEvents="box-none">
            {/* Auto-capture toggle */}
            <Pressable
              onPress={() => setAutoCapture((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Toggle auto capture"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 11,
                height: 40,
                borderRadius: 20,
                backgroundColor: autoCapture ? p.accent.mint : "rgba(0,0,0,0.4)",
              }}
            >
              <Wand2 size={14} color={autoCapture ? "#0B0B0D" : "#fff"} />
              <Text
                style={{
                  color: autoCapture ? "#0B0B0D" : "#fff",
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                }}
              >
                AUTO
              </Text>
            </Pressable>
            <GlassButton
              onPress={() => setTorch((v) => !v)}
              label="Toggle torch"
              active={torch}
            >
              <Flashlight size={18} color={torch ? "#0B0B0D" : "#fff"} />
            </GlassButton>
          </View>
        </View>

        {/* Framing hint + slots */}
        <View style={{ alignItems: "center", gap: 8 }} pointerEvents="none">
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: detect.steady
                ? withAlpha(p.accent.mint, 0.9)
                : "rgba(0,0,0,0.5)",
            }}
          >
            <Text
              style={{
                color: detect.steady ? "#0B0B0D" : "#fff",
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              {busy ? "Identifying…" : hint}
            </Text>
          </View>
          {slotsLeft != null && slotsLeft <= 10 ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: withAlpha(
                  slotsLeft === 0 ? p.accent.rose : p.accent.amber,
                  0.85,
                ),
              }}
            >
              <Text style={{ color: "#0B0B0D", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>
                {slotsLeft === 0 ? "VAULT FULL — UPGRADE" : `${slotsLeft} FREE SLOTS LEFT`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bottom: shutter + session tray */}
        <View pointerEvents="box-none" style={{ gap: 12 }}>
          {/* Session tray */}
          {session.length > 0 ? (
            <View pointerEvents="box-none" style={{ paddingHorizontal: 16 }}>
              <SessionTray
                session={session}
                total={total}
                formatUsd={formatUsd}
                onRemove={removeCard}
                onAddAll={addAll}
                adding={adding}
                palette={p}
              />
            </View>
          ) : null}

          {/* Manual shutter */}
          <View style={{ alignItems: "center", paddingBottom: 18 }} pointerEvents="box-none">
            <Pressable
              onPress={triggerCapture}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Capture card"
              style={{
                width: 74,
                height: 74,
                borderRadius: 37,
                borderWidth: 4,
                borderColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: busy
                    ? withAlpha(p.accent.mint, 0.5)
                    : detect.steady
                      ? p.accent.mint
                      : "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {busy ? <ActivityIndicator color="#0B0B0D" /> : null}
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

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

function SessionTray({
  session,
  total,
  formatUsd,
  onRemove,
  onAddAll,
  adding,
  palette,
}: {
  session: SessionCard[];
  total: number;
  formatUsd: (v: number) => string;
  onRemove: (key: string) => void;
  onAddAll: () => void;
  adding: boolean;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const p = palette;
  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: withAlpha(p.bg.base, 0.92),
        borderWidth: 1,
        borderColor: p.line.default,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "800" }}>
          {session.length} {session.length === 1 ? "card" : "cards"}
          {total > 0 ? ` · ${formatUsd(total)}` : ""}
        </Text>
        <Pressable
          onPress={onAddAll}
          disabled={adding}
          accessibilityRole="button"
          accessibilityLabel="Add all scanned cards to vault"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: p.accent.mint,
            opacity: adding ? 0.7 : 1,
          }}
        >
          {adding ? (
            <ActivityIndicator size="small" color="#0B0B0D" />
          ) : (
            <Sparkles size={13} color="#0B0B0D" strokeWidth={2.5} />
          )}
          <Text style={{ color: "#0B0B0D", fontSize: 12.5, fontWeight: "800" }}>
            Add all
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {session.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => onRemove(c.key)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${c.candidate.name}`}
            style={{ width: 46, height: 64, borderRadius: 7, overflow: "hidden" }}
          >
            <CardImage
              uri={c.candidate.image_url ?? undefined}
              width={46}
              height={64}
              rounded={7}
              alt={c.candidate.name}
            />
            <View
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 16,
                height: 16,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.6)",
              }}
            >
              <X size={10} color="#fff" strokeWidth={3} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
