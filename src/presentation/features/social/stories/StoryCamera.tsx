/**
 * StoryCamera — the Instagram story camera, in Loupe's hands.
 *
 * The anatomy mirrors IG's deliberately, because that is the layout every
 * thumb already knows: a ROUNDED viewfinder card on black chrome; close
 * top-left, flash top-center, settings top-right; a tools rail on the
 * left edge; the big shutter low in the frame; and a black bottom bar
 * with the gallery on the left, the mode word in the middle and the
 * camera flip on the right.
 *
 * One shutter, two gestures: a tap resolves instantly as a still; holding
 * past `HOLD_MS` records, with a mint progress ARC drawing around the
 * button so the length is visible while it happens rather than discovered
 * afterwards. Hands-free (the rail's one tool — the only IG rail item
 * Loupe has a real behavior for) turns the shutter into a toggle.
 *
 * Zoom, three ways, like the reference:
 *   • pinch anywhere on the viewfinder;
 *   • slide UP while holding the shutter (IG's one-handed zoom);
 *   • .5×/1× lens chips over the shutter when the device carries an
 *     ultra-wide (iOS exposes lenses by localized name, so the chip
 *     simply doesn't appear on devices/locales where we can't find it —
 *     pinch still works everywhere).
 * Double-tap the viewfinder to flip — same as IG.
 *
 * Capture quality is ceilinged, not defaulted: stills at quality 1 on the
 * sensor's max dimensions, video at 1080p (the server caps stories at
 * 120 MB / 15 s; 4K would blow the budget for zero visible gain at story
 * size), front stills mirrored the way every story camera mirrors them,
 * and the SCREEN flash for front-facing shots.
 *
 * **Why the press handling is hand-rolled.** `onLongPress` fires once, at
 * the threshold, and gives nothing back on release — so it can start a
 * recording but can't stop one. `Pressable`'s in/out events do both, and
 * the timer in between is what distinguishes the two gestures.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  CircleStop,
  Images,
  Settings as SettingsIcon,
  SwitchCamera,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
import { canPlayVideo } from "@/presentation/features/social/Video";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

/**
 * Can THIS binary record video?
 *
 * `canPlayVideo` is a proxy, and a deliberate one: the expo-video native
 * module and the NSMicrophoneUsageDescription string shipped in the same
 * build (248). On the build before it, opening the camera in video mode is
 * not a denied permission — iOS KILLS the process the instant the capture
 * session touches the audio device without that plist string. That is the
 * "app just crashes" with no error dialog and no JS stack.
 *
 * So on older binaries the shutter is photo-only and says so. Delete along
 * with the guard in videoSupport.ts once 248 is the floor.
 */
const VIDEO_CAPABLE = canPlayVideo();

/** Hold past this and it's a recording, not a photo. */
const HOLD_MS = 260;
/** Matches the server's MAX_STORY_DURATION_MS. */
const MAX_SECONDS = 15;
/** Sliding a full thumb-length up while holding reaches max zoom — IG's feel. */
const SLIDE_ZOOM_RANGE = 300;

/** The progress arc's geometry (radius sized around the 84pt shutter). */
const ARC_SIZE = 108;
const ARC_R = 50;
const ARC_C = 2 * Math.PI * ARC_R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface Capture {
  uri: string;
  kind: "image" | "video";
  durationMs?: number;
}

