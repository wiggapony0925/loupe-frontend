/**
 * StoreDetailSheet — tap a shop on the map, get its page.
 *
 * Resy's venue-detail anatomy, in Loupe's theme and for card shops:
 *
 *   ▔▔▔▔ hero photo (or themed art block) ▔▔▔▔
 *   Big name
 *   ★ 4.3 (12) · Card & game store · 2.2 km
 *   [ Directions ] [ Website ] [ Call ]
 *   ── About / address ──────────────
 *   ── Community reviews ────────────
 *   ★★★★★  write yours…            ← real reviews, real handles
 *
 * Photos come from what the shop itself publishes (backend resolves the
 * OSM image tag or its site's og:image) — a miss falls back to the same
 * themed art block the map card uses, never a broken image.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Globe, Navigation, Phone, Star, Store, Trash2 } from "lucide-react-native";
import {
  useDeleteStoreReview,
  useStoreDetail,
  useUpsertStoreReview,
} from "@/application/queries/stores/useNearbyStores";
import type { NearbyStoreWire, StoreReviewWire } from "@/infrastructure/http";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function directionsUrl(store: NearbyStoreWire): string {
  const q = encodeURIComponent(store.name);
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?q=${q}&ll=${store.lat},${store.lng}`
    : `geo:${store.lat},${store.lng}?q=${store.lat},${store.lng}(${q})`;
}

/** Read-only star row (rating display). */
function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const p = useThemedPalette();
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={i <= Math.round(value) ? p.accent.amber : p.ink.dim}
          fill={i <= Math.round(value) ? p.accent.amber : "transparent"}
          strokeWidth={2}
        />
      ))}
    </View>
  );
}

