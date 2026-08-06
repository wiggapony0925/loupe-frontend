/**
 * Community — native.
 *
 * Restructured around what a user actually does here, in order:
 *   1. Claim a handle — nothing else works until this exists.
 *   2. Search — pinned under the title; you came looking for someone.
 *   3. Follow requests — one line each, decide without leaving the list.
 *   4. Featured collectors — faces on a rail; the browse moment.
 *   5. More collectors — the directory.
 *   6. In real life — the card-shop map; community isn't only online.
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronRight, MapPin, Search, X } from "lucide-react-native";
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

  const openProfile = (handle: string) => router.push(routes.collector(handle));

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={me.isRefetching || discover.isRefetching}
              onRefresh={() => {
                void me.refetch();
                void discover.refetch();
                void requests.refetch();
              }}
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
                  placeholder="Search collectors"
                  placeholderTextColor={p.ink.dim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: p.ink.default }]}
                  accessibilityLabel="Search collectors"
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
                    <Section title="Follow requests" count={requests.data.length}>
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

                  {/* Faces first: featured collectors as an App-Store-style
                      rail of cards, the directory as rows beneath. */}
                  <Section title="Featured collectors">
                    {discover.isLoading ? (
                      <View style={styles.loading}>
                        <ActivityIndicator color={p.ink.dim} />
                      </View>
                    ) : (discover.data?.featured.length ?? 0) === 0 ? (
                      <Text style={[styles.empty, { color: p.ink.dim }]}>
                        No suggestions yet — search for someone by handle.
                      </Text>
                    ) : (
                      <FeaturedCollectorRail
                        users={discover.data!.featured}
                        onOpen={openProfile}
                        onToggleFollow={follow.mutate}
                        pending={follow.isPending}
                      />
                    )}
                  </Section>

                  {(discover.data?.more.length ?? 0) > 0 ? (
                    <Section title="More collectors">
                      {discover.data!.more.map((u) => (
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
                  <Section title="In real life">
                    <Pressable
                      onPress={() => router.push("/stores")}
                      accessibilityRole="button"
                      accessibilityLabel="Card shops near you. Opens the map."
                      style={({ pressed }) => [
                        styles.mapRow,
                        {
                          borderColor: p.line.default,
                          backgroundColor: p.bg.elevated,
                          opacity: pressed ? 0.75 : 1,
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
  count,
  children,
}: {
  title: string;
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
  headAvatar: { borderWidth: 2, borderRadius: 999, padding: 2 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.9 },
  sub: { fontSize: 13.5 },
  section: { marginTop: 22, gap: 2 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
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
