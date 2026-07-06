/**
 * NearbyListingsSection — "Near You" carousel of Facebook Marketplace
 * listings for the viewed card, scoped to a radius around the user's device
 * location. Scraping happens server-side via Apify (`useCardNearbyListings`);
 * the device only contributes coordinates after the user opts in.
 *
 * Renders one of four states, all themed to match LiveListingsSection:
 *   1. permission not granted → "Enable Location" CTA (or "Open Settings"
 *      when the OS won't re-prompt)
 *   2. loading → skeleton carousel
 *   3. results → horizontal carousel of MarketplaceTileCard (Facebook-toned)
 *   4. empty → tidy "no nearby listings" note
 *
 * Privacy: coordinates are requested only on tap, never persisted, and sent
 * to our backend over HTTPS only. See `useUserLocation`.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MapPin, Navigation, Settings2, ShoppingBag } from "lucide-react-native";
import type { ExternalBrowserTarget } from "@/presentation/components/ExternalBrowserSheet";
import { openExternalUrl } from "@/shared/openExternalUrl";
import {
  MarketplaceTileCard,
  MARKETPLACE_PHOTO_TILE_WIDTH,
} from "@/presentation/components/MarketplaceTileCard";
import { SkeletonListingsCarousel } from "@/presentation/components/Skeletons";
import { radius, spacing, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useUserLocation } from "@/application/location/useUserLocation";
import { useCardNearbyListings } from "@/application/queries/catalog/useCardNearbyListings";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import type { CardSearchResult, NearbyListingWire } from "@/infrastructure/http";
import { SectionHeader } from "./CardDetailParts";
import { formatNativeMoney } from "./marketplaceTiles";

export function NearbyListingsSection({
  cardId,
  card,
}: {
  cardId: string;
  card?: CardSearchResult | null;
}) {
  const location = useUserLocation();
  const q = useCardNearbyListings(cardId, {
    lat: location.coords?.lat,
    lng: location.coords?.lng,
    radiusKm: 40,
    limit: 12,
  });

  const granted = location.status === "granted" && !!location.coords;
  const listings = q.data?.listings ?? [];
  // If the nearest copy is well outside the search radius, the backend widened
  // to find the closest — reflect that in the badge instead of "N nearby".
  const nearestKm = listings.find((l) => l.distance_km != null)?.distance_km ?? null;
  const expanded = nearestKm != null && nearestKm > 60;
  const badge =
    granted && listings.length > 0
      ? expanded
        ? "nearest"
        : `${listings.length} nearby`
      : null;

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader label="Near You" badge={badge} />

      {!granted ? (
        <EnableLocationCard
          loading={location.loading}
          canOpenSettings={location.canOpenSettings}
          onPress={location.request}
        />
      ) : q.isLoading ? (
        <SkeletonListingsCarousel count={3} />
      ) : listings.length > 0 ? (
        <NearbyListingList
          listings={listings}
          cardName={card?.name ?? null}
          cardImageUrl={pickCardImageUrl(card, "normal") ?? null}
          cardBlurhash={pickCardBlurhash(card) ?? null}
          onOpen={(t) => openExternalUrl(t.url)}
        />
      ) : (
        <NearbyEmptyNote isError={q.isError} />
      )}
    </View>
  );
}

// ─── Enable-location CTA ────────────────────────────────────────────────

function EnableLocationCard({
  loading,
  canOpenSettings,
  onPress,
}: {
  loading: boolean;
  canOpenSettings: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const accent = p.accent.blue;
  const label = canOpenSettings ? "Open Settings" : "Enable Location";

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(accent, 0.12),
          }}
        >
          <MapPin size={18} color={accent} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
            Find this card near you
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            Enable location to see Facebook Marketplace listings for sale in your
            area.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            paddingVertical: 11,
            borderRadius: radius.md,
            backgroundColor: accent,
          },
          pressed && { opacity: 0.85 },
          loading && { opacity: 0.6 },
        ]}
      >
        {canOpenSettings ? (
          <Settings2 size={15} color="#fff" strokeWidth={2.5} />
        ) : (
          <Navigation size={15} color="#fff" strokeWidth={2.5} />
        )}
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>
          {loading ? "Locating…" : label}
        </Text>
      </Pressable>

      <Text style={{ color: p.ink.dim, fontSize: 10, textAlign: "center" }}>
        Your location is used only to search nearby listings — never stored.
      </Text>
    </View>
  );
}

// ─── Results carousel ───────────────────────────────────────────────────

function browserTargetForNearby(listing: NearbyListingWire): ExternalBrowserTarget | null {
  if (!listing.url) return null;
  return {
    title: "Facebook Marketplace",
    subtitle: listing.location_label ?? listing.title,
    url: listing.url,
  };
}

function formatDistance(km: number | null | undefined): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return "<1 km";
  return `${Math.round(km)} km`;
}

function NearbyListingList({
  listings,
  cardName,
  cardImageUrl,
  cardBlurhash,
  onOpen,
}: {
  listings: NearbyListingWire[];
  cardName: string | null;
  cardImageUrl: string | null;
  cardBlurhash: string | null;
  onOpen: (target: ExternalBrowserTarget) => void;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.accent.blue }} />
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 2.5,
            textTransform: "uppercase",
          }}
        >
          Facebook Marketplace
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm + 2, paddingBottom: 4, paddingRight: 4 }}
        decelerationRate="fast"
        snapToInterval={MARKETPLACE_PHOTO_TILE_WIDTH + spacing.sm + 2}
        snapToAlignment="start"
      >
        {listings.map((l, i) => {
          const target = browserTargetForNearby(l);
          const overlayLabel = formatDistance(l.distance_km) ?? l.location_label ?? null;
          const hasOwnPhoto = !!l.image_url;
          return (
            <MarketplaceTileCard
              key={`${l.url || l.title}:${i}`}
              layout="photo"
              imageUrl={l.image_url ?? cardImageUrl}
              blurhash={hasOwnPhoto ? null : cardBlurhash}
              fallbackIcon={ShoppingBag}
              accent={p.accent.blue}
              sourceLabel="Facebook"
              title={(l.title ?? "").trim() || cardName || "Marketplace listing"}
              caption="Nearby"
              priceText={formatNativeMoney(l.price.amount, l.price.currency)}
              condition={l.condition}
              statusOverlay={overlayLabel ? { icon: MapPin, label: overlayLabel } : null}
              disabled={!target}
              onPress={target ? () => onOpen(target) : undefined}
              accessibilityLabel={`Facebook Marketplace · ${l.title ?? "listing"}`}
              recyclingKey={l.url ?? l.image_url ?? String(i)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Empty / error note ─────────────────────────────────────────────────

function NearbyEmptyNote({ isError }: { isError: boolean }) {
  const p = useThemedPalette();
  const accent = isError ? p.accent.rose : p.accent.amber;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: withAlpha(accent, 0.18),
        backgroundColor: withAlpha(accent, 0.05),
      }}
    >
      <MapPin size={16} color={accent} strokeWidth={2.25} />
      <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 17, flex: 1 }}>
        {isError
          ? "Couldn't load nearby listings right now. Try again shortly."
          : "No Facebook Marketplace listings for this card near you yet."}
      </Text>
    </View>
  );
}