export function StoreDetailSheet({
  storeId,
  fallback,
  onClose,
}: {
  /** Which shop — null keeps the sheet closed. */
  storeId: string | null;
  /** The map card's copy, so the sheet has content before detail lands. */
  fallback?: NearbyStoreWire | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const detail = useStoreDetail(storeId);
  const upsert = useUpsertStoreReview();
  const remove = useDeleteStoreReview();

  const store = detail.data?.store ?? fallback ?? null;
  const reviews = detail.data?.reviews ?? [];
  const mine = reviews.find((r) => r.is_mine) ?? null;

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Seed the composer from my existing review whenever the sheet opens on
  // a different store (editing should start from what I wrote).
  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, mine?.id]);

  const submit = () => {
    if (!storeId || rating < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    upsert.mutate(
      { storeId, rating, body: body.trim() || null },
      {
        onSuccess: () => setError(null),
        onError: (e) =>
          setError(
            e.message.includes("username")
              ? "Claim a username in Community before reviewing."
              : e.message,
          ),
      },
    );
  };

  const distance = store
    ? store.distance_km < 1
      ? `${Math.round(store.distance_km * 1000)} m`
      : `${store.distance_km.toFixed(1)} km`
    : "";
  const tint = store ? `hsl(${hueFor(store.name)}, 48%, 52%)` : p.accent.mint;

  return (
    <BottomSheet
      visible={storeId != null}
      onClose={onClose}
      title={store?.name ?? "Card shop"}
      subtitle={
        store
          ? [store.category, distance].filter(Boolean).join(" · ")
          : null
      }
      overlay
      minHeight="55%"
      maxHeight="88%"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {/* Hero — the shop's own photo, else its themed art block. */}
        <View style={[styles.hero, { backgroundColor: withAlpha(tint, 0.16) }]}>
          {store?.photo_url ? (
            <Image
              source={{ uri: store.photo_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <>
              <Store size={34} color={tint} strokeWidth={1.8} />
              <Text style={[styles.heroInitial, { color: withAlpha(tint, 0.5) }]}>
                {(store?.name ?? "?").charAt(0).toUpperCase()}
              </Text>
            </>
          )}
        </View>

        {/* Rating line — the community's verdict, Resy's star row. */}
        <View style={styles.ratingLine}>
          {store?.rating != null ? (
            <>
              <Stars value={store.rating} />
              <Text style={[styles.ratingValue, { color: p.ink.default }]}>
                {store.rating.toFixed(1)}
              </Text>
              <Text style={[styles.ratingCount, { color: p.ink.dim }]}>
                ({store.review_count})
              </Text>
            </>
          ) : (
            <Text style={[styles.ratingCount, { color: p.ink.dim }]}>
              No reviews yet — be the first.
            </Text>
          )}
        </View>

        {/* Actions — Resy's slot row. */}
        {store ? (
          <View style={styles.actions}>
            <Action
              primary
              icon={<Navigation size={13} color="#06140d" strokeWidth={2.6} />}
              label="Directions"
              onPress={() => void Linking.openURL(directionsUrl(store))}
            />
            {store.website ? (
              <Action
                icon={<Globe size={13} color={p.ink.default} strokeWidth={2.4} />}
                label="Website"
                onPress={() => void Linking.openURL(store.website as string)}
              />
            ) : null}
            {store.phone ? (
              <Action
                icon={<Phone size={13} color={p.ink.default} strokeWidth={2.4} />}
                label="Call"
                onPress={() =>
                  void Linking.openURL(
                    `tel:${(store.phone as string).replace(/\s/g, "")}`,
                  )
                }
              />
            ) : null}
          </View>
        ) : null}

        {store?.address || store?.opening_hours ? (
          <View style={[styles.infoCard, { backgroundColor: p.bg.elevated }]}>
            {store.address ? (
              <Text style={[styles.infoText, { color: p.ink.default }]}>
                {store.address}
              </Text>
            ) : null}
            {store.opening_hours ? (
              <Text style={[styles.infoHours, { color: p.ink.dim }]}>
                {store.opening_hours}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Community reviews ── */}
        <Text style={[styles.sectionTitle, { color: p.ink.dim }]}>
          COMMUNITY REVIEWS
        </Text>

        {/* Composer — tap a star, add a note. */}
        <View style={[styles.composer, { borderColor: p.line.default }]}>
          <View style={styles.starPick}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setRating(i);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${i} ${i === 1 ? "star" : "stars"}`}
              >
                <Star
                  size={24}
                  color={i <= rating ? p.accent.amber : p.ink.dim}
                  fill={i <= rating ? p.accent.amber : "transparent"}
                  strokeWidth={2}
                />
              </Pressable>
            ))}
            {mine ? (
              <Pressable
                onPress={() => {
                  if (!storeId) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                    () => {},
                  );
                  remove.mutate({ storeId });
                  setRating(0);
                  setBody("");
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete my review"
                style={styles.deleteBtn}
              >
                <Trash2 size={15} color={p.accent.rose} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Singles selection, prices, play space…"
            placeholderTextColor={p.ink.dim}
            multiline
            maxLength={1000}
            style={[styles.composerInput, { color: p.ink.default }]}
            accessibilityLabel="Write your review"
          />
          {error ? (
            <Text style={[styles.error, { color: p.accent.rose }]}>{error}</Text>
          ) : null}
          <Pressable
            onPress={submit}
            disabled={rating < 1 || upsert.isPending}
            accessibilityRole="button"
            accessibilityLabel={mine ? "Update my review" : "Post my review"}
            style={[
              styles.post,
              {
                backgroundColor:
                  rating < 1 ? withAlpha(p.ink.default, 0.08) : p.accent.mint,
              },
            ]}
          >
            {upsert.isPending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <Text
                style={[
                  styles.postText,
                  { color: rating < 1 ? p.ink.dim : "#06140d" },
                ]}
              >
                {mine ? "Update review" : "Post review"}
              </Text>
            )}
          </Pressable>
        </View>

        {detail.isLoading ? (
          <ActivityIndicator color={p.ink.dim} style={{ marginTop: 16 }} />
        ) : reviews.length === 0 ? (
          <Text style={[styles.noReviews, { color: p.ink.dim }]}>
            No reviews yet. Tell other collectors what this shop is like.
          </Text>
        ) : (
          reviews.map((r) => <ReviewRow key={r.id} review={r} />)
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function ReviewRow({ review }: { review: StoreReviewWire }) {
  const p = useThemedPalette();
  const when = new Date(review.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <View style={[styles.review, { borderTopColor: p.line.default }]}>
      <SocialAvatar
        handle={review.username ?? "collector"}
        name={review.display_name}
        url={review.avatar_url}
        size={34}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.reviewHead}>
          <Text numberOfLines={1} style={[styles.reviewWho, { color: p.ink.default }]}>
            {review.display_name?.trim() || `@${review.username ?? "collector"}`}
          </Text>
          {review.is_mine ? (
            <Text style={[styles.youTag, { color: p.accent.mint }]}>You</Text>
          ) : null}
        </View>
        <View style={styles.reviewMeta}>
          <Stars value={review.rating} size={11} />
          <Text style={[styles.reviewDate, { color: p.ink.dim }]}>{when}</Text>
        </View>
        {review.body ? (
          <Text style={[styles.reviewBody, { color: p.ink.muted }]}>
            {review.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.action,
        primary
          ? { backgroundColor: p.accent.mint }
          : { backgroundColor: withAlpha(p.ink.default, 0.07) },
      ]}
    >
      {icon}
      <Text
        style={[styles.actionText, { color: primary ? "#06140d" : p.ink.default }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 24, gap: 12 },
  hero: {
    height: 168,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitial: { position: "absolute", right: 16, bottom: 4, fontSize: 84, fontWeight: "900" },
  ratingLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  starRow: { flexDirection: "row", gap: 1.5 },
  ratingValue: { fontSize: 13.5, fontWeight: "800" },
  ratingCount: { fontSize: 12.5 },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionText: { fontSize: 12.5, fontWeight: "700" },
  infoCard: { borderRadius: 14, padding: 13, gap: 3 },
  infoText: { fontSize: 13.5, fontWeight: "600" },
  infoHours: { fontSize: 12 },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  composer: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  starPick: { flexDirection: "row", alignItems: "center", gap: 8 },
  deleteBtn: { marginLeft: "auto" },
  composerInput: { fontSize: 13.5, minHeight: 44, textAlignVertical: "top" },
  error: { fontSize: 12 },
  post: { borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  postText: { fontSize: 13.5, fontWeight: "800" },
  noReviews: { fontSize: 13, paddingVertical: 14 },
  review: {
    flexDirection: "row",
    gap: 11,
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewWho: { fontSize: 13.5, fontWeight: "700" },
  youTag: { fontSize: 10.5, fontWeight: "800" },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
  reviewDate: { fontSize: 11 },
  reviewBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
