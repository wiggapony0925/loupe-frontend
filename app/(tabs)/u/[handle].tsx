/**
 * A collector's profile — native.
 *
 * Anatomy is deliberately the one every social app taught people:
 *
 *   avatar ◀ | cards · followers · following   ← identity + numbers, one band
 *   Name, @handle · location, bio              ← who they are
 *   [ Follow ── mint ] [ ♥ ]                   ← the two verbs
 *   COLLECTION VALUE  $68,066                  ← the Robinhood moment
 *   [ 124 cards | 6 binders | 12 sets | 3 ]    ← what the figure is made of
 *   ALL CARDS · 124                            ← ONE section for the cards:
 *     search · sort/set chips                    controls,
 *     portfolios ▸ top sets                      then the shelves that
 *     ▦ the grid                                 describe them, then the cards
 *   SEALED                                     ← not cards, so not inside
 *
 * The shelves are NESTED rather than stacked above the grid: as siblings they
 * pushed the actual collection off the first two screens, and they describe
 * the same thing the section is about. They hide while a search or set filter
 * is active — see CollectionGrid's `interlude`.
 *
 * `@me` resolves to your own profile server-side, so the navbar avatar and a
 * tap on another collector land on the same screen — one layout to keep
 * right, and your own profile always looks the way others see it.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Heart,
  Lock,
  MapPin,
  Settings2,
  Share as ShareIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { ProfileStats } from "@/presentation/features/social/ProfileStats";
import { CollectionGrid } from "@/presentation/features/social/CollectionGrid";
import { ProfilePosts } from "@/presentation/features/social/feed/ProfilePosts";
import { useScreenTransition } from "@/presentation/navigation/screenMotion";
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
  formatStat,
  pluralize,
} from "@/presentation/features/social/socialLabels";
import { usePullToRefresh } from "@/presentation/hooks/usePullToRefresh";
import { config } from "@/shared/config";
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
  // Collection ⇄ Posts. Two different questions about the same person —
  // "what do they own" and "what have they said" — so they get a switch
  // rather than one endless page. Defaults to the collection: on a card
  // app that is what someone came to see.
  const [tab, setTab] = useState<"collection" | "posts">("collection");
  const swap = useScreenTransition(tab);

  // Viewing a profile IS the community state — keep the community island
  // (People · Home · My profile) on screen here, same as the Community tab.
  useCommunityIslandPresence();

  const [openPortfolioId, setOpenPortfolioId] = React.useState<string | null>(null);
  const [listKind, setListKind] = React.useState<"followers" | "following" | null>(
    null,
  );
  const followers = useFollowers(handle, listKind === "followers");
  const following = useFollowing(handle, listKind === "following");
  const removeFollower = useRemoveFollower(isSelf ? handle : null);
  const activeList = listKind === "followers" ? followers : following;

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([profile.refetch(), collection.refetch()]),
  );

  const gate = data
    ? collectionGateReason({
        isPrivate: data.is_private,
        relationship: data.relationship,
        cardCount: data.card_count,
      })
    : null;

  const shareProfile = async () => {
    if (!data) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      // The web profile is the public face of the same account.
      await Share.share({ url: `${config.webUrl}/app/u/${data.username}` });
    } catch {
      // User dismissed the sheet — nothing to do.
    }
  };

  const toggleLike = () => {
    if (!data || isSelf) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    like.mutate({ handle: data.username, liked: data.viewer_has_liked });
  };

  const cardsValue = collection.data?.estimated_value_usd;
  const sealedValue = collection.data?.sealed_value_usd;
  const totalValue = collection.data?.total_value_usd ?? cardsValue;
  // Only break the total down when sealed actually contributes — otherwise
  // the line would just repeat the headline with extra words.
  const hasSealedValue =
    sealedValue != null && (collection.data?.sealed_count ?? 0) > 0;
  const breakdown =
    hasSealedValue && cardsValue != null && data
      ? [
          `${formatStat(data.card_count)} ${pluralize(data.card_count, "card")} · ${money(cardsValue)}`,
          `${collection.data?.sealed_count} sealed · ${money(sealedValue)}`,
        ]
      : [];

  // What the headline is MADE OF, as four scannable numbers. Each is
  // dropped when it would read as a zero — an empty "0 sealed" column is
  // an absence dressed up as a fact.
  const facts: { label: string; value: string }[] = [];
  if (data?.card_count) {
    facts.push({ label: "Cards", value: formatStat(data.card_count) });
  }
  const portfolioCount = collection.data?.portfolios?.length ?? 0;
  if (portfolioCount > 0) {
    facts.push({
      label: pluralize(portfolioCount, "Binder"),
      value: formatStat(portfolioCount),
    });
  }
  const setCount = collection.data?.total_sets ?? collection.data?.sets?.length ?? 0;
  if (setCount > 0) {
    facts.push({ label: pluralize(setCount, "Set"), value: formatStat(setCount) });
  }
  const sealedCount = collection.data?.sealed_count ?? 0;
  if (sealedCount > 0) {
    facts.push({ label: "Sealed", value: formatStat(sealedCount) });
  }

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.barBtn}
          >
            <ChevronLeft size={19} color={p.ink.default} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.barTitle, { color: p.ink.default }]}>
            {/* The RESOLVED username — the raw "@me" alias must never render. */}
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
              style={styles.barBtn}
            >
              <Settings2 size={17} color={p.ink.muted} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void shareProfile()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share this profile"
              style={styles.barBtn}
            >
              <ShareIcon size={16} color={p.ink.muted} />
            </Pressable>
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
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={p.ink.dim}
              />
            }
          >
            {/* Identity band — avatar left, the three numbers filling the
                rest. The one arrangement that instantly reads "profile". */}
            <View style={styles.identity}>
              <SocialAvatar
                handle={data.username}
                name={data.display_name}
                url={data.avatar_url}
                size={80}
                isPro={data.is_pro}
              />
              <ProfileStats
                cardCount={data.card_count}
                followerCount={data.follower_count}
                followingCount={data.following_count}
                // Lists are privacy-gated server-side — only offer the tap
                // when the viewer could actually see them.
                onPressFollowers={
                  data.can_view_collection
                    ? () => setListKind("followers")
                    : undefined
                }
                onPressFollowing={
                  data.can_view_collection
                    ? () => setListKind("following")
                    : undefined
                }
              />
            </View>

            <View style={styles.who}>
              <Text style={[styles.name, { color: p.ink.default }]}>
                {data.display_name?.trim() || `@${data.username}`}
              </Text>
              <View style={styles.metaLine}>
                {data.display_name?.trim() ? (
                  <Text style={[styles.meta, { color: p.ink.dim }]}>
                    @{data.username}
                  </Text>
                ) : null}
                {data.location ? (
                  <View style={styles.metaItem}>
                    <MapPin size={11} color={p.ink.dim} strokeWidth={2.4} />
                    <Text style={[styles.meta, { color: p.ink.dim }]}>
                      {data.location}
                    </Text>
                  </View>
                ) : null}
                {data.is_private ? (
                  <View style={styles.metaItem}>
                    <Lock size={11} color={p.ink.dim} strokeWidth={2.4} />
                    <Text style={[styles.meta, { color: p.ink.dim }]}>Private</Text>
                  </View>
                ) : null}
              </View>
              {data.bio?.trim() ? (
                <Text style={[styles.bio, { color: p.ink.muted }]}>
                  {data.bio.trim()}
                </Text>
              ) : null}
            </View>

            {/* The verbs. A stranger gets Follow + the heart; you get Edit +
                Share (growth belongs on Community, not as an ad on your own
                page). The heart carries its count — a like is an action with
                a scoreboard, not a statistic with a button attached. */}
            <View style={styles.actions}>
              {isSelf ? (
                <>
                  <ActionButton
                    label="Edit profile"
                    onPress={() => router.push(routes.communitySettings())}
                  />
                  <ActionButton
                    label="Share profile"
                    onPress={() => void shareProfile()}
                  />
                </>
              ) : (
                <>
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
                  <Pressable
                    onPress={toggleLike}
                    accessibilityRole="button"
                    accessibilityLabel={
                      data.viewer_has_liked
                        ? "Remove your like"
                        : "Like this collection"
                    }
                    style={[
                      styles.heart,
                      data.viewer_has_liked
                        ? { backgroundColor: withAlpha(p.accent.rose, 0.14) }
                        : { backgroundColor: withAlpha(p.ink.default, 0.07) },
                    ]}
                  >
                    <Heart
                      size={15}
                      color={data.viewer_has_liked ? p.accent.rose : p.ink.muted}
                      fill={data.viewer_has_liked ? p.accent.rose : "transparent"}
                      strokeWidth={2.2}
                    />
                    {data.like_count > 0 ? (
                      <Text
                        style={[
                          styles.heartCount,
                          {
                            color: data.viewer_has_liked
                              ? p.accent.rose
                              : p.ink.muted,
                          },
                        ]}
                      >
                        {formatStat(data.like_count)}
                      </Text>
                    ) : null}
                  </Pressable>
                </>
              )}
            </View>

            {/* Owner-only reach line. Views never show publicly — a visit
                counter on display tells every visitor they were counted. */}
            {isSelf ? (
              <Text style={[styles.reach, { color: p.ink.dim }]}>
                {formatStat(data.like_count)} {pluralize(data.like_count, "like")} ·{" "}
                {formatStat(data.view_count)} profile{" "}
                {pluralize(data.view_count, "view")}
              </Text>
            ) : null}

            {/* Collection ⇄ Posts */}
            {data?.can_view_collection ? (
              <View style={[styles.tabs, { borderBottomColor: p.line.default }]}>
                {(
                  [
                    ["collection", "Collection"],
                    ["posts", "Posts"],
                  ] as const
                ).map(([key, label]) => {
                  const active = tab === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        if (active) return;
                        Haptics.selectionAsync().catch(() => {});
                        setTab(key);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={styles.tab}
                    >
                      <Text
                        style={[
                          styles.tabLabel,
                          {
                            color: active ? p.ink.default : p.ink.dim,
                            fontWeight: active ? "800" : "600",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                      <View
                        style={[
                          styles.tabRule,
                          {
                            backgroundColor: active
                              ? p.accent.mint
                              : "transparent",
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Animated.View style={swap}>
            {tab === "posts" ? (
              <ProfilePosts
                handle={handle as string}
                isSelf={isSelf}
                onCompose={() => router.push(routes.communityCompose())}
              />
            ) : gate ? (
              <View style={styles.gate}>
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
              <View style={styles.collection}>
                {/* The Robinhood moment: the portfolio's worth as the big
                    figure, then a scannable strip of what makes it up.
                    The strip replaces a prose breakdown line — four labelled
                    numbers answer "what do they actually own" at a glance,
                    where a sentence had to be read. */}
                {totalValue != null ? (
                  <View style={styles.valueBlock}>
                    <Text style={[styles.valueLabel, { color: p.ink.dim }]}>
                      Collection value
                    </Text>
                    <Text style={[styles.valueFigure, { color: p.ink.default }]}>
                      {money(totalValue)}
                    </Text>
                    {breakdown.length > 0 ? (
                      <Text style={[styles.valueBreakdown, { color: p.ink.dim }]}>
                        {breakdown.join("  +  ")}
                      </Text>
                    ) : null}
                    {facts.length > 0 ? (
                      <View
                        style={[
                          styles.factStrip,
                          {
                            borderColor: p.line.default,
                            backgroundColor: p.bg.elevated,
                          },
                        ]}
                      >
                        {facts.map((f, i) => (
                          <React.Fragment key={f.label}>
                            {i > 0 ? (
                              <View
                                style={[
                                  styles.factRule,
                                  { backgroundColor: p.line.default },
                                ]}
                              />
                            ) : null}
                            <View style={styles.fact}>
                              <Text
                                style={[
                                  styles.factValue,
                                  { color: p.ink.default },
                                ]}
                              >
                                {f.value}
                              </Text>
                              <Text
                                style={[styles.factLabel, { color: p.ink.dim }]}
                              >
                                {f.label}
                              </Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* ONE section for "their collection": the cards, with the
                    shelves that describe them (portfolios, top sets) nested
                    between the filters and the grid. They used to be three
                    sibling sections stacked above the cards, which pushed the
                    actual collection off the first two screens. Sealed stays
                    outside — it isn't cards. */}
                {(collection.data?.items?.length ?? 0) > 0 ? (
                  <View style={styles.shelf}>
                    <Text style={[styles.sectionTitle, { color: p.ink.dim }]}>
                      {`ALL CARDS · ${collection.data?.total_cards ?? collection.data?.items?.length ?? 0}`}
                    </Text>
                    <CollectionGrid
                      items={collection.data?.items ?? []}
                      ownerLabel={
                        isSelf ? "your collection" : `@${data.username}'s cards`
                      }
                      interlude={
                        <>
                          <PortfolioShelf
                            portfolios={collection.data?.portfolios ?? []}
                            onTilePress={(id) => setOpenPortfolioId(id)}
                          />
                          <CollectionSetsRail
                            sets={collection.data?.sets ?? []}
                            totalSets={collection.data?.total_sets}
                          />
                        </>
                      }
                    />
                  </View>
                ) : (
                  // No cards to hang them off — show the shelves standalone
                  // so a sealed-only or binder-only collector isn't blank.
                  <>
                    <PortfolioShelf
                      portfolios={collection.data?.portfolios ?? []}
                      onTilePress={(id) => setOpenPortfolioId(id)}
                    />
                    <CollectionSetsRail
                      sets={collection.data?.sets ?? []}
                      totalSets={collection.data?.total_sets}
                    />
                  </>
                )}
                <SealedShelf
                  sealed={collection.data?.sealed ?? []}
                  totalCount={collection.data?.sealed_count}
                  totalValue={collection.data?.sealed_value_usd}
                />
              </View>
            )}
            </Animated.View>
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

function money(v: string | number): string {
  return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
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
  Icon?: typeof Settings2;
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
      style={[
        styles.action,
        primary
          ? { backgroundColor: p.accent.mint }
          : { backgroundColor: withAlpha(p.ink.default, 0.07) },
        busy ? { opacity: 0.6 } : null,
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
    alignItems: "center",
    justifyContent: "center",
  },
  barTitle: { flex: 1, fontSize: 15, fontWeight: "700", textAlign: "center" },
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  center: { paddingVertical: 40, alignItems: "center", gap: 6 },
  errorTitle: { fontSize: 17, fontWeight: "700" },
  errorBody: { fontSize: 13.5, textAlign: "center", maxWidth: 300 },
  identity: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 2 },
  who: { gap: 3 },
  name: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { fontSize: 12.5 },
  bio: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionText: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.1 },
  // The heart is square-ish so the Follow button stays the widest object.
  heart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  heartCount: { fontSize: 13, fontWeight: "700" },
  reach: { fontSize: 11.5, textAlign: "center" },
  collection: { gap: 18, marginTop: 8 },
  valueBlock: { gap: 2, paddingTop: 4 },
  valueLabel: { fontSize: 12, fontWeight: "500" },
  valueFigure: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  valueBreakdown: { fontSize: 12.5, marginTop: 2 },
  // The headline's composition, as one hairline panel. Columns share the row
  // equally (flex:1) so the strip stays balanced at two facts or at four.
  factStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  fact: { flex: 1, alignItems: "center", gap: 3 },
  factValue: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  factLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  factRule: { width: StyleSheet.hairlineWidth, marginVertical: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  shelf: { gap: 10 },
  // A sentence, not a panel — "this vault is private" isn't an error.
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 4,
  },
  tab: { flex: 1, alignItems: "center", gap: 8, paddingTop: 4 },
  tabLabel: { fontSize: 15, letterSpacing: -0.2 },
  tabRule: {
    height: 2.5,
    alignSelf: "stretch",
    marginHorizontal: 22,
    borderRadius: 2,
  },
  gate: { paddingVertical: 20, gap: 4, alignItems: "center" },
  gateTitle: { fontSize: 15, fontWeight: "700" },
  gateBody: { fontSize: 13, textAlign: "center" },
});
