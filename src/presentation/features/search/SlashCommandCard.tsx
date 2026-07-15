/**
 * SlashCommandCard — the "/" command suggestion (Slack-style).
 *
 * Typing "/" floats this card under the search bar. Three ways to accept:
 * tap it, press return, or SWIPE IT LEFT — dragging reveals a mint arrow
 * behind the card, and past the threshold it slides away and autocompletes
 * into AI mode.
 */
import React, { useRef } from "react";
import { Animated, PanResponder, Text, View } from "react-native";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const ACCEPT_DX = -64;

export function SlashCommandCard({ onAccept }: { onAccept: () => void }) {
  const p = useThemedPalette();
  const drag = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      // Claim only clearly-horizontal, leftward drags; taps fall through to
      // the Pressable-like release handling below.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        drag.setValue(Math.min(0, g.dx)); // left only
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < ACCEPT_DX) {
          // Commit: slide off-screen, accept, then reset for next time.
          Animated.timing(drag, {
            toValue: -420,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            drag.setValue(0);
            onAccept();
          });
        } else if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          // A tap.
          onAccept();
        } else {
          Animated.spring(drag, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, {
          toValue: 0,
          friction: 7,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <View style={{ marginTop: 10 }}>
      {/* The arrow revealed behind the card as it slides left. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 14,
          justifyContent: "center",
          alignItems: "flex-end",
        }}
      >
        <Animated.View
          style={{
            opacity: drag.interpolate({
              inputRange: [ACCEPT_DX, -12, 0],
              outputRange: [1, 0.35, 0],
              extrapolate: "clamp",
            }),
            transform: [
              {
                scale: drag.interpolate({
                  inputRange: [ACCEPT_DX, 0],
                  outputRange: [1.15, 0.8],
                  extrapolate: "clamp",
                }),
              },
            ],
          }}
        >
          <ArrowLeft size={18} color={p.accent.mint} />
        </Animated.View>
      </View>

      <Animated.View
        {...pan.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Ask Loupe AI — tap, press return, or swipe left to describe the card in your own words"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, 0.4),
          backgroundColor: withAlpha(p.accent.mint, 0.06),
          transform: [{ translateX: drag }],
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.16),
          }}
        >
          <Sparkles size={16} color={p.accent.mint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: p.accent.mint, fontSize: 13, fontWeight: "800" }}>
              /ai
            </Text>
            <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
              Ask Loupe AI
            </Text>
          </View>
          <Text style={{ color: p.ink.dim, fontSize: 11, marginTop: 1 }}>
            Swipe left or press return · describe the card in your own words
          </Text>
        </View>
        <ChevronRight size={15} color={p.ink.dim} />
      </Animated.View>
    </View>
  );
}
