/**
 * CommunityIsland — the island navbar's face while browsing Community.
 *
 * The tab dial morphs into a purpose-built rail (same crossfade as vault
 * multi-select — the shared island motion runs off the face's key):
 *
 *   [People — you're here] · [Home, mint center] · [My profile]
 *
 * The center slot deliberately mirrors the Scan FAB's size and weight, but
 * green-camera becomes green-home: inside the community micro-app the
 * primary verb isn't "scan", it's "take me back to the main app".
 */
import React from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "@react-navigation/native";
import { Home, UserRound, Users } from "lucide-react-native";
import { router } from "expo-router";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { IslandAction } from "@/presentation/navigation/IslandAction";
import { ISLAND_PILL_HEIGHT } from "@/presentation/navigation/IslandNavPill";
import {
  useIslandPresence,
  type IslandPresentation,
} from "@/presentation/navigation/islandNavStore";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

function CommunityIslandContent() {
  const p = useThemedPalette();
  const me = useSocialMe();
  const profile = me.data?.profile ?? null;

  const goHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.navigate(routes.home());
  };

  const goPeople = () => {
    // The "you are here" slot — Community IS the people surface. Re-navigate
    // (idempotent) so a tap from a drilled-in state still lands on the list.
    Haptics.selectionAsync().catch(() => {});
    router.navigate(routes.community());
  };

  const goMyProfile = () => {
    Haptics.selectionAsync().catch(() => {});
    if (profile) {
      router.push(routes.myProfile());
    } else {
      // No handle yet — the claim card is front and center on Community.
      router.navigate(routes.community());
    }
  };

  return (
    <>
      <IslandAction
        label="Community — find and follow collectors"
        onPress={goPeople}
        accent={p.accent.blue}
        active
      >
        <Users size={18} color={p.accent.blue} strokeWidth={2.5} />
      </IslandAction>

      {/* Center: the FAB slot — home instead of the camera. */}
      <Pressable
        onPress={goHome}
        accessibilityRole="button"
        accessibilityLabel="Back to the main app"
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
              backgroundColor: p.accent.mint,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: p.accent.mint,
              shadowOpacity: pressed ? 0.2 : 0.3,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              transform: [{ scale: pressed ? 0.94 : 1 }],
            }}
          >
            <Home size={22} color="#06140d" strokeWidth={2.4} />
          </View>
        )}
      </Pressable>

      <IslandAction
        label={
          profile
            ? "My profile — edit bio, picture, privacy"
            : "Claim a username to create your profile"
        }
        onPress={goMyProfile}
        accent={p.accent.mint}
      >
        {profile ? (
          <SocialAvatar
            handle={profile.username}
            url={profile.avatar_url}
            size={30}
          />
        ) : (
          <UserRound size={18} color={p.accent.mint} strokeWidth={2.5} />
        )}
      </IslandAction>
    </>
  );
}

/** The community face of the island navbar (stable identity — see store). */
const COMMUNITY_ISLAND: IslandPresentation = {
  key: "community",
  Content: CommunityIslandContent,
};

/** Called once by the Community screen: face follows the screen's focus. */
export function useCommunityIslandPresence(): void {
  const isFocused = useIsFocused();
  useIslandPresence(isFocused, COMMUNITY_ISLAND);
}
