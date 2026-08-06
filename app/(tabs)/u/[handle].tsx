/**
 * A collector's profile — native.
 *
 * Replaces the web `/app/u/:handle` page the Community WebView used to show.
 * The gain isn't only chrome: their cards now render as the app's own card
 * rows, so tapping one goes straight to the native card screen with live
 * pricing and your own ownership context, instead of bouncing through a
 * bridge that had to intercept web links and translate them.
 *
 * `@me` resolves to your own profile, so the avatar in the navbar and a tap
 * on another collector both land on exactly the same screen — one layout to
 * keep right, and your own profile always looks the way others see it.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  Settings2,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { ProfileStats } from "@/presentation/features/social/ProfileStats";
import { CollectionGrid } from "@/presentation/features/social/CollectionGrid";
import {
  CollectionSetsRail,
  PortfolioShelf,
} from "@/presentation/features/social/CollectionSetsRail";
import {
  useCollectorCollection,
  useCollectorProfile,
  useFollowCollector,
  useFollowers,
  useFollowing,
  useLikeCollector,
  useRemoveFollower,
  useSocialMe,
} from "@/application/queries/social/useSocial";
import { CollectorListSheet } from "@/presentation/features/social/CollectorListSheet";
import {
  collectionGateReason,
  followLabel,
} from "@/presentation/features/social/socialLabels";
import { routes } from "@/shared/routes";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export default function CollectorProfileScreen() {
  const p = useThemedPalette();
  const params = useLocalSearchParams<{ handle?: string }>();
  const raw = typeof params.handle === "string" ? params.handle : "";

  // `@me` resolves SERVER-side (house rule: backend owns the logic) — the
  // route passes straight through and every endpoint understands the alias.
  const me = useSocialMe();
  const handle = raw === "me" ? "@me" : raw || null;

  const profile = useCollectorProfile(handle);
  const follow = useFollowCollector();
  const like = useLikeCollector();

  const data = profile.data;
  const isSelf = data?.relationship === "self";
  const collection = useCollectorCollection(handle, !!data?.can_view_collection);

  // Viewing a profile IS the community state — keep the community island
  // (People · Home · My profile) on screen here, same as the Community tab.
  useCommunityIslandPresence();

  // Followers / Following popup (the reusable collector-list sheet).
  const [listKind, setListKind] = React.useState<"followers" | "following" | null>(
    null,
  );
  const followers = useFollowers(handle, listKind === "followers");
  const following = useFollowing(handle, listKind === "following");
  const removeFollower = useRemoveFollower(isSelf ? handle : null);
  const activeList = listKind === "followers" ? followers : following;

  const gate = data
    ? collectionGateReason({
        isPrivate: data.is_private,
        relationship: data.relationship,
        cardCount: data.card_count,
      })
    : null;

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.barBtn, { borderColor: p.line.default }]}
          >
            <ChevronLeft size={19} color={p.ink.default} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.barTitle, { color: p.ink.default }]}>
            {handle ? `@${handle}` : "Profile"}
          </Text>
          {isSelf ? (
            <Pressable
              onPress={() => router.push(routes.communitySettings())}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Community settings"
              style={[styles.barBtn, { borderColor: p.line.default }]}
            >
              <Settings2 size={16} color={p.ink.muted} />
            </Pressable>
          ) : (
            <View style={styles.barBtnGhost} />
          )}
        </View>

        {profile.isLoading || (raw === "@me" && me.isLoading) ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.ink.dim} />
          </View>
        ) : !data ? (
          <View style={styles.center}>
            <Text style={[styles.errorTitle, { color: p.ink.default }]}>
              Profile not found
            </Text>
            <Text style={[styles.errorBody, { color: p.ink.muted }]}>
              This collector may have changed their handle or left Loupe.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={profile.isRefetching}
                onRefresh={() => {
                  void profile.refetch();
                  void collection.refetch();
                }}
                tintColor={p.ink.dim}
              />
            }
          >
            <View style={styles.header}>
              <SocialAvatar
                handle={data.username}
                url={data.avatar_url}
                size={76}
                isPro={data.is_pro}
              />
              <View style={styles.ident}>
                <Text style={[styles.name, { color: p.ink.default }]}>
                  {data.display_name?.trim() || `@${data.username}`}
                </Text>
                <View style={styles.metaLine}>
                  {data.display_name?.trim() ? (
                    <Text style={[styles.meta, { color: p.ink.dim }]}>
                      @{data.username}
                    </Text>
                  ) : null}
                  {data.is_private ? (
                    <View style={styles.metaItem}>
                      <Lock size={11} color={p.ink.dim} strokeWidth={2.4} />
                      <Text style={[styles.meta, { color: p.ink.dim }]}>Private</Text>
                    </View>
                  ) : null}
                  {data.location ? (
                    <View style={styles.metaItem}>
                      <MapPin size={11} color={p.ink.dim} strokeWidth={2.4} />
                      <Text style={[styles.meta, { color: p.ink.dim }]}>
                        {data.location}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {data.bio?.trim() ? (
              <Text style={[styles.bio, { color: p.ink.muted }]}>{data.bio.trim()}</Text>
            ) : null}

            <ProfileStats
              cardCount={data.card_count}
              followerCount={data.follower_count}
              followingCount={data.following_count}
              likeCount={data.like_count}
              viewCount={data.view_count}
              viewerHasLiked={data.viewer_has_liked}
              isSelf={!!isSelf}
              // Lists are server-gated by privacy — only offer the tap when
              // the viewer could actually see them (own/public/followed).
              onPressFollowers={
                data.can_view_collection ? () => setListKind("followers") : undefined
              }
              onPressFollowing={
                data.can_view_collection ? () => setListKind("following") : undefined
              }
              onToggleLike={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                like.mutate({
                  handle: data.username,
                  liked: data.viewer_has_liked,
                });
              }}
            />

            {!isSelf ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  follow.mutate({
                    handle: data.username,
                    following:
                      data.relationship === "following" ||
                      data.relationship === "requested",
                  });
                }}
                disabled={follow.isPending}
                accessibilityRole="button"
                accessibilityLabel={`${followLabel(data.relationship)} @${data.username}`}
                style={[
                  styles.followBtn,
                  data.relationship === "none"
                    ? { backgroundColor: p.accent.mint }
                    : {
                        borderWidth: 1,
                        borderColor: p.line.default,
                        backgroundColor: withAlpha(p.ink.default, 0.04),
                      },
                  follow.isPending ? { opacity: 0.6 } : null,
                ]}
              >
                <Text
                  style={[
                    styles.followText,
                    {
                      color:
                        data.relationship === "none" ? "#0B0B0D" : p.ink.default,
                    },
                  ]}
                >
                  {followLabel(data.relationship)}
                </Text>
              </Pressable>
            ) : null}

            {/* Your own profile is a dead end without this: you arrive from
                the navbar, read your stats, and there is nothing to do. The
                one action that grows every number above is finding people. */}
            {isSelf ? (
              <Pressable
                onPress={() => router.push(routes.community())}
                accessibilityRole="button"
                accessibilityLabel="Find other collectors"
                style={[
                  styles.discover,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                <View
                  style={[
                    styles.discoverIcon,
                    { backgroundColor: withAlpha(p.accent.mint, 0.14) },
                  ]}
                >
                  <Users size={15} color={p.accent.mint} strokeWidth={2.4} />
                </View>
                <View style={styles.discoverText}>
                  <Text style={[styles.discoverTitle, { color: p.ink.default }]}>
                    Find other collectors
                  </Text>
                  <Text style={[styles.discoverSub, { color: p.ink.dim }]}>
                    Search by handle, or see who we suggest.
                  </Text>
                </View>
                <ChevronRight size={16} color={p.ink.dim} />
              </Pressable>
            ) : null}

            <View style={styles.collection}>
              <View style={styles.collectionHead}>
                <Text style={[styles.sectionTitle, { color: p.ink.muted }]}>
                  {isSelf ? "YOUR COLLECTION" : "COLLECTION"}
                </Text>
                {/* The number that makes a collection a portfolio — same
                    grade-aware basis as the vault headline. */}
                {collection.data?.estimated_value_usd != null ? (
                  <Text style={[styles.collectionValue, { color: p.accent.mint }]}>
                    $
                    {Number(collection.data.estimated_value_usd).toLocaleString(
                      "en-US",
                      { maximumFractionDigits: 0 },
                    )}
                  </Text>
                ) : null}
              </View>
              {gate ? (
                <View
                  style={[
                    styles.gate,
                    { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                  ]}
                >
                  <Text style={[styles.gateTitle, { color: p.ink.default }]}>
                    {gate.title}
                  </Text>
                  <Text style={[styles.gateBody, { color: p.ink.muted }]}>
                    {gate.body}
                  </Text>
                </View>
              ) : collection.isLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={p.ink.dim} />
                </View>
              ) : (
                <>
                  {/* Curated collections first — the thing collectors mean
                      by "my collections" — then the derived set context. */}
                  <PortfolioShelf
                    portfolios={collection.data?.portfolios ?? []}
                    isSelf={!!isSelf}
                  />
                  <CollectionSetsRail
                    sets={collection.data?.sets ?? []}
                    totalSets={collection.data?.total_sets}
                  />
                  <CollectionGrid items={collection.data?.items ?? []} />
                </>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Followers / Following — Instagram-style list popup. Remove is only
          offered on MY OWN followers list. */}
      <CollectorListSheet
        visible={listKind !== null}
        onClose={() => setListKind(null)}
        title={listKind === "following" ? "Following" : "Followers"}
        rows={activeList.data}
        loading={activeList.isLoading}
        emptyText={
          listKind === "following"
            ? "Not following anyone yet."
            : "No followers yet."
        }
        onRemove={
          isSelf && listKind === "followers"
            ? (h) => removeFollower.mutate({ handle: h })
            : undefined
        }
        removePendingHandle={
          removeFollower.isPending ? removeFollower.variables?.handle : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  barBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  barBtnGhost: { width: 34, height: 34 },
  barTitle: { flex: 1, fontSize: 15, fontWeight: "700", textAlign: "center" },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  center: { paddingVertical: 40, alignItems: "center", gap: 6 },
  errorTitle: { fontSize: 17, fontWeight: "700" },
  errorBody: { fontSize: 13.5, textAlign: "center", maxWidth: 300 },
  header: { flexDirection: "row", alignItems: "center", gap: 15 },
  ident: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  metaLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { fontSize: 12.5 },
  bio: { fontSize: 14, lineHeight: 20 },
  followBtn: { paddingVertical: 13, borderRadius: 14, alignItems: "center" },
  followText: { fontSize: 15, fontWeight: "700" },
  discover: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
  },
  discoverIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  discoverText: { flex: 1, gap: 1 },
  discoverTitle: { fontSize: 14.5, fontWeight: "700" },
  discoverSub: { fontSize: 12 },
  collection: { gap: 10, marginTop: 4 },
  collectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  collectionValue: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  gate: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 4,
    alignItems: "center",
  },
  gateTitle: { fontSize: 15, fontWeight: "700" },
  gateBody: { fontSize: 13, textAlign: "center" },
});
