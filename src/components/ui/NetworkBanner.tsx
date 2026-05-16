import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { WifiOff } from "lucide-react-native";

/**
 * Sticky offline banner.
 *
 * - Debounced: only shows after >1.5s of sustained offline (avoids the
 *   iOS-simulator quirk where the first NetInfo tick can be a false
 *   `isConnected: false`).
 * - Safe-area aware: respects top inset so it never overlaps headers.
 * - Auto-hides instantly when the network returns.
 */
export function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const [showing, setShowing] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPending = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const unsub = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected !== false && state.isInternetReachable !== false;

      if (online) {
        clearPending();
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowing(false));
        return;
      }

      // Debounce offline-show by 1.5s.
      if (!timerRef.current && !showing) {
        timerRef.current = setTimeout(() => {
          setShowing(true);
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }).start();
          timerRef.current = null;
        }, 1500);
      }
    });

    return () => {
      clearPending();
      unsub();
    };
  }, [opacity, showing]);

  if (!showing) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { opacity, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.row}>
        <WifiOff size={14} color="#1A1300" />
        <Text style={styles.title}>You&apos;re offline</Text>
        <Text style={styles.subtitle}>· showing cached data</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#FFD54A",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  title: {
    color: "#1A1300",
    fontSize: 12,
    fontWeight: "700",
  },
  subtitle: {
    color: "#1A1300",
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.7,
  },
});
