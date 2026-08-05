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
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "@react-navigation/native";
import { CheckCheck, FolderKanban, Trash2, X } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { useVaultSelectionChrome } from "@/application/hooks/useVaultSelectionChrome";
import { useVaultSelection } from "@/application/stores/vaultSelectionStore";
import { IslandAction } from "@/presentation/navigation/IslandAction";
import {
  useIslandPresence,
  type IslandPresentation,
} from "@/presentation/navigation/islandNavStore";
import {
  IslandNavPill,
  ISLAND_PILL_HEIGHT,
} from "@/presentation/navigation/IslandNavPill";
import { islandBadgeIn } from "@/presentation/navigation/islandNavMotion";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Selection actions row — meant to live inside a persistent IslandNavPill. */
export function VaultSelectionIslandContent() {
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
    <>
      <IslandAction
        label="Select every card in view"
        onPress={onSelectAll}
        disabled={busy}
        accent={p.accent.blue}
      >
        <CheckCheck size={18} color={p.accent.blue} strokeWidth={2.5} />
      </IslandAction>

      <IslandAction
        label="Organize selected cards into collections"
        onPress={onOrganize}
        disabled={!canAct}
        accent={p.accent.mint}
      >
        <FolderKanban size={18} color={p.accent.mint} strokeWidth={2.5} />
      </IslandAction>

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

      <IslandAction
        label={`Remove ${countLabel} selected ${count === 1 ? "card" : "cards"}`}
        onPress={onRemove}
        disabled={!canAct}
        accent={p.accent.rose}
      >
        <Trash2 size={18} color={p.accent.rose} strokeWidth={2.5} />
      </IslandAction>
    </>
  );
}

/** Count badge overlapping the pill's top-right corner. */
export function VaultSelectionIslandBadge() {
  const p = useThemedPalette();
  const { count, busy } = useVaultSelectionChrome();
  const countLabel = count > 99 ? "99+" : String(count);

  if (count <= 0) return null;

  return (
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
  );
}

export function VaultSelectionIsland() {
  return (
    <View>
      <IslandNavPill>
        <VaultSelectionIslandContent />
      </IslandNavPill>
      <VaultSelectionIslandBadge />
    </View>
  );
}

/** The vault-select face of the island navbar (stable identity — see store). */
const VAULT_SELECTION_ISLAND: IslandPresentation = {
  key: "vault-selection",
  Content: VaultSelectionIslandContent,
  Badge: VaultSelectionIslandBadge,
};

/**
 * Called ONCE by the Vault screen: shows the selection face while cards are
 * staged and the screen is focused, and clears a lingering selection when
 * the user leaves the tab (a ghost mode otherwise survives navigation).
 */
export function useVaultSelectionIslandPresence(): void {
  const selecting = useVaultSelection((s) => s.mode === "select");
  const clear = useVaultSelection((s) => s.clear);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused && selecting) clear();
  }, [isFocused, selecting, clear]);

  useIslandPresence(selecting && isFocused, VAULT_SELECTION_ISLAND);
}
