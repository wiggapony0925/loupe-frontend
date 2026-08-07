/**
 * StoreDetailSheet — the shop's page, built to the Resy venue-detail
 * screenshots the user supplied, in Loupe's palette.
 *
 * Screen 1 (top of sheet):
 *   ┌ hero photo, rounded, thin accent hairline ─────────┐
 *   │ (✕)                              (♡) (↗)          │
 *   │                                   [ View All (n) ] │
 *   └────────────────────────────────────────────────────┘
 *   Big two-line name
 *   ★ 4.3 (32) · Card & game store · $$
 *   ◉ Neighborhood · 2.2 mi
 *   ──────────────────────────────────────────
 *   [ ⌂ Directions ]  ← the "Notify DINNER" slot
 *   ⓘ status banner
 *
 * Screen 2 (scrolled):
 *   About <name> · description · More
 *   ┌ map thumbnail ┐
 *   │  ◉ pin        │
 *   ├───────────────┤
 *   │ full address  │
 *   └───────────────┘
 *   ┌ info card: name, ★ line, ◉ line, then link rows ┐
 *   Reviews (ours — Resy has no equivalent, so it uses the same card idiom)
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
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
import {
  ArrowUpRight,
  Globe,
  Heart,
  Info,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  Store,
  Trash2,
  X,
} from "lucide-react-native";
import { Share } from "react-native";
import {
  useDeleteStoreReview,
  useStoreDetail,
  useToggleSaveStore,
  useUpsertStoreReview,
} from "@/application/queries/stores/useNearbyStores";
import type { NearbyStoreWire, StoreReviewWire } from "@/infrastructure/http";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useTheme } from "@/presentation/theme";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

// Lazy map module — the sheet ships by OTA; binaries without it show the
// address card alone rather than crashing.
type MapsModule = typeof import("react-native-maps");
let Maps: MapsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Maps = require("react-native-maps") as MapsModule;
} catch {
  Maps = null;
}

function directionsUrl(store: NearbyStoreWire): string {
  const q = encodeURIComponent(store.name);
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?q=${q}&ll=${store.lat},${store.lng}`
    : `geo:${store.lat},${store.lng}?q=${store.lat},${store.lng}(${q})`;
}

/** Resy's rating line: solid star, bold value, muted count. */
function RatingLine({
  rating,
  count,
  category,
  size = 14,
}: {
  rating: number | null;
  count: number;
  category?: string | null;
  size?: number;
}) {
  const p = useThemedPalette();
  return (
    <View style={styles.inlineRow}>
      {rating != null ? (
        <>
          <Star
            size={size}
            color={p.accent.amber}
            fill={p.accent.amber}
            strokeWidth={0}
          />
          <Text style={[styles.ratingValue, { color: p.accent.amber, fontSize: size }]}>
            {rating.toFixed(1)}
          </Text>
          <Text style={[styles.metaText, { color: p.ink.muted, fontSize: size }]}>
            ({count})
          </Text>
        </>
      ) : (
        <Text style={[styles.metaText, { color: p.ink.dim, fontSize: size }]}>
          No reviews yet
        </Text>
      )}
      {category ? (
        <Text style={[styles.metaText, { color: p.ink.muted, fontSize: size }]}>
          {" · "}
          {category}
        </Text>
      ) : null}
    </View>
  );
}

