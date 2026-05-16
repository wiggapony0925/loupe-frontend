import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { WifiOff } from "lucide-react-native";

/**
 * Sticky offline banner.
 *
 * - Debounced 3s: only shows after sustained offline. Quick blips
 *   (Wi-Fi handoff, VPN reconnect) won't trip it.
 * - Suppressed in iOS Simulator dev builds — NetInfo's captive-portal
 *   probe to `captive.apple.com` regularly times out under simulator
 *   networking, producing false positives. Real devices + production
 *   builds still get the banner.
 * - Uses only `isConnected` (carrier link state). `isInternetReachable`
 *   is intentionally ignored: it depends on the same flaky probe and
 *   reports `false` on VPNs, captive portals, and during DNS hiccups
 *   even when the app's API calls would succeed.
 * - Compact footprint (sits inside status-bar zone) so it doesn't eat
 *   into the screen header below it.
 * - Safe-area aware. `pointerEvents="none"` so taps pass through.
 */
export function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const [showing, setShowing] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (__DEV__ && Platform.OS === "ios") return; // simulator false-positive guard

    const clearPending = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;

      if (online) {
        clearPending();
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowing(false));
        return;
      }

      // Debounce offline-show by 3s.
      if (!timerRef.current && !showing) {
        timerRef.current = setTimeout(() => {
          setShowing(true);
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }).start();
          timerRef.current = null;
        }, 3000);
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
        { opacity, paddingTop: insets.top + 4 },
      ]}
    >
      <View style={styles.row}>
        <WifiOff size={12} color="#1A1300" />
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
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  title: {
    color: "#1A1300",
    fontSize: 11,
    fontWeight: "700",
  },
  subtitle: {
    color: "#1A1300",
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.7,
  },
});
