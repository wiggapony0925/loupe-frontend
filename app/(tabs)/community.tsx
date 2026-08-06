/**
 * Community — native.
 *
 * This replaces a WebView that loaded `/app/community?embed=app`. The embed
 * worked, but it sat at the root of the stack ABOVE the tab navigator, so the
 * bottom bar vanished the moment you opened it — which is most of why the
 * page read as a website in a frame rather than part of the app. Living in
 * `(tabs)` fixes that structurally, and going native buys the rest: real
 * momentum scrolling, the app's own rows and type, and no token hand-off.
 *
 * Order of the page is the order of what a user needs:
 *   1. Claim a handle — nothing else works until this exists.
 *   2. Follow requests — someone is waiting on you.
 *   3. Search — you came here looking for a specific person.
 *   4. Suggested — you didn't, and an empty page would end the session.
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
import { Search, X } from "lucide-react-native";
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

  // While this screen is focused the island navbar morphs into the
  // community rail (People · Home · My profile) — see CommunityIsland.
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

          {/* Nothing below works until a handle exists, so it goes first and
              the rest of the page stays hidden behind it. */}
          {me.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={p.ink.dim} />
            </View>
          ) : !claimed ? (
            <ClaimUsernameCard />
          ) : (
            <>
              {requests.data && requests.data.length > 0 ? (
                <Section title="Follow requests" count={requests.data.length}>
                  {requests.data.map((r) => (
                    <View key={r.id} style={styles.requestRow}>
                      <CollectorRow
                        user={r.requester}
                        onPress={() => openProfile(r.requester.username)}
                      />
                      <View style={styles.decision}>
                        <Pressable
                          onPress={() =>
                            respond.mutate({ id: r.id, accept: true })
                          }
                          disabled={respond.isPending}
                          accessibilityRole="button"
                          accessibilityLabel={`Accept @${r.requester.username}`}
                          style={[
                            styles.decisionBtn,
                            { backgroundColor: withAlpha(p.accent.mint, 0.16) },
                          ]}
                        >
                          <Text
                            style={[styles.decisionText, { color: p.accent.mint }]}
                          >
                            Accept
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            respond.mutate({ id: r.id, accept: false })
                          }
                          disabled={respond.isPending}
                          accessibilityRole="button"
                          accessibilityLabel={`Decline @${r.requester.username}`}
                          style={[
                            styles.decisionBtn,
                            { borderWidth: 1, borderColor: p.line.default },
                          ]}
                        >
                          <Text
                            style={[styles.decisionText, { color: p.ink.muted }]}
                          >
                            Decline
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </Section>
              ) : null}

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
                  {/* Faces first: suggested collectors as an App-Store-style
                      rail of cards, spillover as rows beneath. */}
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
        <Text style={[styles.sectionTitle, { color: p.ink.muted }]}>
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
  section: { marginTop: 20, gap: 2 },
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
    marginTop: 20,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  requestRow: { gap: 2 },
  decision: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  decisionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
  },
  decisionText: { fontSize: 13, fontWeight: "700" },
  loading: { paddingVertical: 22, alignItems: "center" },
  empty: { fontSize: 13, paddingVertical: 10 },
});