export function StoryCamera({
  onCaptured,
  onCancel,
}: {
  onCaptured: (capture: Capture) => void;
  onCancel: () => void;
}) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // Requested separately and NOT required: a story with no sound is still a
  // story, so a refused microphone downgrades video to silent rather than
  // blocking the whole screen.
  const [mic, requestMic] = useMicrophonePermissions();

  // The capture mode is STATE, not a constant. A camera parked in "video"
  // has no ImageCapture use case bound on Android — every shutter tap
  // silently produced nothing — and on iOS it ceilings stills to the video
  // pipeline's resolution. So stills happen in "picture" and the hold
  // switches to "video" for the length of the recording.
  const [mode, setMode] = useState<"picture" | "video">("picture");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flashOn, setFlashOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  // Zoom is a PROP on CameraView (0..1 of the active lens's range), so it
  // lives in React state — written through one clamped setter that skips
  // sub-1% moves to keep pinch from re-rendering the preview every frame.
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const applyZoom = useCallback((next: number) => {
    const z = Math.max(0, Math.min(1, next));
    if (Math.abs(z - zoomRef.current) < 0.01 && z !== 0 && z !== 1) return;
    zoomRef.current = z;
    setZoom(z);
  }, []);

  // The ultra-wide, when the hardware has one. iOS names lenses by their
  // LOCALIZED name, so this is a best-effort match — a device or locale
  // where "Ultra Wide" isn't findable just doesn't get the .5× chip.
  const [ultraWideLens, setUltraWideLens] = useState<string | null>(null);
  const [lens, setLens] = useState<"wide" | "ultra">("wide");
  useEffect(() => {
    if (Platform.OS !== "ios" || !ready || facing !== "back") return;
    let cancelled = false;
    void (async () => {
      try {
        const lenses = (await camera.current?.getAvailableLensesAsync()) ?? [];
        if (cancelled) return;
        setUltraWideLens(lenses.find((l) => /ultra\s*wide/i.test(l)) ?? null);
      } catch {
        setUltraWideLens(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, facing]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartY = useRef(0);
  const zoomAtPress = useRef(0);
  // Set the instant a recording begins, so a release that arrives before
  // React has re-rendered still knows to stop it.
  const isRecording = useRef(false);
  const progress = useSharedValue(0);
  const shutterScale = useSharedValue(1);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      void requestPermission();
    }
  }, [permission?.granted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  // IG's recording shutter: the whole button GROWS while the arc draws.
  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_C * (1 - progress.value),
    opacity: progress.value > 0 ? 1 : 0,
  }));

  const stopRecording = useCallback(() => {
    if (!isRecording.current) return;
    isRecording.current = false;
    setRecording(false);
    progress.value = withTiming(0, { duration: 160 });
    shutterScale.value = withSpring(1, { damping: 16, stiffness: 260 });
    // The promise returned by recordAsync resolves here — see startRecording.
    camera.current?.stopRecording();
  }, [progress, shutterScale]);

  const startRecording = useCallback(async () => {
    if (!ready || isRecording.current) return;
    if (!mic?.granted) await requestMic();

    isRecording.current = true;
    setRecording(true);
    // Hand the native session a beat to bind the video use case before
    // asking it to record — recordAsync on a session still in picture mode
    // is a rejected promise, not a recording.
    setMode("video");
    await new Promise((resolve) => setTimeout(resolve, 140));
    if (!isRecording.current) return; // released during the swap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    progress.value = withTiming(1, { duration: MAX_SECONDS * 1000 });
    shutterScale.value = withSpring(1.18, { damping: 14, stiffness: 220 });

    const began = Date.now();
    try {
      // Resolves when stopRecording() is called or maxDuration is hit.
      const clip = await camera.current?.recordAsync({
        maxDuration: MAX_SECONDS,
      });
      if (clip?.uri) {
        onCaptured({
          uri: clip.uri,
          kind: "video",
          durationMs: Date.now() - began,
        });
      }
    } catch {
      // A recording that fails to start (mic contention, backgrounding)
      // should leave the camera usable, not a dead screen.
    } finally {
      isRecording.current = false;
      setRecording(false);
      setMode("picture");
      progress.value = withTiming(0, { duration: 160 });
      shutterScale.value = withSpring(1, { damping: 16, stiffness: 260 });
    }
  }, [ready, mic?.granted, requestMic, onCaptured, progress, shutterScale]);

  const takePhoto = useCallback(async () => {
    if (!ready || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      // Quality 1 on the sensor's max dimensions — a story is the one
      // place people zoom into corners of a card, so the pixels matter.
      const shot = await camera.current?.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      if (shot?.uri) onCaptured({ uri: shot.uri, kind: "image" });
    } finally {
      setBusy(false);
    }
  }, [ready, busy, onCaptured]);

  const flip = useCallback(() => {
    // Swapping the camera mid-recording tears down the capture session:
    // the clip is truncated or lost outright.
    if (isRecording.current) return;
    Haptics.selectionAsync().catch(() => {});
    setLens("wide");
    applyZoom(0);
    setFacing((f) => (f === "back" ? "front" : "back"));
  }, [applyZoom]);

  const onPressIn = (event: GestureResponderEvent) => {
    pressStartY.current = event.nativeEvent.pageY;
    zoomAtPress.current = zoomRef.current;
    // Photo-only on binaries without the mic permission — see VIDEO_CAPABLE.
    if (!VIDEO_CAPABLE || handsFree) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      void startRecording();
    }, HOLD_MS);
  };

  // IG's one-handed zoom: while holding the shutter, sliding up zooms in.
  const onShutterTouchMove = (event: GestureResponderEvent) => {
    if (!isRecording.current) return;
    const dy = pressStartY.current - event.nativeEvent.pageY;
    if (dy <= 0) {
      applyZoom(zoomAtPress.current);
      return;
    }
    applyZoom(zoomAtPress.current + dy / SLIDE_ZOOM_RANGE);
  };

  const onPressOut = () => {
    if (handsFree && VIDEO_CAPABLE) {
      // Hands-free: the shutter is a TOGGLE — tap to start, tap to stop.
      if (isRecording.current) stopRecording();
      else void startRecording();
      return;
    }
    if (holdTimer.current) {
      // Released before the threshold — it was a tap.
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      void takePhoto();
      return;
    }
    if (isRecording.current) {
      stopRecording();
      return;
    }
    // No timer and nothing recording: the photo-only binary, where
    // onPressIn never arms a hold. Without this the shutter is DEAD on
    // build 247 — the exact binary the video guard exists to protect.
    void takePhoto();
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: VIDEO_CAPABLE ? ["images", "videos"] : ["images"],
      quality: 0.9,
      videoMaxDuration: MAX_SECONDS,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const isVideo = asset.type === "video";
    // videoMaxDuration only bounds what the picker RECORDS, not what it
    // lets you choose — an hour-long clip would sail past the shutter's
    // ceiling and die on the server's 120 MB limit after a long upload.
    if (isVideo && (asset.duration ?? 0) > MAX_SECONDS * 1000) {
      Alert.alert(
        "That clip is too long",
        `Stories can be up to ${MAX_SECONDS} seconds. Trim it and try again.`,
      );
      return;
    }
    onCaptured({
      uri: asset.uri,
      kind: isVideo ? "video" : "image",
      durationMs: asset.duration ?? undefined,
    });
  };

  // Viewfinder gestures — IG's pair: pinch zooms, double-tap flips. The
  // detector wraps ONLY the camera card (a stable, never-animated-out
  // subtree — the island crash taught us where detectors must not live),
  // and the chrome overlays sit above it so buttons always win the touch.
  const pinchBase = useRef(0);
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchBase.current = zoomRef.current;
    })
    .onUpdate((e) => {
      // scale 1 → no change; 2 → most of the range; <1 zooms out.
      applyZoom(pinchBase.current + (e.scale - 1) * 0.55);
    });
  const doubleTap = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (success) flip();
    });
  const viewfinderGesture = Gesture.Simultaneous(pinch, doubleTap);

  if (!permission) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={[styles.fill, styles.center, { backgroundColor: "#000" }]}
      >
        <Text style={styles.denyTitle}>Camera access needed</Text>
        <Text style={styles.denyBody}>
          Loupe needs the camera to record a story. Photos stay on your device
          until you post.
        </Text>
        <Pressable
          onPress={() => {
            // iOS only shows the system prompt ONCE. After that the button
            // is decoration unless it opens Settings, which is the only
            // place the decision can still be changed.
            if (permission.canAskAgain) void requestPermission();
            else void Linking.openSettings();
          }}
          style={[styles.denyCta, { backgroundColor: p.accent.mint }]}
          accessibilityRole="button"
        >
          <Text style={styles.denyCtaText}>
            {permission.canAskAgain ? "Allow camera" : "Open Settings"}
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
          <Text style={styles.denyCancel}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const showLensChips =
    facing === "back" && ultraWideLens != null && !recording;

  return (
    <View style={[styles.fill, { backgroundColor: "#000" }]}>
      {/* ── The rounded viewfinder card, IG-style ── */}
      <View
        style={[
          styles.finder,
          { marginTop: Math.max(insets.top, 12), marginBottom: 96 + insets.bottom },
        ]}
      >
        <GestureDetector gesture={viewfinderGesture}>
          <View style={styles.fill}>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode={mode}
              zoom={zoom}
              // Front-facing "flash" is the screen itself — Retina flash on
              // iOS, CameraX screen flash on Android. Back gets the LED.
              flash={flashOn ? (facing === "front" ? "screen" : "on") : "off"}
              // The LED stays lit through a whole recording — a photo
              // flash can't fire mid-clip.
              enableTorch={flashOn && recording && facing === "back"}
              // Story cameras mirror selfies; an un-mirrored selfie reads
              // as someone else's photo of you.
              mirror={facing === "front"}
              videoQuality="1080p"
              selectedLens={
                facing === "back" && lens === "ultra" && ultraWideLens
                  ? ultraWideLens
                  : undefined
              }
              onCameraReady={() => setReady(true)}
            />
          </View>
        </GestureDetector>

        {/* ── Chrome INSIDE the card (buttons sit above the gestures) ── */}
        <View style={styles.chrome} pointerEvents="box-none">
          <View style={styles.top}>
            <Chip onPress={onCancel} label="Close">
              <X size={22} color="#fff" strokeWidth={2.2} />
            </Chip>
            {/* Flash lives top-CENTER — the reference layout. */}
            <Chip
              onPress={() => setFlashOn((v) => !v)}
              label={flashOn ? "Turn flash off" : "Turn flash on"}
            >
              {flashOn ? (
                <Zap size={20} color="#ffd60a" fill="#ffd60a" />
              ) : (
                <ZapOff size={20} color="#fff" />
              )}
            </Chip>
            <Chip
              onPress={() => router.push(routes.communitySettings())}
              label="Story settings"
            >
              <SettingsIcon size={20} color="#fff" strokeWidth={2.1} />
            </Chip>
          </View>

          {/* ── The tools rail, left edge — only tools Loupe really has. ── */}
          <View style={styles.rail} pointerEvents="box-none">
            {VIDEO_CAPABLE ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setHandsFree((v) => !v);
                }}
                // Flipping the shutter's contract mid-recording strands the
                // user with a running clip and no way the hint describes.
                disabled={recording}
                accessibilityRole="button"
                accessibilityState={{ selected: handsFree }}
                accessibilityLabel="Hands-free recording"
                style={styles.railItem}
              >
                <CircleStop
                  size={26}
                  color={handsFree ? p.accent.mint : "#fff"}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.railLabel,
                    handsFree && { color: p.accent.mint },
                  ]}
                >
                  Hands-free
                </Text>
              </Pressable>
            ) : null}
          </View>

          {recording ? (
            <View style={styles.recPill} pointerEvents="none">
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          ) : null}

          {/* ── Lens chips + shutter, low in the frame like IG ── */}
          <View style={styles.deck} pointerEvents="box-none">
            {showLensChips ? (
              <View style={styles.lensRow}>
                <LensChip
                  label=".5"
                  on={lens === "ultra"}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setLens("ultra");
                    applyZoom(0);
                  }}
                />
                <LensChip
                  label="1x"
                  on={lens === "wide"}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setLens("wide");
                    applyZoom(0);
                  }}
                />
              </View>
            ) : null}

            <Pressable
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onTouchMove={onShutterTouchMove}
              // The slide-to-zoom gesture travels far outside a 108pt
              // button, and Pressable ends the press the moment the touch
              // leaves its rect — which stopped the recording mid-slide.
              // A generous retention rect keeps the press alive until the
              // finger actually lifts.
              pressRetentionOffset={{ top: 600, bottom: 240, left: 240, right: 240 }}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel={
                handsFree
                  ? "Tap to start or stop recording"
                  : "Tap for a photo, hold to record a video"
              }
              style={styles.shutterHit}
            >
              {/* The arc — a recording's length drawn around the button
                  while it happens instead of discovered on playback. */}
              <Animated.View
                style={[StyleSheet.absoluteFill, styles.center]}
                pointerEvents="none"
              >
                <Svg width={ARC_SIZE} height={ARC_SIZE}>
                  <AnimatedCircle
                    cx={ARC_SIZE / 2}
                    cy={ARC_SIZE / 2}
                    r={ARC_R}
                    stroke={p.accent.mint}
                    strokeWidth={5}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${ARC_C}`}
                    animatedProps={arcProps}
                    // Start the sweep at 12 o'clock.
                    transform={`rotate(-90 ${ARC_SIZE / 2} ${ARC_SIZE / 2})`}
                  />
                </Svg>
              </Animated.View>
              <Animated.View style={[styles.center, shutterStyle]}>
                <View
                  style={[
                    styles.shutterOuter,
                    recording && { borderColor: "rgba(255,255,255,0.5)" },
                  ]}
                >
                  <View
                    style={[
                      styles.shutterInner,
                      recording && styles.shutterInnerRecording,
                      recording && { backgroundColor: p.accent.mint },
                    ]}
                  />
                </View>
              </Animated.View>
            </Pressable>

            <Text style={styles.hint} pointerEvents="none">
              {recording
                ? handsFree
                  ? "Tap to finish"
                  : "Release to finish · slide up to zoom"
                : handsFree
                  ? "Tap to start recording"
                  : VIDEO_CAPABLE
                    ? "Tap for photo · hold for video"
                    : "Tap for photo — update Loupe to record video"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── The black bottom bar: gallery · STORY · flip — IG's row ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={() => void pickFromLibrary()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Choose from your library"
          style={styles.galleryButton}
        >
          <Images size={22} color="#fff" strokeWidth={2} />
        </Pressable>

        <Text style={styles.mode} accessibilityRole="header">
          STORY
        </Text>

        <Pressable
          onPress={flip}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          style={styles.flipButton}
        >
          <SwitchCamera size={24} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

function Chip({
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
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

/** The .5×/1× pill — the native camera's lens toggle, IG-sized. */
function LensChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label} zoom`}
      style={[styles.lensChip, on && styles.lensChipOn]}
    >
      <Text style={[styles.lensText, on && styles.lensTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  finder: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0b0b0d",
  },
  chrome: { ...StyleSheet.absoluteFillObject },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  chip: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  rail: {
    position: "absolute",
    left: 12,
    top: "34%",
    gap: 22,
  },
  railItem: { alignItems: "center", gap: 4, width: 74 },
  railLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  recPill: {
    position: "absolute",
    top: 66,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff453a" },
  recText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  deck: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center",
  },
  lensRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  lensChip: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  lensChipOn: { backgroundColor: "rgba(0,0,0,0.72)" },
  lensText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" },
  lensTextOn: { color: "#fff", fontSize: 13 },
  shutterHit: {
    width: ARC_SIZE,
    height: ARC_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.92)",
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
  },
  // Square-ish while recording — the universal "this is running" shutter.
  shutterInnerRecording: { width: 30, height: 30, borderRadius: 9 },
  hint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingTop: 10,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    // minHeight, not height: the bar pays the home-indicator inset with
    // padding, and a FIXED height left that inset as a gap between the
    // viewfinder and the bar.
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  galleryButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  mode: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  flipButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  denyTitle: { color: "#fff", fontSize: 19, fontWeight: "800" },
  denyBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 10,
  },
  denyCta: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 14,
  },
  denyCtaText: { color: "#06140d", fontSize: 15, fontWeight: "800" },
  denyCancel: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
});
