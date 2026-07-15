/**
 * AiModePill — the "Loupe AI" tag inside the search bar.
 *
 * Entering AI mode plays a two-beat entrance: the label TYPES ITSELF OUT in
 * green with a blinking cursor (the AI announcing itself), then the pill
 * snaps solid mint. Tapping it (or backspacing an empty description) exits
 * the mode.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const LABEL = "Loupe AI";

export function AiModePill({ onExit }: { onExit: () => void }) {
  const p = useThemedPalette();
  const scale = useRef(new Animated.Value(0.6)).current;
  const [chars, setChars] = useState(0);
  const done = chars >= LABEL.length;
  const [blink, setBlink] = useState(true);

  // Beat 1: spring in + type the label out.
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
    const id = setInterval(() => {
      setChars((c) => (c >= LABEL.length ? c : c + 1));
    }, 42);
    return () => clearInterval(id);
  }, [scale]);

  // Cursor blink while typing.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setBlink((b) => !b), 240);
    return () => clearInterval(id);
  }, [done]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onExit}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Exit Loupe AI mode"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingLeft: 8,
          paddingRight: 6,
          paddingVertical: 4,
          borderRadius: 999,
          borderWidth: 1,
          // Beat 2: outline-while-typing → solid mint when the label lands.
          borderColor: done ? p.accent.mint : withAlpha(p.accent.mint, 0.5),
          backgroundColor: done
            ? p.accent.mint
            : withAlpha(p.accent.mint, 0.1),
        }}
      >
        <Sparkles size={11} color={done ? "#04150c" : p.accent.mint} />
        <Text
          style={{
            color: done ? "#04150c" : p.accent.mint,
            fontSize: 11,
            fontWeight: "800",
            minWidth: 52,
          }}
        >
          {LABEL.slice(0, chars)}
          {!done && blink ? "▍" : ""}
        </Text>
        {done ? <X size={10} color="#04150c" /> : null}
      </Pressable>
    </Animated.View>
  );
}
