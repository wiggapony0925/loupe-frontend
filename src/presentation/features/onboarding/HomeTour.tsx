/**
 * HomeTour — the first-login guided tour of the Command Center.
 *
 * Blurs the live screen, rings one real section at a time (measured via
 * `TourTarget`, never hardcoded offsets), and explains it in a card that
 * positions itself above or below the highlight. Skippable at any step;
 * completing OR skipping marks the tour seen for THIS account only
 * (`onboardingStore`), so it never replays on later sign-ins. Admins can
 * re-arm it from Settings ("Replay login tutorial").
 *
 * Motion (Reanimated, matching the island-nav feel): the overlay fades
 * in, the ring MORPHS between sections on a spring instead of jumping,
 * breathes a soft pulse while parked, the step card springs up fresh per
 * step, and the scan-step chevron bobs toward the FAB. Haptic tick per
 * step (respects the haptics setting). Still flat and quiet: blur + dim,
 * one mint ring, one card — no confetti.
 */
import { useEffect, useState } from "react";
import {
  Pressable,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { ChevronDown } from "lucide-react-native";
import { useOnboarding } from "@/application/stores/onboardingStore";
import { useSettings } from "@/application/stores/settingsStore";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useTourAnchors, type AnchorRect } from "./tourAnchors";

interface Step {
  /** TourTarget id, or "scan" for the fixed tab-bar pointer step. */
  anchor: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    anchor: "portfolio",
    title: "Your collection, charted",
    body: "Every card you own, valued live and drawn like a stock. Scrub the line to see any day.",
  },
  {
    anchor: "kpis",
    title: "The numbers that matter",
    body: "Total value and unrealized P/L — computed by Loupe, identical on web and mobile.",
  },
  {
    anchor: "movers",
    title: "Top movers",
    body: "The cards in your vault with the biggest 1-year swings, ranked for you daily.",
  },
  {
    anchor: "scan",
    title: "Scan anything",
    body: "The center button identifies any card with your camera and drops it straight into your vault.",
  },
];

const RING_PAD = 6;
const CARD_MARGIN = 20;
const RING_SPRING = { damping: 19, stiffness: 190, mass: 0.7 };

