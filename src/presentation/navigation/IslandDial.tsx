/**
 * IslandDial — THE press-and-drag selector inside the island navbar.
 *
 * One interaction, every face: press and drag across the pill and the
 * highlight springs under your finger with a haptic tick per item; release
 * to commit. Plain taps still work. The tab bar's page dial and the
 * community rail both render through this — the drag behavior is the
 * island's signature move and must never fork per face.
 *
 * Items are declarative: `selectable` items participate in the drag +
 * highlight; decorative or self-handled slots (a FAB with its own
 * long-press menu) render inline and stay out of the hit-test.
 */
import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export const DIAL_ITEM_WIDTH = 50;
export const DIAL_HEIGHT = 60;
const HIGHLIGHT_HEIGHT = 44;

export interface DialItem {
  key: string;
  /** Accessibility label. */
  label: string;
  /** Participates in drag + highlight (default true). */
  selectable?: boolean;
  /** Slot width (defaults to the standard item width). */
  width?: number;
  /** Content. `active` reflects highlight-under-finger OR the active key. */
  render: (active: boolean) => React.ReactNode;
  /** Tap handler; defaults to committing this key. */
  onPress?: () => void;
}

export function IslandDial({
  items,
  activeKey,
  onCommit,
}: {
  items: DialItem[];
  activeKey: string | null;
  onCommit: (key: string) => void;
}) {
  const p = useThemedPalette();

  // Item layout (x + width) in the pill's coordinate space, keyed by item.
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const highlightX = useSharedValue(0);
  const highlightW = useSharedValue(DIAL_ITEM_WIDTH);
  const highlightReady = useSharedValue(0);
  // `dragKey` drives rendering; the ref mirrors it so pan callbacks can
  // compare/commit without side effects inside a setState updater.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const setDrag = useCallback((key: string | null) => {
    dragKeyRef.current = key;
    setDragKey(key);
  }, []);

  const moveHighlightTo = useCallback(
    (key: string, animated = true) => {
      const l = layouts.current[key];
      if (!l) return;
      highlightReady.value = 1;
      if (animated) {
        highlightX.value = withSpring(l.x, {
          damping: 22,
          stiffness: 260,
          mass: 0.7,
        });
        highlightW.value = withSpring(l.width, { damping: 22, stiffness: 260 });
      } else {
        highlightX.value = l.x;
        highlightW.value = l.width;
      }
    },
    [highlightX, highlightW, highlightReady],
  );

  // Keep the highlight under the active item; fade it when nothing is.
  React.useEffect(() => {
    if (dragKey) return;
    if (activeKey && layouts.current[activeKey]) {
      moveHighlightTo(activeKey);
    } else {
      highlightReady.value = withTiming(0, { duration: 140 });
    }
  }, [activeKey, dragKey, moveHighlightTo, highlightReady]);

  const hitTest = useCallback(
    (x: number): string | null => {
      for (const item of items) {
        if (item.selectable === false) continue;
        const l = layouts.current[item.key];
        if (l && x >= l.x && x <= l.x + l.width) return item.key;
      }
      return null;
    },
    [items],
  );

  const onDragMove = useCallback(
    (x: number) => {
      const hit = hitTest(x);
      if (hit && hit !== dragKeyRef.current) {
        Haptics.selectionAsync().catch(() => {});
        moveHighlightTo(hit);
        setDrag(hit);
      }
    },
    [hitTest, moveHighlightTo, setDrag],
  );

  const commitDrag = useCallback(() => {
    const key = dragKeyRef.current;
    if (key && key !== activeKey) {
      onCommit(key);
    } else if (activeKey && layouts.current[activeKey]) {
      moveHighlightTo(activeKey);
    }
    setDrag(null);
  }, [activeKey, onCommit, moveHighlightTo, setDrag]);

  // Horizontal drag = the dial. activeOffsetX lets vertical/short touches
  // fall through to the per-item Pressables (plain taps still work).
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-10, 10])
    .onBegin((e) => onDragMove(e.x))
    .onUpdate((e) => onDragMove(e.x))
    .onEnd(commitDrag)
    .onFinalize(commitDrag);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightReady.value,
    width: highlightW.value,
    transform: [{ translateX: highlightX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.row}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              backgroundColor: withAlpha(p.accent.mint, 0.16),
              borderColor: withAlpha(p.accent.mint, 0.5),
            },
            highlightStyle,
          ]}
        />
        {items.map((item) => {
          const active = (dragKey ?? activeKey) === item.key;
          const width = item.width ?? DIAL_ITEM_WIDTH;
          if (item.selectable === false) {
            // Self-handled slot (e.g. a FAB with its own gestures).
            return <React.Fragment key={item.key}>{item.render(active)}</React.Fragment>;
          }
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                if (item.onPress) item.onPress();
                else if (item.key !== activeKey) onCommit(item.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              onLayout={(e) => {
                layouts.current[item.key] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
                if (item.key === activeKey && !dragKeyRef.current) {
                  moveHighlightTo(item.key, false);
                }
              }}
              style={[styles.item, { width }]}
            >
              {item.render(active)}
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  highlight: {
    position: "absolute",
    top: (DIAL_HEIGHT - HIGHLIGHT_HEIGHT) / 2,
    height: HIGHLIGHT_HEIGHT,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    height: DIAL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
