/**
 * CommunityIsland — the island navbar's face while browsing Community.
 *
 * The tab dial morphs into a purpose-built rail (same crossfade as vault
 * multi-select — the shared island motion runs off the face's key):
 *
 *   [Feed] · [People] · [Home, mint center] · [Alerts] · [My profile]
 *
 * Five slots, symmetric around the center FAB, and they are the community
 * micro-app's whole map: the stream, the directory, the way out, the inbox,
 * and you. Anything not reachable from here needs a reason.
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
import { Bell, Camera, Newspaper, UserRound, Users } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { useUnreadNotificationCount } from "@/application/notifications/useNotificationFeed";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { DIAL_HEIGHT, IslandDial, type DialItem } from "@/presentation/navigation/IslandDial";
import {
  useIslandPresence,
  type IslandPresentation,
} from "@/presentation/navigation/islandNavStore";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function CommunityIslandContent() {
  const p = useThemedPalette();
  const me = useSocialMe();
  const profile = me.data?.profile ?? null;
  const pathname = usePathname();
  const unread = useUnreadNotificationCount();

  // Which slot is "here": the people list on /community, my own profile on
  // /u/@me (or my claimed handle). On someone else's profile neither is
  // active and the highlight fades — same rule as the tab dial on Community.
  // decodeURIComponent THROWS on a malformed escape ("%zz", a trailing "%"),
  // and this island renders outside every CrashGuard — a bad path must cost
  // us the highlight, not the app.
  const handle = pathname.startsWith("/u/") ? safeDecode(pathname.slice(3)).toLowerCase() : null;
  const isMyHandle =
    handle != null &&
    (handle === "@me" || handle === "me" || handle === profile?.username?.toLowerCase());
  const activeKey =
    pathname === "/community"
      ? "feed"
      : pathname.startsWith("/community/people")
        ? "people"
        : pathname === "/notifications"
          ? "alerts"
          : isMyHandle
            ? "profile"
            : null;

  // EVERY SEGMENT NAVIGATES, none pushes. These four are peers — that is what
  // a segmented control means — and `push` gives a peer the semantics of a
  // drill-down: it stacks a second copy on top of the one already open, so
  // tapping alerts, then profile, then alerts leaves three screens deep and
  // the system back gesture walks the user through their own tab history
  // instead of out of the island. `navigate` reuses the route that is already
  // there. Two of these used to push and two used to navigate, which is also
  // why they animated differently — see PEER_TRANSITION.
  const commit = (key: string) => {
    if (key === "feed") {
      // Idempotent — a commit from a drilled-in page lands on the stream.
      router.navigate(routes.community());
    } else if (key === "people") {
      router.navigate(routes.communityPeople());
    } else if (key === "alerts") {
      router.navigate(routes.notifications());
    } else if (key === "profile") {
      if (profile) {
        router.navigate(routes.myProfile());
      } else {
        // No handle yet — the claim card is front and center on the feed.
        router.navigate(routes.community());
      }
    }
  };

  const items: DialItem[] = [
    {
      key: "feed",
      label: "Feed — posts from collectors you follow",
      render: (active) => (
        <Newspaper
          size={20}
          color={active ? p.accent.mint : p.ink.dim}
          strokeWidth={active ? 2.5 : 2}
        />
      ),
    },
    {
      key: "people",
      label: "Collectors — find and follow people",
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
      key: "story",
      label: "Add to your story",
      selectable: false,
      width: 60,
      render: () => <StoryFab palette={p} />,
    },
    {
      key: "alerts",
      label: unread > 0 ? `Notifications, ${unread} unread` : "Notifications",
      render: (active) => (
        <View>
          <Bell
            size={20}
            color={active ? p.accent.mint : p.ink.dim}
            strokeWidth={active ? 2.5 : 2}
          />
          {unread > 0 ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: p.accent.rose,
              }}
            />
          ) : null}
        </View>
      ),
    },
    {
      key: "profile",
      label: profile
        ? "My profile — edit bio, picture, privacy"
        : "Claim a username to create your profile",
      render: (active) =>
        profile ? (
          <SocialAvatar handle={profile.username} url={profile.avatar_url} size={30} />
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

/**
 * The raised mint CAMERA button — the community face's counterpart to Scan.
 *
 * This slot used to be Home. Inside a social micro-app the centre button is
 * the one you press to CREATE, not the one you press to leave: Instagram,
 * TikTok and Snapchat all put the camera there, and every other tab already
 * navigates, so spending the most reachable target on "go back to the rest
 * of the app" wasted it. The way out is still the tab bar and the back
 * gesture, which is where people look for it anyway.
 *
 * Long press goes home, so the old habit isn't simply taken away.
 */
function StoryFab({ palette: p }: { palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push(routes.communityStory());
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.navigate(routes.home());
      }}
      accessibilityRole="button"
      accessibilityLabel="Add to your story. Long press to leave Community."
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
          <Camera size={22} color="#06140d" strokeWidth={2.4} />
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
