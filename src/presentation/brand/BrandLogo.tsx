/**
 * BrandLogo — official TCG wordmark for browse tiles and chips.
 *
 * Uses bundled PNGs from `assets/brands/` (see `brandAssets.ts`) so we never
 * hit CDN hotlink blocks at runtime. Falls back to the SVG `TcgMark` glyph
 * if a file is missing or fails to decode.
 */
import React, { useState } from "react";
import { View, type ImageStyle, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { getBrandLogo, type BrandKey } from "@/shared/brandAssets";
import { TcgMark } from "@/presentation/brand/TcgMark";

export interface BrandLogoProps {
  brand: BrandKey | string;
  width?: number;
  height?: number;
  /** Accent for the SVG fallback monogram. */
  tint?: string;
  background?: string;
  style?: ImageStyle;
}

export function BrandLogo({
  brand,
  width = 50,
  height = 36,
  tint = "#0B0F14",
  background = "transparent",
  style,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const logo = getBrandLogo(brand);

  if (!logo || failed) {
    return (
      <View style={[{ width, height, alignItems: "center", justifyContent: "center" }, style]}>
        <TcgMark
          set={brand}
          size={Math.min(width, height) - 4}
          color={tint}
          background={background}
          preferGlyph
        />
      </View>
    );
  }

  return (
    <Image
      source={logo}
      style={[{ width, height }, style]}
      contentFit="contain"
      transition={0}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}
