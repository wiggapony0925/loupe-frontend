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
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { FolderKanban, Layers } from "lucide-react-native";
import type {
  SocialCollectionSetWire,
  SocialPortfolioWire,
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
  icon: "folder" | "layers";
}

function money(v: string | null): string | null {
  if (v == null) return null;
  return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Shelf({ label, tiles }: { label: string; tiles: ShelfTile[] }) {
  const p = useThemedPalette();
  if (tiles.length === 0) return null;
  return (
    <View style={styles.shelf}>
      <Text style={[styles.label, { color: p.ink.muted }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.rail}
      >
        {tiles.map((t) => {
          const tint = t.tint || p.accent.mint;
          const Icon = t.icon === "folder" ? FolderKanban : Layers;
          return (
            <View
              key={t.key}
              style={[
                styles.tile,
                { borderColor: p.line.default, backgroundColor: p.bg.elevated },
              ]}
            >
              {t.cover ? (
                <Image
                  source={{ uri: t.cover }}
                  style={styles.cover}
                  contentFit="cover"
                  transition={120}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={[
                    styles.cover,
                    styles.coverFallback,
                    { backgroundColor: withAlpha(tint, 0.12) },
                  ]}
                >
                  <Icon size={20} color={tint} strokeWidth={2.2} />
                </View>
              )}
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
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The collector's curated collections (binders/decks). */
export function PortfolioShelf({
  portfolios,
  isSelf,
}: {
  portfolios: readonly SocialPortfolioWire[];
  isSelf: boolean;
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
  }));
  return (
    <Shelf
      label={isSelf ? `YOUR COLLECTIONS · ${portfolios.length}` : `COLLECTIONS · ${portfolios.length}`}
      tiles={tiles}
    />
  );
}

/** Top catalog sets by value, capped with a "+N more" tile. */
export function CollectionSetsRail({
  sets,
}: {
  sets: readonly SocialCollectionSetWire[];
}) {
  const p = useThemedPalette();
  if (sets.length < 2) return null;
  const shown = sets.slice(0, MAX_SET_TILES);
  const hidden = sets.length - shown.length;
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
  shelf: { gap: 6 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  bleed: { marginHorizontal: -PAGE_PADDING },
  rail: { paddingHorizontal: PAGE_PADDING, gap: 10, paddingVertical: 2 },
  tile: {
    width: 132,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cover: { width: "100%", height: 92 },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  meta: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  name: { fontSize: 12.5, fontWeight: "700", letterSpacing: -0.2 },
  sub: { fontSize: 11 },
});
