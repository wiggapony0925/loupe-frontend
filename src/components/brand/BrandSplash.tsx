import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { palette, useThemedPalette, withAlpha } from "@/theme/tokens";

interface BrandSplashProps {
  /** Called once the splash finishes its hero animation. */
  onFinish: () => void;
  /** Minimum visible duration (ms) — default 1300. */
  holdMs?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Brand splash — Robinhood-style: pure black canvas, centered animated
 * Loupe mark with a mint reticle pulse, then a fade-out into the app.
 *
 * The logo is a beefier, splash-sized version of `LoupeMark` (140px) with
 * an extra animated reticle ring that breathes as the app boots.
 */
export function BrandSplash({ onFinish, holdMs = 1300 }: BrandSplashProps) {
  // Pull live theme tokens so the splash matches whatever scheme the user
  // (or system) currently has active. Dark mode = near-black canvas with
  // bright text; light mode = paper-white canvas with deep ink text.
  const p = useThemedPalette();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.55)).current;
  const wordmarkY = useRef(new Animated.Value(8)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 14,
        stiffness: 130,
        useNativeDriver: true,
      }),
    ]).start();

    // Wordmark slide-up
    Animated.parallel([
      Animated.timing(wordmarkY, {
        toValue: 0,
        delay: 220,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wordmarkOpacity, {
        toValue: 1,
        delay: 220,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();

    // Reticle breathe loop
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.45,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.55,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    breathe.start();

    // Hold then fade out
    const t = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        breathe.stop();
        onFinish();
      });
    }, holdMs);

    return () => {
      clearTimeout(t);
      breathe.stop();
    };
  }, [opacity, scale, ringScale, ringOpacity, wordmarkY, wordmarkOpacity, fadeOut, onFinish, holdMs]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.container,
        { backgroundColor: p.bg.base, opacity: fadeOut },
      ]}
    >
      <View style={styles.logoWrap}>
        {/* Reticle pulse ring (sits behind the logo) */}
        <Animated.View
          style={{
            position: "absolute",
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }}
        >
          <Svg width={160} height={160} viewBox="0 0 160 160" fill="none">
            <Circle
              cx={80}
              cy={80}
              r={56}
              stroke={palette.accent.mint}
              strokeWidth={1.4}
              opacity={0.45}
            />
          </Svg>
        </Animated.View>

        {/* Hero logo */}
        <Animated.View
          style={{
            opacity,
            transform: [{ scale }],
          }}
        >
          <Svg width={140} height={140} viewBox="0 0 32 32" fill="none">
            <Defs>
              <LinearGradient id="splash-rim" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={p.ink.default} stopOpacity={0.95} />
                <Stop offset="1" stopColor={p.ink.default} stopOpacity={0.55} />
              </LinearGradient>
            </Defs>
            <Circle cx={13} cy={13} r={9} stroke="url(#splash-rim)" strokeWidth={2} />
            <AnimatedCircle
              cx={13}
              cy={13}
              r={3.4}
              stroke={palette.accent.mint}
              strokeWidth={1.4}
            />
            <Path
              d="M13 9.4 V11.4 M13 14.6 V16.6 M9.4 13 H11.4 M14.6 13 H16.6"
              stroke={palette.accent.mint}
              strokeWidth={1.1}
              strokeLinecap="round"
            />
            <Path
              d="M19.6 19.6 L27 27"
              stroke={p.ink.default}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </View>

      {/* Wordmark + tagline */}
      <Animated.View
        style={{
          alignItems: "center",
          marginTop: 28,
          opacity: wordmarkOpacity,
          transform: [{ translateY: wordmarkY }],
        }}
      >
        <Text style={[styles.wordmark, { color: p.ink.default }]}>Loupe</Text>
        <Text style={[styles.tagline, { color: withAlpha(p.ink.default, 0.5) }]}>
          FORENSIC GRADING · MARKETS
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  tagline: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
