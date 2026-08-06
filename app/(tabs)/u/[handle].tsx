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
  Lock,
  MapPin,
  Pencil,
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
  SealedShelf,
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
import { PortfolioSheet } from "@/presentation/features/social/PortfolioSheet";
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
  // Which binder's card list is open (PortfolioSheet), if any.
  const [openPortfolioId, setOpenPortfolioId] = React.useState<string | null>(null);
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
            {/* Prefer the RESOLVED username — the raw param may be the "@me"
                self-alias, which would render as "@@me". */}
            {data?.username
              ? `@${data.username}`
              : handle
                ? `@${handle.replace(/^@/, "")}`
                : "Profile"}
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
            {/* Centered hero. Left-aligned avatar-beside-name is the shape of
                a LIST ROW — it read as one more entry in a directory rather
                than as the subject of the page. Centering, and letting the
                identity own the full width, is what makes it a profile. */}
            <View style={styles.header}>
              <SocialAvatar
                handle={data.username}
                name={data.display_name}
                url={data.avatar_url}
                size={92}
                isPro={data.is_pro}
              />
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
              {data.bio?.trim() ? (
                <Text style={[styles.bio, { color: p.ink.muted }]}>
                  {data.bio.trim()}
                </Text>
              ) : null}
            </View>

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

            {/* One action row, both cases. The old layout gave a stranger a
                full-width mint Follow bar but gave YOU a two-line "Find other
                collectors" advert card sitting where the action belongs —
                the loudest object on your own profile, pushing your
                collection below the fold. Two equal buttons instead: the
                thing you came to do, and the thing that grows the numbers. */}
            <View style={styles.actions}>
              {isSelf ? (
                <>
                  <ActionButton
                    label="Edit profile"
                    Icon={Pencil}
                    onPress={() => router.push(routes.communitySettings())}
                  />
                  <ActionButton
                    label="Find collectors"
                    Icon={Users}
                    primary
                    onPress={() => router.push(routes.community())}
                  />
                </>
              ) : (
                <ActionButton
                  label={followLabel(data.relationship)}
                  primary={data.relationship === "none"}
                  busy={follow.isPending}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    follow.mutate({
                      handle: data.username,
                      following:
                        data.relationship === "following" ||
                        data.relationship === "requested",
                    });
                  }}
                />
              )}
            </View>

            <View style={styles.collection}>
              <View
                style={[styles.collectionHead, { borderBottomColor: p.line.default }]}
              >
                {/* ONE collection headline — the shelves below carry their
                    own labels (PORTFOLIOS / SEALED / TOP SETS), so "your"
                    never repeats down the page. */}
                <Text style={[styles.collectionTitle, { color: p.ink.default }]}>
                  Collection
                </Text>
                {/* Cards + sealed combined — the vault's combined headline
                    basis. Falls back to cards-only from older payloads. */}
                {(collection.data?.total_value_usd ??
                  collection.data?.estimated_value_usd) != null ? (
                  <Text style={[styles.collectionValue, { color: p.accent.mint }]}>
                    $
                    {Number(
                      collection.data?.total_value_usd ??
                        collection.data?.estimated_value_usd,
                    ).toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
                      by "my collections" — then sealed, then set context. */}
                  <PortfolioShelf
                    portfolios={collection.data?.portfolios ?? []}
                    onTilePress={(id) => setOpenPortfolioId(id)}
                  />
                  <SealedShelf
                    sealed={collection.data?.sealed ?? []}
                    totalCount={collection.data?.sealed_count}
                    totalValue={collection.data?.sealed_value_usd}
                  />
                  <CollectionSetsRail
                    sets={collection.data?.sets ?? []}
                    totalSets={collection.data?.total_sets}
                  />
                  {/* Labelled: after three captioned shelves an unlabelled
                      grid of ~100 cards read as the page having lost its
                      structure and started dumping. */}
                  {(collection.data?.items?.length ?? 0) > 0 ? (
                    <View style={styles.shelf}>
                      <Text style={[styles.sectionTitle, { color: p.ink.dim }]}>
                        {`ALL CARDS · ${collection.data?.total_cards ?? collection.data?.items?.length ?? 0}`}
                      </Text>
                      <CollectionGrid items={collection.data?.items ?? []} />
                    </View>
                  ) : null}
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

      {/* Binder drill-in — tap a portfolio tile, see its cards as the
          vault's own list rows. */}
      <PortfolioSheet
        handle={handle}
        collectionId={openPortfolioId}
        onClose={() => setOpenPortfolioId(null)}
      />
    </View>
  );
}

/**
 * ActionButton — the profile's one button shape.
 *
 * `primary` is the mint fill (the thing to do next); everything else is a
 * quiet outline. Both variants keep identical metrics so a row of two doesn't
 * look assembled from different kits.
 */
function ActionButton({
  label,
  Icon,
  onPress,
  primary = false,
  busy = false,
}: {
  label: string;
  Icon?: typeof Users;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
}) {
  const p = useThemedPalette();
  const fg = primary ? "#06140d" : p.ink.default;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        primary
          ? { backgroundColor: p.accent.mint }
          : {
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: withAlpha(p.ink.default, 0.04),
            },
        { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={15} color={fg} strokeWidth={2.3} /> : null}
          <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
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
  header: { alignItems: "center", gap: 8, paddingTop: 4 },
  name: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
    marginTop: 4,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { fontSize: 12.5 },
  // Constrained + centered: a bio running the full 335pt width reads as body
  // copy in an article, not as a line about a person.
  bio: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 2,
  },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 13,
  },
  actionText: { fontSize: 14.5, fontWeight: "700" },
  // Shelves need room between them or PORTFOLIOS / SEALED / TOP SETS run
  // together into one undifferentiated stack of tiny grey captions.
  collection: { gap: 22, marginTop: 8 },
  /**
   * The section anchor.
   *
   * COLLECTION and the shelf labels below it used to share one treatment
   * (11px / 700 / +1 tracking), so a section header and its own children read
   * as siblings and the page had no hierarchy at all. This is now a real
   * heading — larger, full-strength ink, on a hairline rule — and the shelf
   * labels stay small and dim underneath it.
   */
  collectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collectionTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  collectionValue: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  shelf: { gap: 10 },
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
