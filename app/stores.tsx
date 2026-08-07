/**
 * Card shops near me — Resy's map anatomy in Loupe's clothes.
 *
 *   search pill ─ filter chips            ← float over the map
 *   ................ map ................
 *          [Search this area]  [◉]        ← searches are DELIBERATE
 *   ┌─ drawer ─────────────────────────┐
 *   │ ▔▔ big art block · name · meta   │  ← swipeable venue cards
 *   └──────────────────────────────────┘
 *
 * Speed model (the old screen re-queried on EVERY pan — seconds per new
 * area on the free OSM upstream, and it felt broken):
 *   • One automatic search at your location; after that, panning only arms
 *     the "Search this area" pill — searches happen when YOU ask.
 *   • The search box and category chips filter the LOADED results
 *     client-side — instant.
 *   • Previous results stay on screen while a new area loads
 *     (placeholderData), so the drawer never blanks.
 *
 * Privacy-first: never auto-prompts for location; coordinates are query
 * params only, never stored. react-native-maps is lazily required so this
 * screen ships by OTA — binaries ≤236 get an update gate, not a crash.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  Compass,
  Globe,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Search,
  Star,
  Store,
} from "lucide-react-native";
import {
  useNearbyStores,
  useSavedStores,
} from "@/application/queries/stores/useNearbyStores";
import { useUserLocation } from "@/application/location/useUserLocation";
import { StoreDetailSheet } from "@/presentation/features/stores/StoreDetailSheet";
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

const CARD_WIDTH = 316;
const PAGE_PADDING = 16;

/** Chip filters over the backend's category labels — instant, client-side. */
const FILTERS: { key: string; label: string; match: (c: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "cards", label: "Card & game", match: (c) => c === "Card & game store" },
  { key: "comics", label: "Comics", match: (c) => c === "Comic shop" },
  {
    key: "hobby",
    label: "Toys & hobby",
    match: (c) => c === "Toy store" || c === "Hobby shop" || c === "May carry cards",
  },
  // Saved swaps the source (see `rows`), so its matcher passes everything.
  { key: "saved", label: "♥ Saved", match: () => true },
];