export function HomeTour() {
  const p = useThemedPalette();
  const { user, isAuthenticated } = useAuth();
  const markSeen = useOnboarding((s) => s.markSeen);
  // Subscribe to the map itself (not the getter) so the Settings replay
  // reset re-shows the tour reactively.
  const seenBy = useOnboarding((s) => s.seenBy);
  const rects = useTourAnchors((s) => s.rects);
  const { width: winW, height: winH } = useWindowDimensions();
  const themeMode = useSettings((s) => s.themeMode);
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const systemScheme = useColorScheme();
  const isDark =
    themeMode === "dark" || (themeMode !== "light" && systemScheme === "dark");

  const [step, setStep] = useState(0);
  // Let the screen paint + anchors measure before the overlay fades in.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 650);
    return () => clearTimeout(t);
  }, []);

  const userId = user?.id ? String(user.id) : null;
  const visible = ready && isAuthenticated && userId !== null && !seenBy[userId];

  const current = STEPS[Math.min(step, STEPS.length - 1)]!;
  const scanStep = current.anchor === "scan";
  const rect: AnchorRect | null = scanStep
    ? { x: winW / 2 - 36, y: winH - 92, width: 72, height: 72 }
    : (rects[current.anchor] ?? null);

  // ── Ring motion: spring-morph between sections, soft pulse in place ──
  const ringX = useSharedValue(0);
  const ringY = useSharedValue(0);
  const ringW = useSharedValue(0);
  const ringH = useSharedValue(0);
  const ringShown = useSharedValue(0);
  const pulse = useSharedValue(0);
  const [ringInitialized, setRingInitialized] = useState(false);

  useEffect(() => {
    if (!rect || scanStep) {
      ringShown.value = withTiming(0, { duration: 160 });
      return;
    }
    const x = rect.x - RING_PAD;
    const y = rect.y - RING_PAD;
    const w = rect.width + RING_PAD * 2;
    const h = rect.height + RING_PAD * 2;
    if (!ringInitialized) {
      // First appearance: land in place, just fade/scale in.
      ringX.value = x;
      ringY.value = y;
      ringW.value = w;
      ringH.value = h;
      setRingInitialized(true);
    } else {
      // Subsequent steps: MORPH — the ring travels to the next section.
      ringX.value = withSpring(x, RING_SPRING);
      ringY.value = withSpring(y, RING_SPRING);
      ringW.value = withSpring(w, RING_SPRING);
      ringH.value = withSpring(h, RING_SPRING);
    }
    ringShown.value = withTiming(1, { duration: 220 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect?.x, rect?.y, rect?.width, rect?.height, scanStep]);

  useEffect(() => {
    // A slow breath while parked — draws the eye without shouting.
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    left: ringX.value,
    top: ringY.value,
    width: ringW.value,
    height: ringH.value,
    opacity: ringShown.value,
    transform: [{ scale: 1 + pulse.value * 0.012 }],
    shadowOpacity: 0.25 + pulse.value * 0.2,
  }));

  // Scan-step chevron: a gentle bob toward the FAB.
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(7, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  if (!visible || userId === null) return null;

  const tick = () => {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
  };
  const finish = () => {
    tick();
    markSeen(userId);
  };
  const next = () => {
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    tick();
    setStep(step + 1);
  };

  // Card placement: below the ring when the target sits in the top half,
  // above it otherwise — never off-screen.
  const below = rect ? rect.y + rect.height / 2 < winH / 2 : true;
  const cardTop = rect
    ? below
      ? Math.min(rect.y + rect.height + RING_PAD + CARD_MARGIN, winH - 260)
      : undefined
    : winH * 0.35;
  const cardBottom =
    rect && !below ? Math.max(winH - rect.y + RING_PAD + CARD_MARGIN, 120) : undefined;

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(200)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="auto"
    >
      <BlurView
        intensity={26}
        tint={isDark ? "dark" : "light"}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: withAlpha(isDark ? "#000000" : "#0B0B0B", 0.35),
        }}
      />

      {/* Highlight ring — springs from section to section, breathing softly. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            borderRadius: 18,
            borderWidth: 2,
            borderColor: p.accent.mint,
            backgroundColor: withAlpha(p.accent.mint, 0.06),
            shadowColor: p.accent.mint,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 12,
          },
          ringStyle,
        ]}
      />

      {/* Skip — always available, top-right, no confirmation. */}
      <Animated.View
        entering={FadeIn.delay(350).duration(240)}
        style={{ position: "absolute", top: 58, right: 20 }}
      >
        <Pressable
          onPress={finish}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip the tour"
        >
          <Text style={{ color: "#FFFFFFE6", fontSize: 13, fontWeight: "700" }}>
            Skip
          </Text>
        </Pressable>
      </Animated.View>

      {/* The step card — springs up fresh for each step. */}
      <View
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: cardTop,
          bottom: cardBottom,
        }}
        pointerEvents="box-none"
      >
        <Animated.View
          key={current.anchor}
          entering={FadeInDown.springify().damping(18).stiffness(200)}
          exiting={FadeOut.duration(120)}
          style={{
            padding: 18,
            gap: 8,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
          }}
        >
          <Text
            style={{
              color: p.accent.mint,
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 2.5,
            }}
          >
            {`${step + 1} OF ${STEPS.length}`}
          </Text>
          <Text style={{ color: p.ink.default, fontSize: 17, fontWeight: "800" }}>
            {current.title}
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 13, lineHeight: 19 }}>
            {current.body}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <View style={{ flexDirection: "row", gap: 6 }}>
              {STEPS.map((s, i) => (
                <Animated.View
                  key={s.anchor}
                  layout={LinearTransition.springify().damping(18)}
                  style={{
                    width: i === step ? 16 : 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor:
                      i === step ? p.accent.mint : withAlpha(p.ink.muted, 0.35),
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={next}
              accessibilityRole="button"
              accessibilityLabel={step >= STEPS.length - 1 ? "Finish tour" : "Next step"}
              style={({ pressed }) => ({
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: p.accent.mint,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text style={{ color: "#04342C", fontSize: 13, fontWeight: "800" }}>
                {step >= STEPS.length - 1 ? "Start collecting" : "Next"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Downward pointer for the scan-FAB step — the button itself stays
            visible in the tab bar beneath the overlay. */}
        {scanStep ? (
          <Animated.View
            entering={FadeIn.delay(150).duration(200)}
            style={[{ alignItems: "center", marginTop: 10 }, bobStyle]}
          >
            <ChevronDown size={28} color={p.accent.mint} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}
