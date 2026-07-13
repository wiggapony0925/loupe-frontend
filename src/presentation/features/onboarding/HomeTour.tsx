/**
 * HomeTour — the first-login guided tour of the Command Center.
 *
 * A REAL spotlight: four blur+dim strips frame the highlighted section,
 * so the thing being explained stays crystal clear while everything
 * around it softens. The hole (and its mint ring) spring-morphs from
 * section to section; each step auto-scrolls its section into view and
 * re-measures, so the spotlight is always on-screen and exact. Skippable
 * at any step; completing OR skipping marks the tour seen for THIS
 * account only (`onboardingStore`) — later sign-ins never replay it.
 * Admins re-arm it from Settings ("Replay login tutorial").
 *
 * Motion: overlay fade, spring-morphing spotlight with a soft breathing
 * pulse, per-step card on a FadeInDown spring, fluid step dots, bobbing
 * chevron on the scan step, haptic tick per step (respects the setting).
 * Flat and quiet throughout — no confetti.
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

const RING_PAD = 8;
const CARD_MARGIN = 20;
const SPOT_SPRING = { damping: 19, stiffness: 190, mass: 0.7 };
/** Time for the scroll + settle before re-measuring anchors. */
const SCROLL_SETTLE_MS = 420;

export function HomeTour({ scrollTo }: { scrollTo?: (y: number) => void }) {
  const p = useThemedPalette();
  const { user, isAuthenticated } = useAuth();
  const markSeen = useOnboarding((s) => s.markSeen);
  // Subscribe to the map itself (not the getter) so the Settings replay
  // reset re-shows the tour reactively.
  const seenBy = useOnboarding((s) => s.seenBy);
  const rects = useTourAnchors((s) => s.rects);
  const initialRects = useTourAnchors((s) => s.initialRects);
  const bumpRemeasure = useTourAnchors((s) => s.bumpRemeasure);
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
    ? { x: winW / 2 - 40, y: winH - 96, width: 80, height: 80 }
    : (rects[current.anchor] ?? null);

  // ── Auto-scroll each step's section into view, then re-measure ──
  useEffect(() => {
    if (!visible || !scrollTo) return;
    const first = initialRects[STEPS[0]!.anchor];
    const target = scanStep ? null : initialRects[current.anchor];
    const y =
      scanStep || !first || !target ? 0 : Math.max(0, target.y - first.y - 8);
    scrollTo(y);
    const t = setTimeout(bumpRemeasure, SCROLL_SETTLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible]);

  // ── Spotlight geometry: shared values drive the ring AND the 4 strips ──
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const holeRadius = useSharedValue(20);
  const ringShown = useSharedValue(0);
  const pulse = useSharedValue(0);
  const [spotInitialized, setSpotInitialized] = useState(false);

  useEffect(() => {
    if (!rect) {
      ringShown.value = withTiming(0, { duration: 160 });
      return;
    }
    const x = rect.x - RING_PAD;
    const y = rect.y - RING_PAD;
    const w = rect.width + RING_PAD * 2;
    const h = rect.height + RING_PAD * 2;
    const radius = scanStep ? (rect.width + RING_PAD * 2) / 2 : 20;
    if (!spotInitialized) {
      // First appearance: land in place, just fade in.
      hx.value = x;
      hy.value = y;
      hw.value = w;
      hh.value = h;
      holeRadius.value = radius;
      setSpotInitialized(true);
    } else {
      // Subsequent steps: MORPH — the spotlight travels to the next section.
      hx.value = withSpring(x, SPOT_SPRING);
      hy.value = withSpring(y, SPOT_SPRING);
      hw.value = withSpring(w, SPOT_SPRING);
      hh.value = withSpring(h, SPOT_SPRING);
      holeRadius.value = withTiming(radius, { duration: 260 });
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

  // Four frames around the hole — the target itself stays UNBLURRED.
  const topStrip = useAnimatedStyle(() => ({
    left: 0,
    top: 0,
    width: winW,
    height: Math.max(0, hy.value),
  }));
  const bottomStrip = useAnimatedStyle(() => ({
    left: 0,
    top: hy.value + hh.value,
    width: winW,
    height: Math.max(0, winH - (hy.value + hh.value)),
  }));
  const leftStrip = useAnimatedStyle(() => ({
    left: 0,
    top: hy.value,
    width: Math.max(0, hx.value),
    height: hh.value,
  }));
  const rightStrip = useAnimatedStyle(() => ({
    left: hx.value + hw.value,
    top: hy.value,
    width: Math.max(0, winW - (hx.value + hw.value)),
    height: hh.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
    borderRadius: holeRadius.value,
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

  // Card placement: below the spotlight when the target sits in the top
  // half, above it otherwise — clamped clear of the tab bar.
  const below = rect ? rect.y + rect.height / 2 < winH / 2 : true;
  const cardTop = rect
    ? below
      ? Math.min(rect.y + rect.height + RING_PAD + CARD_MARGIN, winH - 330)
      : undefined
    : winH * 0.35;
  const cardBottom =
    rect && !below
      ? Math.max(winH - rect.y + RING_PAD + CARD_MARGIN, 140)
      : undefined;

  const dim = withAlpha(isDark ? "#000000" : "#0B0B0B", 0.38);
  const stripBase = {
    position: "absolute" as const,
    overflow: "hidden" as const,
  };

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(200)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="auto"
    >
      {/* Spotlight frame — blur + dim everywhere EXCEPT the hole. */}
      {[topStrip, bottomStrip, leftStrip, rightStrip].map((strip, i) => (
        <Animated.View key={i} style={[stripBase, strip]} pointerEvents="none">
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
              backgroundColor: dim,
            }}
          />
        </Animated.View>
      ))}

      {/* The ring hugging the clear window. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            borderWidth: 2,
            borderColor: p.accent.mint,
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
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: withAlpha("#000000", 0.35),
          }}
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
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 24,
            shadowOpacity: 0.18,
            elevation: 8,
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
