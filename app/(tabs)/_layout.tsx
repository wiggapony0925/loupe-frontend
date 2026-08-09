import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router, Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import {
  BarChart3,
  Camera,
  ChevronRight,
  Gauge,
  Layers,
  type LucideIcon,
  Search,
  Sparkles,
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
import { IslandNavPill } from "@/presentation/navigation/IslandNavPill";
import {
  islandContentIn,
  islandContentOut,
  islandShellLayout,
} from "@/presentation/navigation/islandNavMotion";
import {
  useActiveIsland,
  type IslandPresentation,
} from "@/presentation/navigation/islandNavStore";
import { IslandDial, type DialItem } from "@/presentation/navigation/IslandDial";

const isIOS = Platform.OS === "ios";

type ScanShortcut = "grade" | "identify" | "playground";

/**
 * The four page tabs, in bar order. Scan is not here — it's the raised
 * center FAB (a launcher, not a page), inserted between `vault` and
 * `search`. This order MUST match the <Tabs.Screen> order below.
 */
const NAV_TABS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: "index", label: "Command", Icon: Gauge },
  { name: "vault", label: "Vault", Icon: Layers },
  { name: "search", label: "Search", Icon: Search },
  { name: "analytics", label: "Analytics", Icon: BarChart3 },
];

/** A tab icon with a subtle mint pill behind it when active (Android). */
function TabIcon({
  Icon,
  focused,
  color,
  palette: p,
}: {
  Icon: LucideIcon;
  focused: boolean;
  color: string;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 46,
        height: 30,
        borderRadius: 999,
        backgroundColor: focused ? withAlpha(p.accent.mint, 0.14) : "transparent",
      }}
    >
      <Icon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
    </View>
  );
}

export default function TabsLayout() {
  // Subscribe to theme so the screenOptions object below is rebuilt with
  // the freshly-mutated palette values when the user toggles Light/Dark.
  const themeMode = useSettings((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  const resolved = themeMode === "system" ? (systemScheme ?? "dark") : themeMode;

  return (
    <Tabs
      key={resolved}
      // iOS gets a fully custom compact, centered glass pill with a
      // press-and-drag page switcher (see LoupeTabBar). Android keeps the
      // stock flat bar (glass + custom gestures are unreliable there), so
      // the tabBarIcon / tabBarButton options below still drive it.
      tabBar={(props) => <LoupeTabBar {...props} palette={p} />}
      screenOptions={{
        headerShown: false,
        // Subtle horizontal shift when switching tabs — avoids the hard cut.
        animation: isIOS ? "shift" : "fade",
        tabBarActiveTintColor: p.accent.mint,
        tabBarInactiveTintColor: p.ink.dim,
        tabBarStyle: {
          backgroundColor: p.bg.base,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.line.default,
          height: 56 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Command",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Gauge} focused={focused} color={color} palette={p} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: "Vault",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Layers} focused={focused} color={color} palette={p} />
          ),
        }}
      />
      {/* Scan — the app's primary verb, a raised circular FAB in the center.
          Long-press opens the camera-mode sheet. */}
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarButton: () => <ScanFab palette={p} variant="android" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Search} focused={focused} color={color} palette={p} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={BarChart3} focused={focused} color={color} palette={p} />
          ),
        }}
      />
      {/* Community lives INSIDE the tab navigator purely so the bar stays on
          screen there — the old WebView embed sat above the tabs at the root
          and dropped it, which is most of why the page read as a website in
          a frame. `href: null` keeps it out of the dial: the entry point is
          the people icon on Command, and a sixth item would crowd a bar
          deliberately built as a compact pill. */}
      <Tabs.Screen name="community" options={{ href: null, title: "Community" }} />
      {/* Collector profiles live in the tab group for the same reason as
          Community: the island navbar stays on screen while browsing a
          profile or collection, and switching pages inherits the tabs'
          shift animation instead of a stack push. */}
      <Tabs.Screen name="u/[handle]" options={{ href: null, title: "Collector" }} />
      {/* Notifications lives in the tab group for the SAME reason Community
          does: the floating island stays on screen, so the drag-to-switch
          gesture still works from the inbox instead of stranding you there
          with only a back button. The route is still `/notifications` —
          `(tabs)` is a group, so it adds no path segment. */}
      <Tabs.Screen name="notifications" options={{ href: null, title: "Alerts" }} />
    </Tabs>
  );
}

// ───────────────────────── iOS custom tab bar ─────────────────────────

/**
 * LoupeTabBar — the iOS bar. A COMPACT, CENTERED liquid-glass pill (not the
 * full-width spread of the stock bar) with an iOS-Camera-style page dial:
 * press and drag your finger across it and the active page follows your
 * finger with a haptic tick at each tab and a highlight that springs under
 * it; release to land. Tapping a tab still works. The Scan FAB sits raised
 * in the center. On Android this returns the stock BottomTabBar.
 */
