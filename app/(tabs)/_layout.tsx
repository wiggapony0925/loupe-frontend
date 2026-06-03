import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  useColorScheme,
  View,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router, Tabs } from "expo-router";
import {
  BarChart3,
  Camera,
  ChevronRight,
  Gauge,
  Layers,
  Search,
  X,
  Zap,
} from "lucide-react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useSettings } from "@/application/stores/settingsStore";
import { routes } from "@/shared/routes";

type ScanShortcut = "grade" | "identify";

interface ScanTabButtonProps {
  children?: React.ReactNode;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean };
  testID?: string;
  palette: ReturnType<typeof useThemedPalette>;
}

export default function TabsLayout() {
  // Subscribe to theme so the screenOptions object below is rebuilt with
  // the freshly-mutated palette values when the user toggles Light/Dark.
  const themeMode = useSettings((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const p = useThemedPalette();
  // Resolve to the actual visible scheme so "Auto" mode also remounts the
  // navigator when the device theme flips.
  const resolved = themeMode === "system" ? (systemScheme ?? "dark") : themeMode;

  return (
    <Tabs
      // Force the tab navigator to remount on theme change so React Navigation
      // re-applies tabBarStyle / colors cleanly (it caches some style props).
      key={resolved}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent.mint,
        tabBarInactiveTintColor: p.ink.dim,
        tabBarStyle: {
          backgroundColor: p.bg.elevated,
          borderTopColor: p.line.default,
          borderTopWidth: 0.5,
          height: 84,
          paddingTop: 8,
        },
        // Give each tab item a bit more horizontal breathing room and
        // keep its label on a single line so longer titles
        // (COMMAND, ANALYTICS) never get truncated with an ellipsis on
        // narrower devices.
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          // Previously 1.5 — combined with uppercase this pushed labels
          // like "ANALYTICS" past the tab width on smaller phones and
          // they rendered as "ANALYTI…". 0.5 keeps the spacious feel
          // without overflowing.
          letterSpacing: 0.5,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Command",
          tabBarIcon: ({ color }) => <Gauge size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: "Vault",
          tabBarIcon: ({ color }) => <Layers size={20} color={color} />,
        }}
      />
      {/* Center-pinned Scan tab — primary verb of the app. Rendered as a
          mint-tinted pill so the eye lands on it first, the same way
          Robinhood/Cash App elevate their core action in the middle
          slot. Replaced the old Watch tab; price alerts now live behind
          the bell inside Notifications. */}
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarButton: (props) => <ScanTabButton {...props} palette={p} />,
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                marginTop: -18,
                backgroundColor: focused
                  ? p.accent.mint
                  : withAlpha(p.accent.mint, 0.18),
                borderWidth: 1,
                borderColor: focused
                  ? p.accent.mint
                  : withAlpha(p.accent.mint, 0.4),
                shadowColor: p.accent.mint,
                shadowOpacity: focused ? 0.3 : 0.14,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 10,
              }}
            >
              <Camera
                size={23}
                color={focused ? p.bg.base : p.accent.mint}
                strokeWidth={2.3}
              />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: p.accent.mint,
            // The icon sits in a 44dp circle pulled up by marginTop:-12,
            // which leaves the label too close to the camera glyph. Push
            // it back down so it visually aligns with the neighbouring
            // tab labels (VAULT / SEARCH) instead of crowding the icon.
            marginTop: 6,
          },
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Search size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <BarChart3 size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

