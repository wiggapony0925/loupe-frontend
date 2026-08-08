/**
 * Community — native.
 *
 * Restructured around what a user actually does here, in order:
 *   1. Claim a handle — nothing else works until this exists.
 *   2. Search — pinned under the title; you came looking for someone.
 *   3. Follow requests — one line each, decide without leaving the list.
 *   4. Featured collectors — a rail of BIG card art, not faces: this is a
 *      trading-card app, and a directory of avatars gave no reason to tap
 *      anyone. One card per tile, large enough to recognise.
 *   5. Collectors to follow — the directory, each row saying how much they own.
 *   6. In real life — the card-shop map; community isn't only online.
 *
 * Every shelf carries a one-line subtitle. A column of bare uppercase labels
 * made the reader infer why each list was there.
 *
 * While focused, the island navbar morphs into the community rail
 * (People · Home · My profile) — see CommunityIsland.
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
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronRight, MapPin, Search, Share2, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { CollectorRow } from "@/presentation/features/social/CollectorRow";
import { ClaimUsernameCard } from "@/presentation/features/social/ClaimUsernameCard";
import { FeaturedCollectorRail } from "@/presentation/features/social/FeaturedCollectorRail";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import {
  useCollectorSearch,
  useDiscoverCollectors,
  useFollowCollector,
  useFollowRequests,
  useRespondToRequest,
  useSocialMe,
} from "@/application/queries/social/useSocial";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { config } from "@/shared/config";
import { usePullToRefresh } from "@/presentation/hooks/usePullToRefresh";
import { routes } from "@/shared/routes";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export default function CommunityScreen() {
  const p = useThemedPalette();
  const [q, setQ] = useState("");

  useCommunityIslandPresence();

  const me = useSocialMe();
  const claimed = !!me.data?.profile;

  const requests = useFollowRequests();
  // Composed + ranked server-side; featured/more arrive disjoint.
  const discover = useDiscoverCollectors(claimed);
  const search = useCollectorSearch(q);
  const follow = useFollowCollector();
  const respond = useRespondToRequest();

  const searching = q.trim().length >= 2;
  const results = search.data ?? [];

  // The rail renders `featured`; these rows are everyone else. The two
  // arrive disjoint from the server, so no de-duplication is needed here.
  const people = discover.data?.more ?? [];

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      me.refetch(),
      discover.refetch(),
      requests.refetch(),
    ]),
  );

  const openProfile = (handle: string) => router.push(routes.collector(handle));

  /** Hand out my profile link — the growth loop this page exists for. */
  const shareMyProfile = async () => {
    const handle = me.data?.profile?.username;
    if (!handle) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await Share.share({ url: `${config.webUrl}/app/u/${handle}` });
    } catch {
      // Dismissed the sheet — nothing to do.
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={p.ink.dim}
            />
          }
        >
          {/* Hero — big title left, MY round face right (the way into my
              profile), the same anatomy as the Settings hero. */}
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={[styles.title, { color: p.ink.default }]}>Community</Text>
              <Text style={[styles.sub, { color: p.ink.muted }]}>
                Follow collectors and see what they own.
              </Text>
            </View>
            {claimed ? (
              <Pressable
                onPress={() => void shareMyProfile()}
                accessibilityRole="button"
                accessibilityLabel="Share my profile"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headShare,
                  {
                    borderColor: p.line.default,
                    backgroundColor: p.bg.elevated,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Share2 size={16} color={p.ink.muted} strokeWidth={2.2} />
              </Pressable>
            ) : null}
            {claimed ? (
              <Pressable
                onPress={() => router.push(routes.myProfile())}
                accessibilityRole="button"
                accessibilityLabel="Open my profile"
                style={({ pressed }) => [
                  styles.headAvatar,
                  {
                    borderColor: p.accent.mint,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
              >
                <SocialAvatar
                  handle={me.data!.profile!.username}
                  url={me.data!.profile!.avatar_url}
                  size={38}
                />
              </Pressable>
            ) : null}
          </View>

          {me.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={p.ink.dim} />
            </View>
          ) : !claimed ? (
            <ClaimUsernameCard />
          ) : (
            <>
              {/* Search sits directly under the title — finding a specific
                  person is the page's first verb, not something buried
                  beneath an inbox. */}
              <View
                style={[
                  styles.search,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                <Search size={16} color={p.ink.dim} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search name, @handle or email"
                  placeholderTextColor={p.ink.dim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: p.ink.default }]}
                  accessibilityLabel="Search collectors by name, handle, email or account id"
                />
                {q.length > 0 ? (
                  <Pressable
                    onPress={() => setQ("")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <X size={15} color={p.ink.dim} />
                  </Pressable>
                ) : null}
              </View>

              {searching ? (
                <Section title="Results">
                  {search.isLoading ? (
                    <View style={styles.loading}>
                      <ActivityIndicator color={p.ink.dim} />
                    </View>
                  ) : results.length === 0 ? (
                    <Text style={[styles.empty, { color: p.ink.dim }]}>
                      No collectors match “{q.trim()}”.
                    </Text>
                  ) : (
                    results.map((u) => (
                      <CollectorRow
                        key={u.user_id}
                        user={u}
                        onPress={() => openProfile(u.username)}
                        onToggleFollow={follow.mutate}
                        pending={follow.isPending}
                      />
                    ))
                  )}
                </Section>
              ) : (
                <>
                  {/* Requests: ONE line per person — the face, and the
                      decision as two compact controls in the row's own
                      trailing slot. A second line of wide Accept/Decline
                      bars made three requests fill the screen. */}
                  {requests.data && requests.data.length > 0 ? (
                    <Section
                      title="Follow requests"
                      subtitle="They want to see your collection."
                      count={requests.data.length}
                    >
                      {requests.data.map((r) => (
                        <CollectorRow
                          key={r.id}
                          user={r.requester}
                          onPress={() => openProfile(r.requester.username)}
                          trailing={
                            <View style={styles.decision}>
                              <Pressable
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  respond.mutate({ id: r.id, accept: true });
                                }}
                                disabled={respond.isPending}
                                accessibilityRole="button"
                                accessibilityLabel={`Accept @${r.requester.username}`}
                                style={[
                                  styles.decide,
                                  { backgroundColor: p.accent.mint },
                                ]}
                              >
                                <Check size={15} color="#06140d" strokeWidth={3} />
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  respond.mutate({ id: r.id, accept: false });
                                }}
                                disabled={respond.isPending}
                                accessibilityRole="button"
                                accessibilityLabel={`Decline @${r.requester.username}`}
                                style={[
                                  styles.decide,
                                  { borderWidth: 1, borderColor: p.line.default },
                                ]}
                              >
                                <X size={14} color={p.ink.muted} strokeWidth={2.6} />
                              </Pressable>
                            </View>
                          }
                        />
                      ))}
                    </Section>
                  ) : null}

                  {/* Featured collectors — operator-curated when an admin
                      has set a list, ranked otherwise. */}
                  {(discover.data?.featured.length ?? 0) > 0 ? (
                    <Section
                      title="Featured collectors"
                      subtitle="Vaults worth following."
                    >
                      <FeaturedCollectorRail
                        users={discover.data!.featured}
                        onOpen={openProfile}
                        onToggleFollow={follow.mutate}
                        pending={follow.isPending}
                      />
                    </Section>
                  ) : null}

                  {/* Everyone else. */}
                  {people.length > 0 ? (
                    <Section
                      title="Collectors to follow"
                      subtitle="People building collections worth watching."
                    >
                      {people.map((u) => (
                        <CollectorRow
                          key={u.user_id}
                          user={u}
                          onPress={() => openProfile(u.username)}
                          onToggleFollow={follow.mutate}
                          pending={follow.isPending}
                        />
                      ))}
                    </Section>
                  ) : null}

                  {/* The community isn't only online — hand off to the map
                      of physical card shops. */}
                  <Section
                    title="In real life"
                    subtitle="Collecting isn't only online."
                  >
                    <Pressable
                      onPress={() => router.push("/stores")}
                      accessibilityRole="button"
                      accessibilityLabel="Card shops near you. Opens the map."
                      style={[
                        styles.mapRow,
                        {
                          borderColor: p.line.default,
                          backgroundColor: p.bg.elevated,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.mapIcon,
                          { backgroundColor: withAlpha(p.accent.mint, 0.14) },
                        ]}
                      >
                        <MapPin size={16} color={p.accent.mint} strokeWidth={2.4} />
                      </View>
                      <View style={styles.mapText}>
                        <Text style={[styles.mapTitle, { color: p.ink.default }]}>
                          Card shops near you
                        </Text>
                        <Text style={[styles.mapSub, { color: p.ink.dim }]}>
                          Local game stores that sell trading cards, on a map.
                        </Text>
                      </View>
                      <ChevronRight size={16} color={p.ink.dim} />
                    </Pressable>
                  </Section>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  /** One line on what this shelf is. A page of bare uppercase labels makes
   *  the reader work out why each list exists; saying so is cheaper. */
  subtitle?: string;
  count?: number;
  children: React.ReactNode;
}) {
  const p = useThemedPalette();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: p.ink.dim }]}>
          {title.toUpperCase()}
        </Text>
        {count ? (
          <View
            style={[styles.badge, { backgroundColor: withAlpha(p.accent.mint, 0.18) }]}
          >
            <Text style={[styles.badgeText, { color: p.accent.mint }]}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[styles.sectionSub, { color: p.ink.dim }]}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  // Bottom padding clears the floating tab pill — content that scrolls
  // under it looks like it was cut off rather than deliberately layered.
  content: { padding: 20, paddingBottom: 130, gap: 4 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  headText: { flex: 1, gap: 3 },
  headShare: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headAvatar: { borderWidth: 2, borderRadius: 999, padding: 2 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.9 },
  sub: { fontSize: 13.5 },
  // A shelf breathes: label, its one-line reason, then the content.
  section: { marginTop: 26, gap: 2 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  sectionSub: { fontSize: 12.5, marginBottom: 10, marginTop: 1 },
  badge: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10.5, fontWeight: "800" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  decision: { flexDirection: "row", gap: 8 },
  decide: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { paddingVertical: 22, alignItems: "center" },
  empty: { fontSize: 13, paddingVertical: 10 },
  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginTop: 4,
  },
  mapIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mapText: { flex: 1, gap: 1 },
  mapTitle: { fontSize: 14.5, fontWeight: "700", letterSpacing: -0.2 },
  mapSub: { fontSize: 12 },
});