function directionsUrl(store: NearbyStoreWire): string {
  const q = encodeURIComponent(store.name);
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?q=${q}&ll=${store.lat},${store.lng}`
    : `geo:${store.lat},${store.lng}?q=${store.lat},${store.lng}(${q})`;
}

/** Stable per-store hue for the art block (same trick as SocialAvatar). */
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export default function StoresScreen() {
  const p = useThemedPalette();
  const { scheme } = useTheme();
  const location = useUserLocation();
  // The SEARCHED center (drives the query). Pans don't move it — the
  // "Search this area" pill does.
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewRegion, setViewRegion] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const effectiveCenter = center ?? location.coords;
  const stores = useNearbyStores(effectiveCenter, 15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which shop's detail sheet is open (tap a card to open it).
  const [detailId, setDetailId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const savedStores = useSavedStores(filter === "saved");
  const mapRef = useRef<InstanceType<MapsModule["default"]> | null>(null);
  const listRef = useRef<FlatList<NearbyStoreWire>>(null);

  const rows = useMemo(() => {
    // The Saved chip swaps the data source entirely — your places are not
    // bounded by the current map view.
    const all =
      filter === "saved"
        ? (savedStores.data?.stores ?? [])
        : (stores.data?.stores ?? []);
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0]!;
    const needle = q.trim().toLowerCase();
    return all.filter(
      (s) =>
        f.match(s.category) &&
        (needle.length === 0 || s.name.toLowerCase().includes(needle)),
    );
  }, [stores.data, savedStores.data, filter, q]);

  // Arm "Search this area" once the viewport drifts ~3 km from what we
  // searched — Resy's model: the map is free to roam, searching is a verb.
  const searchArmed =
    effectiveCenter != null &&
    viewRegion != null &&
    kmBetween(effectiveCenter, viewRegion) > 3;

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

  const searchHere = useCallback(() => {
    if (!viewRegion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCenter(viewRegion);
  }, [viewRegion]);

  const locateMe = useCallback(() => {
    const c = location.coords;
    if (!c) return;
    Haptics.selectionAsync().catch(() => {});
    setCenter(c);
    mapRef.current?.animateToRegion(
      { latitude: c.lat, longitude: c.lng, latitudeDelta: 0.16, longitudeDelta: 0.16 },
      420,
    );
  }, [location.coords]);

  if (!Maps) {
    return (
      <Gate
        icon={<MapPin size={26} color={p.accent.mint} strokeWidth={2.2} />}
        title="Almost there"
        body="The map needs the newest app version. Update Loupe in TestFlight, then come back."
      />
    );
  }

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
              style={[styles.cta, { backgroundColor: p.accent.mint }]}
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
          latitudeDelta: 0.16,
          longitudeDelta: 0.16,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(region) => {
          setViewRegion({ lat: region.latitude, lng: region.longitude });
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

      {/* ── Floating search pill + filter chips (the Resy header) ── */}
      <SafeAreaView edges={["top"]} pointerEvents="box-none" style={styles.top}>
        <View style={styles.searchRow} pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.roundBtn,
              { backgroundColor: p.bg.elevated, borderColor: p.line.default },
            ]}
          >
            <ChevronLeft size={19} color={p.ink.default} />
          </Pressable>
          <View
            style={[
              styles.searchPill,
              { backgroundColor: p.bg.elevated, borderColor: p.line.default },
            ]}
          >
            <Search size={15} color={p.ink.dim} strokeWidth={2.4} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search card shops"
              placeholderTextColor={p.ink.dim}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.searchInput, { color: p.ink.default }]}
              accessibilityLabel="Search the loaded card shops by name"
            />
            {stores.isFetching ? (
              <ActivityIndicator size="small" color={p.ink.dim} />
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFilter(f.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter: ${f.label}`}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: p.accent.mint }
                    : {
                        backgroundColor: p.bg.elevated,
                        borderWidth: 1,
                        borderColor: p.line.default,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#06140d" : p.ink.default },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* ── Search-this-area + locate (float above the drawer) ── */}
      <View pointerEvents="box-none" style={styles.mapActions}>
        {searchArmed ? (
          <Pressable
            onPress={searchHere}
            accessibilityRole="button"
            accessibilityLabel="Search this area"
            style={[styles.searchHere, { backgroundColor: p.ink.default }]}
          >
            {stores.isFetching ? (
              <ActivityIndicator size="small" color={p.bg.base} />
            ) : null}
            <Text style={[styles.searchHereText, { color: p.bg.base }]}>
              Search this area
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={locateMe}
          accessibilityRole="button"
          accessibilityLabel="Back to my location"
          style={[
            styles.roundBtn,
            { backgroundColor: p.bg.elevated, borderColor: p.line.default },
          ]}
        >
          <Navigation size={16} color={p.ink.default} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* ── The drawer: dark panel, grabber, swipeable venue cards ── */}
      <View style={[styles.drawer, { backgroundColor: p.bg.base }]}>
        <View style={[styles.grabber, { backgroundColor: p.line.default }]} />
        <SafeAreaView edges={["bottom"]}>
          {stores.isLoading ? (
            <View style={styles.skeletonRow}>
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.card,
                    { backgroundColor: p.bg.elevated, borderColor: p.line.default },
                  ]}
                >
                  <View
                    style={[
                      styles.artBlock,
                      { backgroundColor: withAlpha(p.accent.mint, 0.08) },
                    ]}
                  >
                    <ActivityIndicator color={withAlpha(p.accent.mint, 0.6)} />
                  </View>
                  <View style={{ padding: 14, gap: 8 }}>
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: "60%", backgroundColor: withAlpha(p.ink.dim, 0.12) },
                      ]}
                    />
                    <View
                      style={[
                        styles.skeletonBar,
                        { width: "40%", backgroundColor: withAlpha(p.ink.dim, 0.08) },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
                {filter === "saved"
                  ? "No saved places yet"
                  : stores.data?.source === "unavailable"
                    ? "Store search is briefly unavailable"
                    : q || filter !== "all"
                      ? "No shops match your filters here"
                      : "No card shops found in this area"}
              </Text>
              <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
                {filter === "saved"
                  ? "Tap the heart on a shop to save it here."
                  : stores.data?.source === "unavailable"
                    ? "Try again in a minute."
                    : "Pan the map, then tap Search this area."}
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
                  onPress={() => {
                    // First tap focuses the pin; tapping the focused card
                    // opens its page — Resy's exact interaction.
                    if (item.id === selectedId) setDetailId(item.id);
                    else focusStore(item, index, false);
                  }}
                />
              )}
            />
          )}
        </SafeAreaView>
      </View>

      {/* The shop's page: photo, rating, actions, community reviews. */}
      <StoreDetailSheet
        storeId={detailId}
        fallback={rows.find((s) => s.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
      />
    </View>
  );
}

