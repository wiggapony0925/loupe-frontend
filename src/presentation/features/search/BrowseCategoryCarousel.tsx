/**
 * BrowseCategoryCarousel — horizontal TCG quick-filter rail for Search.
 *
 * Each tile is logo + name only. Tapping sets the same TCG facet as the
 * chip row above — Discover then loads `/v1/public/carousels/resolved`
 * (identical to the web marketplace). No client-side card counts.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandLogo } from "@/presentation/brand/BrandLogo";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type AccentKey = "mint" | "blue" | "amber" | "rose" | "purple";

export interface BrowseCategory {
  key: string;
  label: string;
  mono: string;
  accent: AccentKey;
}

interface BrowseCategoryCarouselProps {
  categories: BrowseCategory[];
  /** Currently selected TCG chip key (`all` / pokemon / …). */
  activeKey: string;
  onSelect: (key: string) => void;
  /** Page gutter — lets the rail bleed edge-to-edge like other carousels. */
  edgeBleed?: number;
}

const TILE_W = 120;
const LOGO_W = 96;
const LOGO_H = 48;

export function BrowseCategoryCarousel({
  categories,
  activeKey,
  onSelect,
  edgeBleed = 20,
}: BrowseCategoryCarouselProps) {
  const p = useThemedPalette();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -edgeBleed }}
      contentContainerStyle={{
        gap: 10,
        paddingTop: 16,
        paddingHorizontal: edgeBleed,
        paddingRight: edgeBleed + 4,
      }}
    >
      {categories.map((cat) => {
        const active = activeKey === cat.key;
        const tint = p.accent[cat.accent];

        return (
          <Pressable
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter by ${cat.label}${active ? ", selected" : ""}`}
            style={({ pressed }) => ({
              width: TILE_W,
              paddingTop: 20,
              paddingBottom: 16,
              paddingHorizontal: 12,
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.92 : 1,
              transform: pressed ? [{ scale: 0.97 }] : undefined,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: active ? withAlpha(tint, 0.55) : p.line.default,
              backgroundColor: active ? withAlpha(tint, 0.1) : p.bg.elevated,
            })}
          >
            <View style={{ height: LOGO_H, justifyContent: "center" }}>
              <BrandLogo brand={cat.key} width={LOGO_W} height={LOGO_H} tint={tint} />
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: active ? tint : p.ink.default,
                fontSize: 13,
                fontWeight: "800",
                lineHeight: 16,
                textAlign: "center",
              }}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
