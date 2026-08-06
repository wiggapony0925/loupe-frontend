/**
 * CommunityIsland — the island navbar's face while browsing Community.
 *
 * The tab dial morphs into a purpose-built rail (same crossfade as vault
 * multi-select — the shared island motion runs off the face's key):
 *
 *   [People] · [Home, mint center] · [My profile]
 *
 * It renders through the SHARED IslandDial, so the island's signature
 * press-and-drag page switching works here exactly like it does on the main
 * tab dial — drag across, haptic tick per slot, release to land. The center
 * slot deliberately mirrors the Scan FAB's size and weight, but
 * green-camera becomes green-home: inside the community micro-app the
 * primary verb isn't "scan", it's "take me back to the main app".
 */
import React from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "@react-navigation/native";
import { Home, UserRound, Users } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import {
  DIAL_HEIGHT,
  IslandDial,
  type DialItem,
} from "@/presentation/navigation/IslandDial";
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
  const pathname = usePathname();

  // Which slot is "here": the people list on /community, my own profile on
  // /u/@me (or my claimed handle). On someone else's profile neither is
  // active and the highlight fades — same rule as the tab dial on Community.
  const handle = pathname.startsWith("/u/")
    ? decodeURIComponent(pathname.slice(3)).toLowerCase()
    : null;
  const isMyHandle =
    handle != null &&
    (handle === "@me" ||
      handle === "me" ||
      handle === profile?.username?.toLowerCase());
  const activeKey =
    pathname === "/community" ? "people" : isMyHandle ? "profile" : null;

  const commit = (key: string) => {
    if (key === "people") {
      // Idempotent — a commit from a drilled-in profile lands on the list.
      router.navigate(routes.community());
    } else if (key === "profile") {
      if (profile) {
        router.push(routes.myProfile());
      } else {
        // No handle yet — the claim card is front and center on Community.
        router.navigate(routes.community());
      }
    }
  };

  const items: DialItem[] = [
    {
      key: "people",
      label: "Community — find and follow collectors",
      render: (active) => (
        <Users
          size={20}
          color={active ? p.accent.mint : p.ink.dim}
          strokeWidth={active ? 2.5 : 2}
        />
      ),
    },
    {
      // Center FAB slot — self-handled (own press feedback), out of the drag.
      key: "home",
      label: "Back to the main app",
      selectable: false,
      width: 60,
      render: () => <HomeFab palette={p} />,
    },
    {
      key: "profile",
      label: profile
        ? "My profile — edit bio, picture, privacy"
        : "Claim a username to create your profile",
      render: (active) =>
        profile ? (
          <SocialAvatar
            handle={profile.username}
            url={profile.avatar_url}
            size={30}
          />
        ) : (
          <UserRound
            size={20}
            color={active ? p.accent.mint : p.ink.dim}
            strokeWidth={active ? 2.5 : 2}
          />
        ),
    },
  ];

  return <IslandDial items={items} activeKey={activeKey} onCommit={commit} />;
}

/** The raised mint Home button — the community face's counterpart to Scan. */
function HomeFab({ palette: p }: { palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.navigate(routes.home());
      }}
      accessibilityRole="button"
      accessibilityLabel="Back to the main app"
      style={{
        width: 60,
        height: DIAL_HEIGHT,
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