/**
 * A venue card, Resy anatomy: big visual block up top (we have no store
 * photography, so it's a themed art block — per-store hue, storefront
 * glyph, the shop's initial), then name, meta, and the action-pill row
 * where Resy puts time slots.
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
  const tint = `hsl(${hueFor(store.name)}, 48%, 52%)`;
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
      <View style={[styles.artBlock, { backgroundColor: withAlpha(tint, 0.16) }]}>
        <Store size={30} color={tint} strokeWidth={1.8} />
        <Text style={[styles.artInitial, { color: withAlpha(tint, 0.55) }]}>
          {store.name.charAt(0).toUpperCase()}
        </Text>
        <View
          style={[
            styles.distanceBadge,
            { backgroundColor: withAlpha("#000000", 0.45) },
          ]}
        >
          <Text style={styles.distanceText}>{distance}</Text>
        </View>
        {store.is_saved ? (
          <View
            style={[
              styles.savedBadge,
              { backgroundColor: withAlpha("#000000", 0.45) },
            ]}
          >
            <Heart size={13} color={p.accent.rose} fill={p.accent.rose} strokeWidth={0} />
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={[styles.cardName, { color: p.ink.default }]}>
          {store.name}
        </Text>
        {store.rating != null ? (
          <View style={styles.cardRating}>
            <Star size={12} color={p.accent.amber} fill={p.accent.amber} strokeWidth={2} />
            <Text style={[styles.cardRatingText, { color: p.ink.default }]}>
              {store.rating.toFixed(1)}
            </Text>
            <Text style={[styles.cardMeta, { color: p.ink.dim }]}>
              ({store.review_count})
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.cardMeta,
            { color: isCore ? p.accent.mint : p.ink.muted },
          ]}
        >
          {[store.category, store.address].filter(Boolean).join(" · ")}
        </Text>
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
                void Linking.openURL(
                  `tel:${(store.phone as string).replace(/\s/g, "")}`,
                )
              }
            />
          ) : null}
        </View>
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
        style={[styles.actionText, { color: primary ? "#06140d" : p.ink.default }]}
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
          style={[styles.roundBtn, { borderColor: p.line.default }]}
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 6,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 15,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: "500" },
  chipsRow: { marginTop: 10 },
  chipsContent: { paddingHorizontal: PAGE_PADDING, gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "700", letterSpacing: -0.1 },
  mapActions: {
    position: "absolute",
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    bottom: 258,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchHere: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  searchHereText: { fontSize: 13.5, fontWeight: "800", letterSpacing: -0.2 },
  drawer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 6,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 10,
  },
  skeletonRow: { flexDirection: "row", gap: 12, paddingHorizontal: PAGE_PADDING },
  skeletonBar: { height: 10, borderRadius: 5 },
  card: {
    width: CARD_WIDTH,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  artBlock: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  artInitial: {
    position: "absolute",
    right: 14,
    bottom: 2,
    fontSize: 64,
    fontWeight: "900",
    opacity: 0.5,
  },
  distanceBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  distanceText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  savedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 999,
    padding: 6,
  },
  cardBody: { padding: 14, paddingTop: 11, gap: 3 },
  cardName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.45 },
  cardMeta: { fontSize: 12 },
  cardRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardRatingText: { fontSize: 12.5, fontWeight: "800" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 9 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: { fontSize: 12.5, fontWeight: "700" },
  emptyWrap: { paddingHorizontal: PAGE_PADDING, paddingVertical: 22, gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
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
  cta: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13, marginTop: 6 },
  ctaText: { color: "#06140d", fontSize: 15, fontWeight: "800" },
});