function Stars({ value, size = 12 }: { value: number; size?: number }) {
  const p = useThemedPalette();
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={i <= Math.round(value) ? p.accent.amber : p.ink.dim}
          fill={i <= Math.round(value) ? p.accent.amber : "transparent"}
          strokeWidth={1.8}
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
  storeId: string | null;
  fallback?: NearbyStoreWire | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const { scheme } = useTheme();
  const detail = useStoreDetail(storeId);
  const upsert = useUpsertStoreReview();
  const remove = useDeleteStoreReview();
  const toggleSave = useToggleSaveStore();

  const store = detail.data?.store ?? fallback ?? null;
  const saved = store?.is_saved ?? false;
  
  const reviews = detail.data?.reviews ?? [];
  const mine = reviews.find((r) => r.is_mine) ?? null;

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  // A shop's own server can still refuse the hotlink; fall back rather
  // than leaving a blank frame.
  const [photoFailed, setPhotoFailed] = useState(false);
  // Resy's handoff: past the hero, the floating ✕/♡/↗ become a solid bar
  // with the venue name centered.
  const [scrolled, setScrolled] = useState(false);
  // Photo OR map behind the controls — either way they're over imagery.
  const hasPhoto = true;

  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? "");
    setError(null);
    setComposing(false);
    setPhotoFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, mine?.id]);

  if (storeId == null) return null;

  const distance = store
    ? store.distance_km < 1
      ? `${Math.round(store.distance_km * 1000)} m`
      : `${(store.distance_km * 0.621371).toFixed(1)} mi`
    : "";

  const submit = () => {
    if (!storeId || rating < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    upsert.mutate(
      { storeId, rating, body: body.trim() || null },
      {
        onSuccess: () => {
          setError(null);
          setComposing(false);
        },
        onError: (e) =>
          setError(
            /username|claim/i.test(e.message)
              ? "Claim a username in Community before reviewing."
              : e.message,
          ),
      },
    );
  };

  const shareStore = async () => {
    if (!store) return;
    try {
      await Share.share({
        message: `${store.name} — ${store.address ?? store.category}`,
        url: directionsUrl(store),
      });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Modal
      visible={storeId != null}
      onRequestClose={onClose}
      animationType="slide"
      // The native iOS sheet (UISheetPresentationController): slides up AND
      // down with UIKit's own curve, drag-to-dismiss included. A hand-rolled
      // View could never match it — and unmounted before its exit animation
      // could play, which is what read as a flicker.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
      transparent={Platform.OS !== "ios"}
    >
      <View style={[styles.sheet, { backgroundColor: p.bg.base }]}>
        {scrolled ? (
          <View
            style={[
              styles.topBar,
              { backgroundColor: p.bg.base, borderBottomColor: p.line.default },
            ]}
          >
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.topBarBtn}
            >
              <X size={24} color={p.ink.default} strokeWidth={2.2} />
            </Pressable>
            <Text
              numberOfLines={1}
              style={[styles.topBarTitle, { color: p.ink.default }]}
            >
              {store?.name ?? "Card shop"}
            </Text>
            <View style={styles.topBarRight}>
              <Pressable
                onPress={() => {
                  if (!storeId) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {},
                  );
                  toggleSave.mutate({ storeId, saved });
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={saved ? "Remove from saved" : "Save this shop"}
                style={styles.topBarBtn}
              >
                <Heart
                  size={22}
                  color={saved ? p.accent.rose : p.ink.default}
                  fill={saved ? p.accent.rose : "transparent"}
                  strokeWidth={2}
                />
              </Pressable>
              <Pressable
                onPress={() => void shareStore()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Share this shop"
                style={styles.topBarBtn}
              >
                <Share2 size={20} color={p.ink.default} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ) : null}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          scrollEventThrottle={16}
          onScroll={(e) => {
            // Swap at the point the hero leaves the frame.
            const y = e.nativeEvent.contentOffset.y;
            if (y > 250 !== scrolled) setScrolled(y > 250);
          }}
        >
          {/* ── Hero: photo edge-to-edge with the accent hairline, controls
                floating on top, "View All" pill bottom-right (Resy). ── */}
          <View style={[styles.hero, { borderColor: withAlpha(p.accent.amber, 0.55) }]}>
            <View
              style={[
                styles.heroArt,
                // Neutral surface, NOT a tint wash: a saturated block with
                // same-hue content read as a failed image.
                { backgroundColor: p.bg.elevated },
              ]}
            >
              {store?.photo_url && !photoFailed ? (
                <Image
                  source={{ uri: store.photo_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={180}
                  onError={() => setPhotoFailed(true)}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <>
                  {/* No photo published → show WHERE it is. A live map of
                      the block beats a flat colour every time. */}
                  {Maps && store && store.lat !== 0 ? (
                    <Maps.default
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                      initialRegion={{
                        latitude: store.lat,
                        longitude: store.lng,
                        latitudeDelta: 0.006,
                        longitudeDelta: 0.006,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      userInterfaceStyle={scheme === "dark" ? "dark" : "light"}
                    >
                      <Maps.Marker
                        coordinate={{ latitude: store.lat, longitude: store.lng }}
                        pinColor={p.accent.rose}
                      />
                    </Maps.default>
                  ) : null}
                  <View
                    style={[
                      styles.heroBadge,
                      { backgroundColor: withAlpha("#000000", 0.55) },
                    ]}
                  >
                    <Store size={13} color="#ffffff" strokeWidth={2.2} />
                    <Text style={styles.heroBadgeText}>
                      {store?.category ?? "Card shop"}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.heroTop} pointerEvents="box-none">
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.heroBtn}
              >
                <X
                  size={26}
                  color={hasPhoto ? "#ffffff" : p.ink.default}
                  strokeWidth={2.2}
                />
              </Pressable>
              <View style={styles.heroTopRight}>
                <Pressable
                  onPress={() => {
                    if (!storeId) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => {},
                    );
                    toggleSave.mutate(
                      { storeId, saved },
                      {
                        onError: (e) =>
                          setError(
                            /401|auth/i.test(e.message)
                              ? "Sign in to save shops."
                              : `Couldn't save: ${e.message}`,
                          ),
                      },
                    );
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={saved ? "Remove from saved" : "Save this shop"}
                  style={styles.heroBtn}
                >
                  <Heart
                    size={24}
                    color={saved ? p.accent.rose : hasPhoto ? "#ffffff" : p.ink.default}
                    fill={saved ? p.accent.rose : "transparent"}
                    strokeWidth={2}
                  />
                </Pressable>
                <Pressable
                  onPress={() => void shareStore()}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Share this shop"
                  style={styles.heroBtn}
                >
                  <Share2
                    size={22}
                    color={hasPhoto ? "#ffffff" : p.ink.default}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            </View>

            {store?.photo_url && !photoFailed ? (
              <View style={styles.viewAll}>
                <Text style={styles.viewAllText}>View All (1)</Text>
              </View>
            ) : null}
          </View>

          {error ? (
            <View style={styles.block}>
              <Text style={[styles.error, { color: p.accent.rose }]}>{error}</Text>
            </View>
          ) : null}

          {/* ── Identity block ── */}
          <View style={styles.block}>
            <Text style={[styles.name, { color: p.ink.default }]}>
              {store?.name ?? "Card shop"}
            </Text>
            <RatingLine
              rating={store?.rating ?? null}
              count={store?.review_count ?? 0}
              category={store?.category}
            />
            <View style={styles.inlineRow}>
              <MapPin size={14} color={p.ink.muted} strokeWidth={2.2} />
              <Text style={[styles.metaText, { color: p.ink.muted }]}>
                {[store?.address?.split(",").slice(-1)[0]?.trim(), distance]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>

          {/* Two ratings, side by side: what COLLECTORS said here, and the
              general public's rating — which lives in Apple/Google Maps.
              There is no free API for those reviews, so rather than fake a
              number we hand the user straight to the place card. */}
          <View style={styles.ratingsBand}>
            <View
              style={[
                styles.ratingCard,
                { borderColor: p.line.default, backgroundColor: p.bg.elevated },
              ]}
            >
              <Text style={[styles.ratingCardLabel, { color: p.ink.dim }]}>
                COLLECTORS ON LOUPE
              </Text>
              {store?.rating != null ? (
                <>
                  <View style={styles.inlineRow}>
                    <Text style={[styles.ratingBig, { color: p.ink.default }]}>
                      {store.rating.toFixed(1)}
                    </Text>
                    <Stars value={store.rating} size={13} />
                  </View>
                  <Text style={[styles.ratingCardSub, { color: p.ink.muted }]}>
                    {store.review_count}{" "}
                    {store.review_count === 1 ? "review" : "reviews"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.ratingBig, { color: p.ink.dim }]}>—</Text>
                  <Text style={[styles.ratingCardSub, { color: p.ink.muted }]}>
                    Be the first to rate
                  </Text>
                </>
              )}
            </View>

            <Pressable
              onPress={() => store && void Linking.openURL(directionsUrl(store))}
              accessibilityRole="button"
              accessibilityLabel="See public ratings in Maps"
              style={[
                styles.ratingCard,
                { borderColor: p.line.default, backgroundColor: p.bg.elevated },
              ]}
            >
              <Text style={[styles.ratingCardLabel, { color: p.ink.dim }]}>
                PUBLIC RATING
              </Text>
              <View style={styles.inlineRow}>
                <MapPin size={17} color={p.ink.default} strokeWidth={2.2} />
                <Text style={[styles.ratingMapsText, { color: p.ink.default }]}>
                  Maps
                </Text>
                <ArrowUpRight size={13} color={p.ink.dim} strokeWidth={2.2} />
              </View>
              <Text style={[styles.ratingCardSub, { color: p.ink.muted }]}>
                Everyone else&apos;s reviews
              </Text>
            </Pressable>
          </View>

          <View style={[styles.rule, { backgroundColor: p.line.default }]} />

          {/* ── Primary action (Resy's "Notify DINNER" slot) ── */}
          <View style={styles.block}>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => store && void Linking.openURL(directionsUrl(store))}
                accessibilityRole="button"
                accessibilityLabel="Directions"
                style={[
                  styles.bigAction,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                <View style={styles.inlineRow}>
                  <Navigation size={15} color={p.ink.default} strokeWidth={2.4} />
                  <Text style={[styles.bigActionLabel, { color: p.ink.default }]}>
                    Directions
                  </Text>
                </View>
                <Text style={[styles.bigActionSub, { color: p.ink.dim }]}>
                  {distance.toUpperCase()}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setComposing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Write a review"
                style={[
                  styles.bigAction,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                <View style={styles.inlineRow}>
                  <Star size={15} color={p.ink.default} strokeWidth={2.4} />
                  <Text style={[styles.bigActionLabel, { color: p.ink.default }]}>
                    {mine ? "Edit review" : "Review"}
                  </Text>
                </View>
                <Text style={[styles.bigActionSub, { color: p.ink.dim }]}>
                  {store?.review_count ? `${store.review_count} TOTAL` : "BE FIRST"}
                </Text>
              </Pressable>
            </View>

            {/* Resy's ⓘ availability banner → our data-provenance note. */}
            <View
              style={[
                styles.banner,
                { borderColor: p.line.default, backgroundColor: p.bg.elevated },
              ]}
            >
              <Info size={15} color={p.ink.dim} strokeWidth={2.2} />
              <Text style={[styles.bannerText, { color: p.ink.muted }]}>
                {store?.opening_hours ? (
                  <>
                    Hours: <Text style={{ fontWeight: "700" }}>{store.opening_hours}</Text>
                  </>
                ) : (
                  <>
                    Hours aren&apos;t listed for this shop.{" "}
                    <Text style={{ fontWeight: "700" }}>
                      Call ahead before travelling.
                    </Text>
                  </>
                )}
              </Text>
            </View>
          </View>

          {/* ── About + map card (Resy screen 2) ── */}
          <View style={styles.block}>
            <Text style={[styles.sectionHead, { color: p.ink.default }]}>
              About {store?.name ?? "this shop"}
            </Text>
            <Text style={[styles.about, { color: p.ink.muted }]}>
              {store?.category === "Card & game store"
                ? "A dedicated card and game store — singles, sealed product, and usually table space for play."
                : "Listed as a shop that may carry trading cards alongside its main range. Worth a call before you travel."}
            </Text>

            <View style={[styles.mapCard, { backgroundColor: p.bg.elevated }]}>
              {Maps && store ? (
                <Maps.default
                  style={styles.mapThumb}
                  pointerEvents="none"
                  initialRegion={{
                    latitude: store.lat,
                    longitude: store.lng,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Maps.Marker
                    coordinate={{ latitude: store.lat, longitude: store.lng }}
                    pinColor={p.accent.rose}
                  />
                </Maps.default>
              ) : (
                <View
                  style={[
                    styles.mapThumb,
                    { alignItems: "center", justifyContent: "center" },
                  ]}
                >
                  <MapPin size={22} color={p.ink.dim} />
                </View>
              )}
              <Pressable
                onPress={() => store && void Linking.openURL(directionsUrl(store))}
                accessibilityRole="button"
                accessibilityLabel="Open in Maps"
                style={styles.addressBar}
              >
                <Text style={[styles.address, { color: p.ink.default }]}>
                  {store?.address ?? "Address not listed"}
                </Text>
              </Pressable>
            </View>

            {/* Info card with link rows — Resy's website / phone / social. */}
            <View style={[styles.infoCard, { backgroundColor: p.bg.elevated }]}>
              <View style={styles.infoHead}>
                <Text
                  numberOfLines={1}
                  style={[styles.infoName, { color: p.ink.default }]}
                >
                  {store?.name}
                </Text>
                <RatingLine
                  rating={store?.rating ?? null}
                  count={store?.review_count ?? 0}
                  category={store?.category}
                  size={13}
                />
              </View>
              {store?.website ? (
                <LinkRow
                  label={store.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  icon={<Globe size={15} color={p.ink.dim} strokeWidth={2.2} />}
                  external
                  onPress={() => void Linking.openURL(store.website as string)}
                />
              ) : null}
              {store?.phone ? (
                <LinkRow
                  label={store.phone}
                  icon={<Phone size={15} color={p.ink.dim} strokeWidth={2.2} />}
                  onPress={() =>
                    void Linking.openURL(
                      `tel:${(store.phone as string).replace(/\s/g, "")}`,
                    )
                  }
                />
              ) : null}
            </View>
          </View>

          {/* ── Reviews ── */}
          <View style={styles.block}>
            <Text style={[styles.sectionHead, { color: p.ink.default }]}>
              What other collectors say
            </Text>
            <Text style={[styles.sectionSub, { color: p.ink.muted }]}>
              {store?.review_count
                ? `${store.review_count} ${store.review_count === 1 ? "collector has" : "collectors have"} reviewed this shop.`
                : "Reviews here come from Loupe collectors — singles selection, prices, play space."}
            </Text>

            {composing || mine ? (
              <View style={[styles.composer, { backgroundColor: p.bg.elevated }]}>
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
                        size={26}
                        color={i <= rating ? p.accent.amber : p.ink.dim}
                        fill={i <= rating ? p.accent.amber : "transparent"}
                        strokeWidth={1.8}
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
                        setComposing(false);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Delete my review"
                      style={{ marginLeft: "auto" }}
                    >
                      <Trash2 size={16} color={p.accent.rose} strokeWidth={2.2} />
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
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setComposing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Write a review"
                style={[
                  styles.writePrompt,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                <Stars value={0} size={18} />
                <Text style={[styles.writePromptText, { color: p.ink.muted }]}>
                  Rate this shop
                </Text>
              </Pressable>
            )}

            {detail.isLoading ? (
              <ActivityIndicator color={p.ink.dim} style={{ marginTop: 14 }} />
            ) : reviews.length === 0 ? (
              <Text style={[styles.noReviews, { color: p.ink.dim }]}>
                No reviews yet. Tell other collectors what this shop is like.
              </Text>
            ) : (
              reviews.map((r) => <ReviewRow key={r.id} review={r} />)
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function LinkRow({
  label,
  icon,
  onPress,
  external = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  external?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={[styles.linkRow, { borderTopColor: p.line.default }]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={[
          styles.linkText,
          { color: p.ink.default, textDecorationLine: external ? "underline" : "none" },
        ]}
      >
        {label}
      </Text>
      {external ? <ArrowUpRight size={14} color={p.ink.dim} strokeWidth={2.2} /> : null}
    </Pressable>
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
        <View style={styles.inlineRow}>
          <Text numberOfLines={1} style={[styles.reviewWho, { color: p.ink.default }]}>
            {review.display_name?.trim() || `@${review.username ?? "collector"}`}
          </Text>
          {review.is_mine ? (
            <Text style={[styles.youTag, { color: p.accent.mint }]}>You</Text>
          ) : null}
        </View>
        <View style={styles.inlineRow}>
          <Stars value={review.rating} size={11} />
          <Text style={[styles.reviewDate, { color: p.ink.dim }]}>{when}</Text>
        </View>
        {review.body ? (
          <Text style={[styles.reviewBody, { color: p.ink.muted }]}>{review.body}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The native sheet owns its corners, height and gestures.
  sheet: { flex: 1 },
  scroll: { paddingBottom: 40 },
  // Solid bar that replaces the floating hero controls on scroll.
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  hero: {
    // Full-bleed like Resy — the photo is the width of the sheet.
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    overflow: "hidden",
  },
  heroArt: {
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  heroBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  heroBadgeText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  heroTop: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTopRight: { flexDirection: "row", alignItems: "center", gap: 18 },
  heroBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  viewAll: {
    position: "absolute",
    right: 14,
    bottom: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  viewAllText: { color: "#111111", fontSize: 14, fontWeight: "600" },
  block: { paddingHorizontal: 18, paddingTop: 14, gap: 8 },
  name: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, lineHeight: 36 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingValue: { fontWeight: "800" },
  metaText: { fontSize: 14 },
  starRow: { flexDirection: "row", gap: 1.5 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 18, marginTop: 16 },
  actionRow: { flexDirection: "row", gap: 10 },
  bigAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 3,
  },
  bigActionLabel: { fontSize: 15, fontWeight: "700" },
  bigActionSub: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6 },
  banner: {
    flexDirection: "row",
    gap: 9,
    borderWidth: 1,
    borderRadius: 6,
    padding: 13,
    marginTop: 4,
  },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  ratingsBand: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 14 },
  ratingCard: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  ratingCardLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1.1 },
  ratingBig: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6 },
  ratingMapsText: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  ratingCardSub: { fontSize: 12 },
  sectionSub: { fontSize: 13.5, lineHeight: 19, marginTop: -2 },
  sectionHead: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 6,
  },
  about: { fontSize: 15, lineHeight: 22 },
  mapCard: { borderRadius: 10, overflow: "hidden", marginTop: 8 },
  mapThumb: { height: 190, width: "100%" },
  addressBar: { paddingHorizontal: 14, paddingVertical: 14 },
  address: { fontSize: 16, fontWeight: "600" },
  infoCard: { borderRadius: 10, overflow: "hidden", marginTop: 12 },
  infoHead: { padding: 14, gap: 5 },
  infoName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkText: { flex: 1, fontSize: 15.5 },
  composer: { borderRadius: 10, padding: 13, gap: 10, marginTop: 4 },
  starPick: { flexDirection: "row", alignItems: "center", gap: 9 },
  composerInput: { fontSize: 14, minHeight: 46, textAlignVertical: "top" },
  error: { fontSize: 12.5 },
  post: { borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  postText: { fontSize: 14, fontWeight: "800" },
  writePrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
    marginTop: 4,
  },
  writePromptText: { fontSize: 14.5, fontWeight: "600" },
  noReviews: { fontSize: 14, paddingVertical: 16 },
  review: {
    flexDirection: "row",
    gap: 11,
    paddingTop: 13,
    marginTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewWho: { fontSize: 14, fontWeight: "700" },
  youTag: { fontSize: 10.5, fontWeight: "800" },
  reviewDate: { fontSize: 11.5 },
  reviewBody: { fontSize: 14, lineHeight: 19, marginTop: 2 },
});
