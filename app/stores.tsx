/**
 * Card shops near me — a native Apple/Google map of physical stores that
 * sell trading cards, fed by the backend's server-ranked, cached
 * `/v1/public/stores/nearby` (OpenStreetMap data — $0 recurring).
 *
 * Privacy-first: the map never auto-prompts. It opens on an explainer with
 * an "Enable location" action (the shared useUserLocation hook), and
 * coordinates go to the backend over HTTPS for the one query — never
 * persisted, never attached to the account.
 *
 * react-native-maps is NATIVE — builds ≤236 don't carry it, and this screen
 * arrives by OTA. The lazy require guard renders an "update the app" state
 * instead of crashing when the module isn't in the installed binary.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Compass,
  Globe,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react-native";
import { useNearbyStores } from "@/application/queries/stores/useNearbyStores";
import { useUserLocation } from "@/application/location/useUserLocation";
import type { NearbyStoreWire } from "@/infrastructure/http";
import { useTheme } from "@/presentation/theme";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

// ── Lazy native-module guard ──
type MapsModule = typeof import("react-native-maps");
let Maps: MapsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Maps = require("react-native-maps") as MapsModule;
} catch {
  Maps = null; // running on a binary built before the maps module shipped
}

const CARD_WIDTH = 300;
const PAGE_PADDING = 20;

function directionsUrl(store: NearbyStoreWire): string {
  const q = encodeURIComponent(store.name);
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?q=${q}&ll=${store.lat},${store.lng}`
    : `geo:${store.lat},${store.lng}?q=${store.lat},${store.lng}(${q})`;
}

export default function StoresScreen() {
  const p = useThemedPalette();
  const { scheme } = useTheme();
  const location = useUserLocation();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const effectiveCenter = center ?? location.coords;
  const stores = useNearbyStores(effectiveCenter, 15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<InstanceType<MapsModule["default"]> | null>(null);
  const listRef = useRef<FlatList<NearbyStoreWire>>(null);

  const rows = useMemo(() => stores.data?.stores ?? [], [stores.data]);

  const focusStore = useCallback(
    (store: NearbyStoreWire, index: number, fromMap: boolean) => {
      Haptics.selectionAsync().catch(() => {});
      setSelectedId(store.id);
      mapRef.current?.animateToRegion(
        {
          latitude: store.lat,
          longitude: store.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        350,
      );
      if (fromMap) {
        listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      }
    },
    [],
  );

  // ── State 1: the installed binary predates the native map module ──
  if (!Maps) {
    return (
      <Gate
        icon={<MapPin size={26} color={p.accent.mint} strokeWidth={2.2} />}
        title="Almost there"
        body="The map needs the newest app version. Update Loupe in TestFlight, then come back."
      />
    );
  }

  // ── State 2: no location permission yet — explain, then ask ──
  if (location.status !== "granted" || !effectiveCenter) {
    return (
      <Gate
        icon={<Compass size={26} color={p.accent.mint} strokeWidth={2.2} />}
        title="Find card shops near you"
        body="See stores around you that sell Pokémon, Magic, and other trading cards. Your location is used only to search — it's never stored."
        action={
          location.status === "granted" ? undefined : (
            <Pressable
              onPress={() => void location.request()}
              disabled={location.loading}
              accessibilityRole="button"
              accessibilityLabel="Enable location"
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: p.accent.mint,
                  opacity: pressed || location.loading ? 0.75 : 1,
                },
              ]}
            >
              <Text style={styles.ctaText}>
                {location.loading
                  ? "Asking…"
                  : location.canOpenSettings
                    ? "Open Settings"
                    : "Enable location"}
              </Text>
            </Pressable>
          )
        }
        loading={location.status === "granted" && !effectiveCenter}
      />
    );
  }

  const MapView = Maps.default;
  const { Marker } = Maps;

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle={scheme === "dark" ? "dark" : "light"}
        initialRegion={{
          latitude: effectiveCenter.lat,
          longitude: effectiveCenter.lng,
          latitudeDelta: 0.18,
          longitudeDelta: 0.18,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(region) => {
          // Re-query around the new center; the hook + backend both snap to
          // a grid, so small pans reuse the cache instead of refetching.
          setCenter({ lat: region.latitude, lng: region.longitude });
        }}
      >
        {rows.map((s, i) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            pinColor={
              s.category === "Card & game store" ? p.accent.mint : p.ink.dim
            }
            onPress={() => focusStore(s, i, true)}
          />
        ))}
      </MapView>

      {/* Floating header — back + title pill over the map. */}
      <SafeAreaView edges={["top"]} pointerEvents="box-none" style={styles.top}>
        <View style={styles.bar} pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.barBtn,
              { backgroundColor: p.bg.elevated, borderColor: p.line.default },
            ]}
          >
            <ChevronLeft size={19} color={p.ink.default} />
          </Pressable>
          <View
            style={[
              styles.titlePill,
              { backgroundColor: p.bg.elevated, borderColor: p.line.default },
            ]}
          >
            <MapPin size={13} color={p.accent.mint} strokeWidth={2.4} />
            <Text style={[styles.title, { color: p.ink.default }]}>
              Card shops near you
            </Text>
            {stores.isFetching ? (
              <View style={styles.scanning}>
                <ActivityIndicator size="small" color={p.ink.dim} />
                <Text style={[styles.scanningText, { color: p.ink.dim }]}>
                  {stores.data ? "Updating" : "Scanning area"}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      {/* Bottom rail — the shops as swipeable cards, synced with the pins. */}
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={styles.bottom}>
        {stores.isLoading ? (
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: PAGE_PADDING }}>
            {[0, 1].map((i) => (
              <View
                key={i}
                style={[
                  styles.card,
                  {
                    backgroundColor: p.bg.elevated,
                    borderColor: p.line.default,
                    minHeight: 140,
                    justifyContent: "center",
                  },
                ]}
              >
                <ActivityIndicator color={withAlpha(p.accent.mint, 0.6)} />
              </View>
            ))}
          </View>
        ) : rows.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: p.bg.elevated, borderColor: p.line.default },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
              {stores.data?.source === "unavailable"
                ? "Store search is briefly unavailable"
                : "No card shops found here"}
            </Text>
            <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
              {stores.data?.source === "unavailable"
                ? "Try again in a minute."
                : "Pan the map to search a different area."}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            horizontal
            data={rows}
            keyExtractor={(s) => s.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: PAGE_PADDING, gap: 12 }}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(
                e.nativeEvent.contentOffset.x / (CARD_WIDTH + 12),
              );
              const s = rows[i];
              if (s && s.id !== selectedId) focusStore(s, i, false);
            }}
            renderItem={({ item, index }) => (
              <StoreCard
                store={item}
                selected={item.id === selectedId}
                onPress={() => focusStore(item, index, false)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * One shop as a swipeable bottom card — Resy's venue-card anatomy, in
 * Loupe's clothes: category · distance eyebrow, the venue name BIG, an
 * address/hours line, and a row of solid action pills where Resy puts its
 * time slots.
 */
function StoreCard({
  store,
  selected,
  onPress,
}: {
  store: NearbyStoreWire;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const isCore = store.category === "Card & game store";
  const distance =
    store.distance_km < 1
      ? `${Math.round(store.distance_km * 1000)} m`
      : `${store.distance_km.toFixed(1)} km`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${store.name}, ${store.category}, ${distance} away`}
      style={[
        styles.card,
        {
          backgroundColor: p.bg.elevated,
          borderColor: selected ? p.accent.mint : p.line.default,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.cardEyebrow,
          { color: isCore ? p.accent.mint : p.ink.muted },
        ]}
      >
        {store.category.toUpperCase()} · {distance.toUpperCase()}
      </Text>
      <Text numberOfLines={1} style={[styles.cardName, { color: p.ink.default }]}>
        {store.name}
      </Text>
      {store.address || store.opening_hours ? (
        <Text numberOfLines={1} style={[styles.cardAddress, { color: p.ink.dim }]}>
          {[store.address, store.opening_hours].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      <View style={styles.cardActions}>
        <SlotPill
          primary
          icon={<Navigation size={13} color="#06140d" strokeWidth={2.6} />}
          label="Directions"
          onPress={() => void Linking.openURL(directionsUrl(store))}
        />
        {store.website ? (
          <SlotPill
            icon={<Globe size={13} color={p.ink.default} strokeWidth={2.4} />}
            label="Website"
            onPress={() => void Linking.openURL(store.website as string)}
          />
        ) : null}
        {store.phone ? (
          <SlotPill
            icon={<Phone size={13} color={p.ink.default} strokeWidth={2.4} />}
            label="Call"
            onPress={() =>
              void Linking.openURL(`tel:${(store.phone as string).replace(/\s/g, "")}`)
            }
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function SlotPill({
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
        style={[
          styles.actionText,
          { color: primary ? "#06140d" : p.ink.default },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Full-screen centered state (no module / no permission / locating). */
function Gate({
  icon,
  title,
  body,
  action,
  loading = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  loading?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg.base }]}>
      <View style={styles.gateBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[styles.barBtn, { borderColor: p.line.default }]}
        >
          <ChevronLeft size={19} color={p.ink.default} />
        </Pressable>
      </View>
      <View style={styles.gate}>
        <View
          style={[styles.gateIcon, { backgroundColor: withAlpha(p.accent.mint, 0.12) }]}
        >
          {icon}
        </View>
        <Text style={[styles.gateTitle, { color: p.ink.default }]}>{title}</Text>
        <Text style={[styles.gateBody, { color: p.ink.muted }]}>{body}</Text>
        {loading ? <ActivityIndicator color={p.accent.mint} /> : action}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 10,
  },
  barBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titlePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  title: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 10 },
  card: {
    width: CARD_WIDTH,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 5,
  },
  cardEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  cardName: { fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
  cardAddress: { fontSize: 12 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: { fontSize: 12.5, fontWeight: "700" },
  scanning: { flexDirection: "row", alignItems: "center", gap: 6 },
  scanningText: { fontSize: 11.5, fontWeight: "600" },
  emptyCard: {
    marginHorizontal: PAGE_PADDING,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  emptyTitle: { fontSize: 14.5, fontWeight: "800", letterSpacing: -0.2 },
  emptyBody: { fontSize: 12.5 },
  gateBar: { paddingHorizontal: 16, paddingTop: 6 },
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 12,
  },
  gateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  gateTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  gateBody: { fontSize: 13.5, lineHeight: 20, textAlign: "center" },
  cta: {
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 13,
    marginTop: 6,
  },
  ctaText: { color: "#06140d", fontSize: 15, fontWeight: "800" },
});
