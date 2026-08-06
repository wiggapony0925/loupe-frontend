/**
 * Collection shelves — a collector's PORTFOLIOS and their top SETS, as
 * edge-to-edge rails above the card grid.
 *
 * Portfolios come first: they're the collections the user actually curated
 * ("PC Binder", "For Trade"), which is what a collector means by "my
 * collections". The set breakdown is derived context and is CAPPED — a
 * vault spanning thirty catalog sets must not become a thirty-tile wall;
 * the top eight by value plus a "+N more" tile tells the story.
 *
 * One shared tile primitive keeps both shelves visually identical.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { FolderKanban, Layers, Package } from "lucide-react-native";
import type {
  SocialCollectionSetWire,
  SocialPortfolioWire,
  SocialSealedItemWire,
} from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const PAGE_PADDING = 20;
const MAX_SET_TILES = 8;

interface ShelfTile {
  key: string;
  name: string;
  sub: string;
  cover: string | null;
  /** Cover fallback tint (portfolio color, else accent). */
  tint?: string | null;
  icon: "folder" | "layers" | "box";
  /** Tap-through (portfolio tiles open their card list). */
  onPress?: () => void;
}

function money(v: string | null): string | null {
  if (v == null) return null;
  return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * ShowcaseShelf — the Collectr-style treatment: the ART is the hero.
 * A rail of tall cards, each with the collection's cover presented like a
 * product shot (full card, contained, on a soft tint), name + count·value
 * beneath. Used for PORTFOLIOS and SEALED — the things a collector chose.
 */
function ShowcaseShelf({ label, tiles }: { label: string; tiles: ShelfTile[] }) {
  const p = useThemedPalette();
  if (tiles.length === 0) return null;
  return (
    <View style={styles.shelf}>
      <Text style={[styles.label, { color: p.ink.dim }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.rail}
      >
        {tiles.map((t) => {
          const tint = t.tint || p.accent.mint;
          const Icon =
            t.icon === "folder" ? FolderKanban : t.icon === "box" ? Package : Layers;
          return (
            <Pressable
              key={t.key}
              onPress={t.onPress}
              disabled={!t.onPress}
              accessibilityRole={t.onPress ? "button" : undefined}
              accessibilityLabel={
                t.onPress ? `${t.name}. Open card list.` : undefined
              }
              style={[
                styles.showcase,
                { borderColor: p.line.default, backgroundColor: p.bg.elevated },
              ]}
            >
              <View
                style={[styles.showcaseArt, { backgroundColor: withAlpha(tint, 0.09) }]}
              >
                {t.cover ? (
                  <Image
                    source={{ uri: t.cover }}
                    style={styles.showcaseImage}
                    contentFit="contain"
                    transition={140}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Icon size={26} color={tint} strokeWidth={2} />
                )}
              </View>
              <View style={styles.showcaseMeta}>
                <Text
                  numberOfLines={1}
                  style={[styles.showcaseName, { color: p.ink.default }]}
                >
                  {t.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.sub, { color: p.ink.dim }]}
                >
                  {t.sub}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Shelf({ label, tiles }: { label: string; tiles: ShelfTile[] }) {
  const p = useThemedPalette();
  if (tiles.length === 0) return null;
  return (
    <View style={styles.shelf}>
      {/* ink.dim, not ink.muted: these are CHILDREN of the page's Collection
          heading. At muted they matched it in weight and the hierarchy read
          flat — three headings all shouting at the same volume. */}
      <Text style={[styles.label, { color: p.ink.dim }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.rail}
      >
        {tiles.map((t) => {
          const tint = t.tint || p.accent.mint;
          const Icon =
            t.icon === "folder" ? FolderKanban : t.icon === "box" ? Package : Layers;
          return (
            // Mini spark-row anatomy (art left, text right) — the house
            // pattern for card rows. The cover keeps the card's OWN 5:7
            // portrait shape, full art, never a landscape crop. A disabled
            // Pressable is just a View, so only tap-through tiles react.
            <Pressable
              key={t.key}
              onPress={t.onPress}
              disabled={!t.onPress}
              accessibilityRole={t.onPress ? "button" : undefined}
              accessibilityLabel={t.onPress ? `${t.name}. Open card list.` : undefined}
              style={[
                styles.tile,
                { borderColor: p.line.default, backgroundColor: p.bg.elevated },
              ]}
            >
              <View
                style={[styles.art, { backgroundColor: withAlpha(tint, 0.1) }]}
              >
                {t.cover ? (
                  <Image
                    source={{ uri: t.cover }}
                    style={styles.artImage}
                    contentFit="cover"
                    transition={120}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Icon size={18} color={tint} strokeWidth={2.2} />
                )}
              </View>
              <View style={styles.meta}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: p.ink.default }]}
                >
                  {t.name}
                </Text>
                <Text numberOfLines={1} style={[styles.sub, { color: p.ink.dim }]}>
                  {t.sub}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The collector's curated collections (binders/decks). */
export function PortfolioShelf({
  portfolios,
  onTilePress,
}: {
  portfolios: readonly SocialPortfolioWire[];
  /** Tap a binder → open its card list (PortfolioSheet). */
  onTilePress?: (collectionId: string) => void;
}) {
  if (portfolios.length === 0) return null;
  const tiles: ShelfTile[] = portfolios.map((c) => ({
    key: c.id,
    name: c.name,
    sub: [
      `${c.count} ${c.count === 1 ? "card" : "cards"}`,
      money(c.estimated_value_usd),
    ]
      .filter(Boolean)
      .join(" · "),
    cover: c.cover_image_url,
    tint: c.color,
    icon: "folder",
    onPress: onTilePress ? () => onTilePress(c.id) : undefined,
  }));
  // "PORTFOLIOS", not "your collections" — the page's COLLECTION headline
  // already owns that word once.
  return <ShowcaseShelf label={`PORTFOLIOS · ${portfolios.length}`} tiles={tiles} />;
}

/** Sealed product (boxes, ETBs) — its own category with its own value. */
export function SealedShelf({
  sealed,
  totalCount,
  totalValue,
}: {
  sealed: readonly SocialSealedItemWire[];
  /** Unopened units vault-wide (tiles arrive server-capped). */
  totalCount?: number;
  totalValue?: string | null;
}) {
  if (sealed.length === 0) return null;
  const tiles: ShelfTile[] = sealed.map((s) => ({
    key: s.product_id,
    name: s.name,
    sub: [
      s.quantity > 1 ? `x${s.quantity}` : null,
      money(s.estimated_value_usd),
      s.set_name,
    ]
      .filter(Boolean)
      .join(" · "),
    cover: s.image_url,
    icon: "box",
  }));
  const label = [
    `SEALED · ${totalCount ?? sealed.length}`,
    money(totalValue ?? null),
  ]
    .filter(Boolean)
    .join(" · ");
  return <ShowcaseShelf label={label} tiles={tiles} />;
}

/** Top catalog sets by value, capped with a "+N more" tile. */
export function CollectionSetsRail({
  sets,
  totalSets,
}: {
  sets: readonly SocialCollectionSetWire[];
  /** Vault-wide set count from the server — `sets` arrives pre-capped. */
  totalSets?: number;
}) {
  const p = useThemedPalette();
  if (sets.length < 2) return null;
  const shown = sets.slice(0, MAX_SET_TILES); // belt for pre-cap payloads
  const hidden = Math.max(0, (totalSets ?? sets.length) - shown.length);
  const tiles: ShelfTile[] = shown.map((s) => ({
    key: s.name,
    name: s.name,
    sub: [
      `${s.count} ${s.count === 1 ? "card" : "cards"}`,
      money(s.estimated_value_usd),
    ]
      .filter(Boolean)
      .join(" · "),
    cover: s.cover_image_url,
    icon: "layers",
  }));
  if (hidden > 0) {
    tiles.push({
      key: "__more__",
      name: `+${hidden} more`,
      sub: "in the grid below",
      cover: null,
      tint: p.ink.dim,
      icon: "layers",
    });
  }
  return <Shelf label="TOP SETS" tiles={tiles} />;
}

const styles = StyleSheet.create({
  shelf: { gap: 10 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  bleed: { marginHorizontal: -PAGE_PADDING },
  rail: { paddingHorizontal: PAGE_PADDING, gap: 10, paddingVertical: 2 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 186,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  // True 5:7 portrait — the card's own shape, full art, no crop.
  art: {
    width: 40,
    height: 56,
    borderRadius: 7,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  artImage: { width: "100%", height: "100%" },
  meta: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 12.5, fontWeight: "700", letterSpacing: -0.2 },
  sub: { fontSize: 11 },
  showcase: {
    width: 168,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  // The cover as a product shot: full card, contained, breathing room.
  showcaseArt: {
    height: 128,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  showcaseImage: { width: "78%", height: "100%" },
  showcaseMeta: { paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  showcaseName: { fontSize: 13.5, fontWeight: "800", letterSpacing: -0.3 },
});