function LoupeTabBar(
  props: BottomTabBarProps & { palette: ReturnType<typeof useThemedPalette> },
) {
  const { state, navigation, palette: p } = props;
  const insets = useSafeAreaInsets();

  const activeName = state.routes[state.index]?.name ?? "index";
  // Whatever face a feature has presented (vault multi-select, community
  // rail, …) — null means the default tab dial. Screens drive this through
  // useIslandPresence; the bar itself knows no feature specifics.
  const island = useActiveIsland();

  if (!isIOS) {
    // Android: overlay the contextual island above the stock bar when active.
    if (island) {
      return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <LoupeFloatingIsland
            bottomInset={Math.max(insets.bottom, 10)}
            island={island}
          />
        </View>
      );
    }
    return <BottomTabBar {...props} />;
  }

  // The page dial: [Command, Vault] · Scan FAB · [Search, Analytics],
  // rendered through the SHARED IslandDial so press-and-drag switching is
  // identical on every island face (community included).
  const dialItems: DialItem[] = [
    ...NAV_TABS.slice(0, 2).map((t) => tabItem(t, p)),
    {
      key: "__scan__",
      label: "Scan a card",
      selectable: false,
      width: 60,
      render: () => <ScanFab palette={p} variant="ios" />,
    },
    ...NAV_TABS.slice(2).map((t) => tabItem(t, p)),
  ];

  return (
    <LoupeFloatingIsland
      bottomInset={Math.max(insets.bottom, 10)}
      island={island}
      tabDial={
        <IslandDial
          items={dialItems}
          activeKey={NAV_TABS.some((t) => t.name === activeName) ? activeName : null}
          onCommit={(key) => navigation.navigate(key as never)}
        />
      }
    />
  );
}

/** One page tab as a dial item. */
function tabItem(
  t: (typeof NAV_TABS)[number],
  p: ReturnType<typeof useThemedPalette>,
): DialItem {
  const { Icon } = t;
  return {
    key: t.name,
    label: t.label,
    render: (active: boolean) => (
      <Icon
        size={22}
        color={active ? p.accent.mint : p.ink.dim}
        strokeWidth={active ? 2.5 : 2}
      />
    ),
  };
}

/**
 * Persistent glass pill — shell never fades; only inner content crossfades
 * when a contextual face (vault multi-select, community rail, …) replaces
 * the tab dial. Keying the inner view by the face's `key` re-runs the same
 * morph for EVERY state change, so new modes inherit the animation for free.
 */
function LoupeFloatingIsland({
  bottomInset,
  island,
  tabDial,
}: {
  bottomInset: number;
  island: IslandPresentation | null;
  tabDial?: React.ReactNode;
}) {
  const Badge = island?.Badge;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomInset,
        alignItems: "center",
      }}
    >
      <Animated.View layout={islandShellLayout} style={{ position: "relative" }}>
        <IslandNavPill>
          <Animated.View
            key={island?.key ?? "tab-dial"}
            entering={islandContentIn}
            exiting={islandContentOut}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            {island ? <island.Content /> : tabDial}
          </Animated.View>
        </IslandNavPill>
        {Badge ? <Badge /> : null}
      </Animated.View>
    </View>
  );
}

// ───────────────────────── Scan FAB + menu ─────────────────────────

/**
 * The raised Scan launcher — tap opens the camera instantly, long-press
 * opens the camera-mode sheet. Shared by the iOS pill (`variant="ios"`) and
 * the Android stock bar (`variant="android"`, where it's the tabBarButton).
 */
function ScanFab({
  palette: p,
  variant,
}: {
  palette: ReturnType<typeof useThemedPalette>;
  variant: "ios" | "android";
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigateToShortcut = useCallback((target: ScanShortcut) => {
    const href =
      target === "grade"
        ? routes.scanPhone("studio")
        : target === "playground"
          ? routes.gradePlayground()
          : routes.scanEntry();
    setMenuOpen(false);
    router.push(href);
  }, []);

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push(routes.scanEntry());
        }}
        onLongPress={() => {
          setMenuOpen(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }}
        delayLongPress={260}
        accessibilityRole="button"
        accessibilityLabel="Scan a card. Opens the camera. Press and hold for more scan modes."
        style={
          variant === "android"
            ? { flex: 1, alignItems: "center", justifyContent: "flex-start" }
            : { width: 60, alignItems: "center", justifyContent: "center", height: 60 }
        }
      >
        {({ pressed }) => (
          <View
            style={[
              {
                // On iOS, keep the FAB perfectly centered inside the 60px glass pill
                // instead of popping out and breaking the shape.
                marginTop: variant === "android" ? -16 : 0,
                width: variant === "android" ? 54 : 48,
                height: variant === "android" ? 54 : 48,
                borderRadius: variant === "android" ? 27 : 24,
                backgroundColor: p.accent.mint,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: variant === "android" ? 4 : 0,
                borderColor: variant === "android" ? p.bg.base : "transparent",
                shadowColor: p.accent.mint,
                shadowOpacity: variant === "android" ? 0.45 : 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              },
              pressed && { transform: [{ scale: 0.94 }], shadowOpacity: 0.2 },
            ]}
          >
            <Camera size={variant === "android" ? 24 : 22} color="#06140d" strokeWidth={2.4} />
          </View>
        )}
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
 * exposes the quick-scan actions. gesture-handler + reanimated so the drag
 * runs on the UI thread.
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
              <Text style={{ color: p.ink.default, fontSize: 20, fontWeight: "800" }}>
                Scan
              </Text>
              <Text
                style={{ color: p.ink.dim, fontSize: 12, fontWeight: "600", marginTop: 2 }}
              >
                Choose the camera mode
              </Text>
            </View>
            <Pressable
              onPress={animateClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close scan actions"
              style={({ pressed }) => [{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.ink.default, 0.08),
                opacity: pressed ? 0.65 : 1,
              }]}
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
            <ScanShortcutTarget
              label="Loupe Playground"
              caption="Score it by eye — instant grade estimate"
              icon="playground"
              tint={p.accent.purple}
              palette={p}
              onPress={() => handleSelect("playground")}
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
  const Icon = icon === "grade" ? Camera : icon === "playground" ? Sparkles : Zap;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        icon === "grade"
          ? "Open grade scanner"
          : icon === "playground"
            ? "Open the grade playground"
            : "Open quick identify scanner"
      }
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
            style={{ color: p.ink.default, fontSize: 16, fontWeight: "700" }}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: p.ink.dim, fontSize: 12, fontWeight: "500", marginTop: 2 }}
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