function ScanTabButton({
  children,
  onPress,
  onLongPress,
  style,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  testID,
  palette: p,
}: ScanTabButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigateToShortcut = useCallback((target: ScanShortcut) => {
    const href = target === "grade" ? routes.scanPhone("studio") : routes.scanIdentify();
    setMenuOpen(false);
    router.push(href);
  }, []);

  const selected = accessibilityState?.selected === true;

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={(event) => {
          onLongPress?.(event);
          setMenuOpen(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
        delayLongPress={260}
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        testID={testID}
        style={({ pressed }) => [{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.76 : 1,
          transform: [{ scale: selected ? 1.02 : 1 }],
        }, style]}
      >
        {children}
      </Pressable>
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ScanActionSheet
            palette={p}
            onClose={() => setMenuOpen(false)}
            onSelect={navigateToShortcut}
          />
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

/**
 * Draggable bottom sheet for the long-press Scan menu. Slides up from the
 * tab bar, can be dragged down (or tapped on the scrim) to dismiss, and
 * exposes the two quick-scan actions. Uses gesture-handler + reanimated so
 * the drag runs on the UI thread (the old PanResponder version crashed).
 */
function ScanActionSheet({
  palette: p,
  onClose,
  onSelect,
}: {
  palette: ReturnType<typeof useThemedPalette>;
  onClose: () => void;
  onSelect: (target: ScanShortcut) => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18, stiffness: 260, mass: 0.7 });
    opacity.value = withTiming(1, { duration: 180 });
    scale.value = withSpring(1, { damping: 16, stiffness: 240, mass: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateClose = useCallback(() => {
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.96, { duration: 160 });
    translateY.value = withTiming(220, { duration: 180 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 700) {
        runOnJS(animateClose)();
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 240,
          mass: 0.7,
        });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleSelect = useCallback(
    (target: ScanShortcut) => {
      Haptics.selectionAsync().catch(() => {});
      onSelect(target);
    },
    [onSelect],
  );

  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scan actions"
          onPress={animateClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.62)" }]}
        />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              marginHorizontal: 16,
              marginBottom: Math.max(insets.bottom, 8) + 88,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 16,
              borderRadius: 28,
              backgroundColor: p.bg.elevated,
              borderWidth: 1,
              borderColor: p.line.default,
              shadowColor: "#000",
              shadowOpacity: 0.34,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 18 },
              elevation: 24,
            },
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: withAlpha(p.ink.dim, 0.4),
              marginBottom: 12,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <View>
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 20,
                  fontWeight: "800",
                }}
              >
                Scan
              </Text>
              <Text
                style={{
                  color: p.ink.dim,
                  fontSize: 12,
                  fontWeight: "600",
                  marginTop: 2,
                }}
              >
                Choose the camera mode
              </Text>
            </View>
            <Pressable
              onPress={animateClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close scan actions"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.ink.default, 0.08),
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <X size={18} color={p.ink.dim} />
            </Pressable>
          </View>
          <View style={{ gap: 12 }}>
            <ScanShortcutTarget
              label="Identify card"
              caption="Fast match, price, then add"
              icon="identify"
              tint={p.accent.blue}
              palette={p}
              onPress={() => handleSelect("identify")}
            />
            <ScanShortcutTarget
              label="Grade card"
              caption="Capture front and back"
              icon="grade"
              tint={p.accent.mint}
              palette={p}
              onPress={() => handleSelect("grade")}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function ScanShortcutTarget({
  label,
  caption,
  icon,
  tint,
  palette: p,
  onPress,
}: {
  label: string;
  caption: string;
  icon: ScanShortcut;
  tint: string;
  palette: ReturnType<typeof useThemedPalette>;
  onPress: () => void;
}) {
  const Icon = icon === "grade" ? Camera : Zap;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={icon === "grade" ? "Open grade scanner" : "Open quick identify scanner"}
      style={({ pressed }) => ({
        alignSelf: "stretch",
        borderRadius: 20,
        backgroundColor: pressed ? withAlpha(tint, 0.14) : p.bg.base,
        borderWidth: 1,
        borderColor: withAlpha(tint, pressed ? 0.64 : 0.24),
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 76,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(tint, 0.18),
            marginRight: 12,
          }}
        >
          <Icon size={22} color={tint} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.default,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: p.ink.dim,
              fontSize: 12,
              fontWeight: "500",
              marginTop: 2,
            }}
          >
            {caption}
          </Text>
        </View>
        <ChevronRight
          size={18}
          color={withAlpha(p.ink.muted, 0.85)}
          strokeWidth={2.4}
          style={{ marginLeft: 8 }}
        />
      </View>
    </Pressable>
  );
}
