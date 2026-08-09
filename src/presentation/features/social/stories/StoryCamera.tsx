/**
 * StoryCamera — tap for a photo, hold to record. The Instagram gesture.
 *
 * One shutter for both because that is the whole trick: nobody wants to
 * pick a mode before they know what they're pointing at. A tap resolves
 * instantly as a still; holding past `HOLD_MS` starts recording and the
 * release stops it, with a ring filling around the button so the length is
 * visible while it happens rather than discovered afterwards.
 *
 * **Why the press handling is hand-rolled.** `onLongPress` fires once, at
 * the threshold, and gives nothing back on release — so it can start a
 * recording but can't stop one. `Pressable`'s in/out events do both, and
 * the timer in between is what distinguishes the two gestures.
 *
 * Video is capped at `MAX_SECONDS` client-side AND server-side. Here it
 * stops the recording (so the file is never bigger than it needs to be);
 * there it refuses anything longer, because a client is not a limit.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Images, RefreshCw, X, Zap, ZapOff } from "lucide-react-native";
import { canPlayVideo } from "@/presentation/features/social/Video";
import { useThemedPalette } from "@/presentation/theme/tokens";

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
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // Requested separately and NOT required: a story with no sound is still a
  // story, so a refused microphone downgrades video to silent rather than
  // blocking the whole screen.
  const [mic, requestMic] = useMicrophonePermissions();

  const [facing, setFacing] = useState<"back" | "front">("back");
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  // Set the instant a recording begins, so a release that arrives before
  // React has re-rendered still knows to stop it.
  const isRecording = useRef(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 0.72 + progress.value * 0.28 }],
    opacity: progress.value > 0 ? 1 : 0,
  }));

  const stopRecording = useCallback(() => {
    if (!isRecording.current) return;
    isRecording.current = false;
    setRecording(false);
    progress.value = withTiming(0, { duration: 160 });
    // The promise returned by recordAsync resolves here — see startRecording.
    camera.current?.stopRecording();
  }, [progress]);

  const startRecording = useCallback(async () => {
    if (!ready || isRecording.current) return;
    if (!mic?.granted) await requestMic();

    isRecording.current = true;
    setRecording(true);
    setTorch((on) => on); // keep whatever the user chose
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    progress.value = withTiming(1, { duration: MAX_SECONDS * 1000 });

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
      progress.value = withTiming(0, { duration: 160 });
    }
  }, [ready, mic?.granted, requestMic, onCaptured, progress]);

  const takePhoto = useCallback(async () => {
    if (!ready || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const shot = await camera.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (shot?.uri) onCaptured({ uri: shot.uri, kind: "image" });
    } finally {
      setBusy(false);
    }
  }, [ready, busy, onCaptured]);

  const onPressIn = () => {
    startedAt.current = Date.now();
    // Photo-only on binaries without the mic permission — see VIDEO_CAPABLE.
    if (!VIDEO_CAPABLE) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      void startRecording();
    }, HOLD_MS);
  };

  const onPressOut = () => {
    if (holdTimer.current) {
      // Released before the threshold — it was a tap.
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      void takePhoto();
      return;
    }
    stopRecording();
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: VIDEO_CAPABLE ? ["images", "videos"] : ["images"],
      quality: 0.85,
      videoMaxDuration: MAX_SECONDS,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      onCaptured({
        uri: asset.uri,
        kind: asset.type === "video" ? "video" : "image",
        durationMs: asset.duration ?? undefined,
      });
    }
  };

  if (!permission) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: "#000" }]}>
        <Text style={styles.denyTitle}>Camera access needed</Text>
        <Text style={styles.denyBody}>
          Loupe needs the camera to record a story. Photos stay on your device
          until you post.
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          style={[styles.denyCta, { backgroundColor: p.accent.mint }]}
          accessibilityRole="button"
        >
          <Text style={styles.denyCtaText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
          <Text style={styles.denyCancel}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: "#000" }]}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={VIDEO_CAPABLE ? "video" : "picture"}
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
      />

      <SafeAreaView style={styles.fill} pointerEvents="box-none">
        <View style={styles.top}>
          <Chip onPress={onCancel} label="Close">
            <X size={21} color="#fff" strokeWidth={2.2} />
          </Chip>
          <View style={styles.topRight}>
            <Chip
              onPress={() => setTorch((v) => !v)}
              label={torch ? "Turn flash off" : "Turn flash on"}
            >
              {torch ? (
                <Zap size={19} color="#ffd60a" fill="#ffd60a" />
              ) : (
                <ZapOff size={19} color="#fff" />
              )}
            </Chip>
            <Chip
              onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
              label="Flip camera"
            >
              <RefreshCw size={19} color="#fff" strokeWidth={2.2} />
            </Chip>
          </View>
        </View>

        <View style={styles.spacer} pointerEvents="none">
          {recording ? (
            <View style={styles.recPill}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={() => void pickFromLibrary()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Choose from your library"
            style={styles.libraryButton}
          >
            <Images size={22} color="#fff" strokeWidth={2} />
          </Pressable>

          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Tap for a photo, hold to record a video"
            style={styles.shutterHit}
          >
            {/* The fill ring — a recording's length, visible while it
                happens instead of discovered on playback. */}
            <Animated.View
              style={[styles.shutterRing, { borderColor: p.accent.mint }, ring]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.shutterOuter,
                recording && { borderColor: p.accent.mint },
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
          </Pressable>

          {/* Balances the library button so the shutter is truly centred. */}
          <View style={styles.libraryButton} />
        </View>

        <Text style={styles.hint} pointerEvents="none">
          {recording
            ? "Release to finish"
            : VIDEO_CAPABLE
              ? "Tap for photo · hold for video"
              : "Tap for photo — update Loupe to record video"}
        </Text>
      </SafeAreaView>
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topRight: { flexDirection: "row", gap: 10 },
  chip: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  spacer: { flex: 1, alignItems: "center", paddingTop: 14 },
  recPill: {
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
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 34,
    paddingBottom: 6,
  },
  libraryButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  shutterHit: { alignItems: "center", justifyContent: "center" },
  shutterRing: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
  },
  // Square-ish while recording — the universal "this is running" shutter.
  shutterInnerRecording: { width: 30, height: 30, borderRadius: 8 },
  hint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingTop: 10,
    paddingBottom: 4,
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
