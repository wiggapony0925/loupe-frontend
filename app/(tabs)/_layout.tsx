import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
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
import { Gauge, Layers, BarChart3, Camera, Search, Zap } from "lucide-react-native";
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
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                marginTop: -12,
                backgroundColor: focused
                  ? p.accent.mint
                  : withAlpha(p.accent.mint, 0.18),
                borderWidth: 1,
                borderColor: focused
                  ? p.accent.mint
                  : withAlpha(p.accent.mint, 0.4),
              }}
            >
              <Camera
                size={20}
                color={focused ? p.bg.base : p.accent.mint}
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
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scan actions"
          onPress={() => setMenuOpen(false)}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 96,
            backgroundColor: "rgba(0,0,0,0.16)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              padding: 8,
              borderRadius: 24,
              backgroundColor: p.bg.elevated,
              borderWidth: 1,
              borderColor: p.line.default,
              shadowColor: "#000",
              shadowOpacity: 0.22,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 16,
            }}
          >
            <ScanShortcutTarget
              label="Grade"
              icon="grade"
              tint={p.accent.mint}
              palette={p}
              onPress={() => navigateToShortcut("grade")}
            />
            <ScanShortcutTarget
              label="Identify"
              icon="identify"
              tint={p.accent.blue}
              palette={p}
              onPress={() => navigateToShortcut("identify")}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ScanShortcutTarget({
  label,
  icon,
  tint,
  palette: p,
  onPress,
}: {
  label: string;
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
      accessibilityLabel={label === "Grade" ? "Open grade scanner" : "Open quick identify scanner"}
      style={({ pressed }) => ({
        width: 112,
        minHeight: 62,
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 9,
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        backgroundColor: withAlpha(tint, pressed ? 0.22 : 0.12),
        borderWidth: 1,
        borderColor: withAlpha(tint, pressed ? 0.62 : 0.34),
        shadowColor: tint,
        shadowOpacity: pressed ? 0.26 : 0.14,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      })}
    >
      <Icon size={18} color={tint} />
      <Text
        style={{
          color: p.ink.default,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
