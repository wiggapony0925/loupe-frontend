import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import { palette, useThemedPalette } from "@/presentation/theme/tokens";
import type { IdentifyTcgHint } from "@/infrastructure/repositories/identifyRepository";
import { BLUR_INTENSITY, GLASS, HAIRLINE } from "./theme";
import { ErrorBanner, HintPill, ResultArea } from "./ScannerBanners";
import { ScanSessionTray } from "./ScanSessionTray";
import { TcgPickerSheet } from "./TcgPickerSheet";
import type { ScanSessionItem } from "./types";

/**
 * The scanner's bottom chrome — the single shared surface that carries
 * every "banner and everything" the scanner shows: the TCG picker sheet,
 * the self-clearing error banner, the framing-hint / coaching pill, the
 * rolling session tray (with running total + "Add all"), the bright
 * shutter, and the manual-search escape hatch. Camera-agnostic: it takes
 * state + callbacks, so the expo-camera flow and the native flow render
 * an identical bottom panel.
 */
export function ScannerBottomPanel({
  error,
  detectorHint,
  tcgHint,
  tcgPickerOpen,
  onCloseTcgPicker,
  onPickTcg,
  scanSession,
  sessionMatchCount,
  batchEnabled,
  slotsLeft = null,
  onPickScanSessionItem,
  onRemoveScanSessionItem,
  onAddSession,
  onDismissError,
  onManualCapture,
  onManualSearch,
  scanning,
  locked,
  formatUsd,
  palette: themed,
}: {
  error: string | null;
  detectorHint: string | null;
  tcgHint: IdentifyTcgHint;
  tcgPickerOpen: boolean;
  onCloseTcgPicker: () => void;
  onPickTcg: (t: IdentifyTcgHint) => void;
  scanSession: ScanSessionItem[];
  sessionMatchCount: number;
  batchEnabled: boolean;
  slotsLeft?: number | null;
  onPickScanSessionItem: (item: ScanSessionItem) => void;
  onRemoveScanSessionItem: (id: string) => void;
  onAddSession: () => void;
  onDismissError: () => void;
  onManualCapture: () => void;
  onManualSearch?: () => void;
  scanning: boolean;
  locked: boolean;
  formatUsd: (v: number) => string;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const shutterLocked = locked;
  const insets = useSafeAreaInsets();
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

      {/* Identify failures land here as a quiet, self-clearing banner —
          right above the shutter, which doubles as the retry. Tap the
          banner itself to dismiss it early. Never a modal. */}
      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      {!hasScanSession ? (
        <ResultArea detectorHint={detectorHint} scanning={scanning} />
      ) : detectorHint ? (
        // With the tray on screen the coaching strip is gone, but framing
        // guidance ("Hold steady…") still needs somewhere to land — as a
        // self-clearing toast above the tray.
        <HintPill label={detectorHint} />
      ) : null}

      {hasScanSession ? (
        <ScanSessionTray
          items={scanSession}
          themed={themed}
          formatUsd={formatUsd}
          onPick={onPickScanSessionItem}
          onRemove={onRemoveScanSessionItem}
          onSearchManually={onManualSearch}
          onAddAll={batchEnabled && sessionMatchCount > 0 ? onAddSession : undefined}
          addAllCount={sessionMatchCount}
          slotsLeft={slotsLeft}
        />
      ) : null}

      <View style={{ height: 76, justifyContent: "center", paddingTop: 2 }}>
        {/* Manual shutter — the single bright focal point. Picks up a mint
            ring + glow the instant we lock so the control reflects state. */}
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
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: GLASS,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: HAIRLINE,
              opacity: pressed ? 0.82 : onManualSearch ? 1 : 0.4,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <BlurView
              intensity={BLUR_INTENSITY}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
            <Search size={25} color="#fff" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}
