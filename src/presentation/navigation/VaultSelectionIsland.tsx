/**
 * VaultSelectionIsland — contextual island navbar while multi-selecting
 * vault holdings. Replaces the normal tab dial:
 *
 *   [Select all] [Organize]  ·  [X cancel, rose center]  ·  [Trash]
 *
 * The live selected count rides as a badge bubble overlapping the pill's
 * top-right corner (like an app-icon notification). Pressing X (or
 * clearing the last card) restores the regular island.
 */
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { CheckCheck, FolderKanban, Trash2, X } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { useVaultSelectionChrome } from "@/application/hooks/useVaultSelectionChrome";
import {
  IslandNavPill,
  ISLAND_PILL_HEIGHT,
} from "@/presentation/navigation/IslandNavPill";
import { islandBadgeIn } from "@/presentation/navigation/islandNavMotion";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const SIDE_W = 56;

/** Circular icon action inside the selection island. */
function IslandAction({
  label,
  onPress,
  disabled,
  accent,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: SIDE_W,
        height: ISLAND_PILL_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(accent, pressed ? 0.28 : 0.16),
            transform: [{ scale: pressed ? 0.92 : 1 }],
          }}
        >
          {children}
        </View>
      )}
    </Pressable>
  );
}

export function VaultSelectionIsland() {
  const p = useThemedPalette();
  const {
    count,
    canAct,
    busy,
    clear,
    requestOrganize,
    requestRemove,
    requestSelectAll,
  } = useVaultSelectionChrome();

  const countLabel = count > 99 ? "99+" : String(count);

  const onCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    clear();
  };

  const onSelectAll = () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    requestSelectAll();
  };

  const onOrganize = () => {
    if (!canAct) return;
    Haptics.selectionAsync().catch(() => {});
    requestOrganize();
  };

  const onRemove = () => {
    if (!canAct) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    requestRemove();
  };

  return (
    <View>
      <IslandNavPill>
        {/* Select all — far left */}
        <IslandAction
          label="Select every card in view"
          onPress={onSelectAll}
          disabled={busy}
          accent={p.accent.blue}
        >
          <CheckCheck size={18} color={p.accent.blue} strokeWidth={2.5} />
        </IslandAction>

        {/* Organize */}
        <IslandAction
          label="Organize selected cards into collections"
          onPress={onOrganize}
          disabled={!canAct}
          accent={p.accent.mint}
        >
          <FolderKanban size={18} color={p.accent.mint} strokeWidth={2.5} />
        </IslandAction>

        {/* Cancel — rose center (replaces Scan FAB) */}
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel selection"
          style={{
            width: 60,
            height: ISLAND_PILL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {({ pressed }) => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: p.accent.rose || "#d63b30",
                opacity: busy ? 0.5 : pressed ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
                shadowColor: p.accent.rose,
                shadowOpacity: 0.35,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <X size={22} color="#ffffff" strokeWidth={2.6} />
            </View>
          )}
        </Pressable>

        {/* Remove — far right */}
        <IslandAction
          label={`Remove ${countLabel} selected ${count === 1 ? "card" : "cards"}`}
          onPress={onRemove}
          disabled={!canAct}
          accent={p.accent.rose}
        >
          <Trash2 size={18} color={p.accent.rose} strokeWidth={2.5} />
        </IslandAction>
      </IslandNavPill>

      {/* Count badge — bubble overlapping the pill's top-right corner,
          like an app-icon notification. Re-keyed per count so it pops. */}
      {count > 0 ? (
        <Animated.View
          key={count}
          entering={islandBadgeIn}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -8,
            right: -6,
            minWidth: 24,
            height: 24,
            paddingHorizontal: 7,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: p.accent.rose || "#d63b30",
            borderWidth: 2,
            borderColor: p.bg.base,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={{ transform: [{ scale: 0.7 }] }}
            />
          ) : (
            <Text
              style={{
                color: "#fff",
                fontSize: 12,
                fontWeight: "900",
                fontVariant: ["tabular-nums"],
              }}
            >
              {countLabel}
            </Text>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}
