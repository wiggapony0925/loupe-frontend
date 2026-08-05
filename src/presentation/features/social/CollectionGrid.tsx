/**
 * CollectionGrid — someone else's cards, in the app's own carousel tile
 * language.
 *
 * Each cell mirrors the storefront's CardTile recipe exactly: FULL card art
 * on the shared CardImage primitive (5:7, rounded 12, blur-up skeleton),
 * then name and a grade · value caption below — never cropped art with
 * chips floating on top. Browsing a collection should feel like browsing
 * the shop, because to the viewer that's what it is.
 *
 * Tapping a card opens the NATIVE card screen — live pricing, your own
 * ownership context and alerts.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import { CardImage } from "@/presentation/components/CardImage";
import { routes } from "@/shared/routes";
import { useThemedPalette } from "@/presentation/theme/tokens";

const GAP = 10;
const PAGE_PADDING = 20;
// Match CardTile's reserved text heights so wrap-rows align cell-for-cell.
const NAME_LINE_HEIGHT = 15;
const NAME_HEIGHT = NAME_LINE_HEIGHT * 2;

export function CollectionGrid({
  items,
}: {
  items: readonly SocialCollectionItemWire[];
}) {
  const { width } = useWindowDimensions();
  // Three across on a normal phone; the tile width is derived rather than
  // fixed so a small phone shrinks the art instead of dropping a column.
  const columns = width >= 700 ? 4 : 3;
  const tileW = (width - PAGE_PADDING * 2 - GAP * (columns - 1)) / columns;

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <CollectionTile key={item.id} item={item} width={tileW} />
      ))}
    </View>
  );
}

function CollectionTile({
  item,
  width,
}: {
  item: SocialCollectionItemWire;
  width: number;
}) {
  const p = useThemedPalette();
  const tileW = Math.round(width);
  const grade = Number(item.grade);
  const hasGrade = Number.isFinite(grade) && grade > 0;
  const gradeLabel =
    item.house === "loupe"
      ? "Raw"
      : hasGrade
        ? `${item.house.toUpperCase()} ${grade % 1 === 0 ? grade : grade.toFixed(1)}`
        : null;
  const value =
    item.estimated_value_usd != null
      ? `$${Number(item.estimated_value_usd).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}`
      : null;

  return (
    <Pressable
      onPress={() => router.push(routes.card(item.card_id))}
      accessibilityRole="button"
      accessibilityLabel={item.card_name ?? "Card"}
      style={({ pressed }) => [
        { width: tileW, overflow: "hidden", gap: 4, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <CardImage
        uri={item.card_image_url}
        width={tileW}
        aspectRatio={5 / 7}
        rounded={12}
        recyclingKey={item.id}
        alt={item.card_name ?? "Card"}
      />
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={[
          styles.name,
          {
            color: p.ink.default,
            width: tileW,
            height: NAME_HEIGHT,
            lineHeight: NAME_LINE_HEIGHT,
          },
        ]}
      >
        {item.card_name ?? "Unknown card"}
      </Text>
      <View style={styles.caption}>
        {gradeLabel ? (
          <Text numberOfLines={1} style={[styles.grade, { color: p.ink.dim }]}>
            {gradeLabel}
          </Text>
        ) : (
          <View />
        )}
        {value ? (
          <Text numberOfLines={1} style={[styles.value, { color: p.ink.default }]}>
            {value}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  name: { fontSize: 12, fontWeight: "600", letterSpacing: -0.1, marginTop: 2 },
  caption: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  grade: { fontSize: 11, flexShrink: 1 },
  value: { fontSize: 11.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
