import React from "react";
import { Image, View } from "react-native";
import Svg, { Circle, Path, Polygon, G } from "react-native-svg";
import type { CardSet } from "@/domain";
import { getBrandLogo, type BrandKey } from "@/shared/brandAssets";

interface TcgMarkProps {
  set: CardSet | "All" | string;
  size?: number;
  /** Stroke + accent color. Defaults to currentColor-equivalent black. */
  color?: string;
  /** Background fill — usually the chip body color. */
  background?: string;
}

/**
 * Map any vault set name → brand-registry key. Substring-based so it
 * works on real seeded names like "Pokemon Base Set", "Yu-Gi-Oh! LOB",
 * "One Piece OP-01", "Disney Lorcana – The First Chapter", etc.
 */
function brandKeyForSet(set: CardSet | "All" | string): BrandKey {
  if (set === "All") return "all";
  const s = String(set).toLowerCase();
  if (/yu-?gi-?oh/.test(s)) return "yugioh";
  if (/one\s?piece/.test(s)) return "onepiece";
  if (/lorcana/.test(s)) return "lorcana";
  if (/pok[eé]mon|pokemon/.test(s)) return "pokemon";
  if (/magic|mtg/.test(s)) return "magic";
  if (/topps|chrome|bowman/.test(s)) return "topps";
  if (/world cup|soccer|f[uú]tbol|fifa/.test(s)) return "soccer";
  if (/panini|prizm|select|donruss|nfl|nba|mlb/.test(s)) return "sports";
  return "all";
}

/**
 * Original, iconographic marks evoking each franchise category — NOT
 * the trademarked logos themselves. If a real licensed asset is
 * registered in `src/lib/brandAssets.ts`, that takes precedence and
 * the SVG glyph is used as fallback only.
 */
export function TcgMark({ set, size = 16, color = "#0B0F14", background = "#FFFFFF" }: TcgMarkProps) {
  const key = brandKeyForSet(set);
  const logo = getBrandLogo(key);
  if (logo) {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={logo}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
    );
  }

  switch (key) {
    case "pokemon":
      return <PokeballMark size={size} color={color} background={background} />;
    case "soccer":
      return <SoccerMark size={size} color={color} background={background} />;
    case "topps":
      return <BaseballMark size={size} color={color} background={background} />;
    case "magic":
      return <ManaMark size={size} color={color} background={background} />;
    case "yugioh":
      return <EyeMark size={size} color={color} background={background} />;
    case "onepiece":
      return <CompassMark size={size} color={color} background={background} />;
    case "lorcana":
      return <CastleMark size={size} color={color} background={background} />;
    case "sports":
      return <TrophyMark size={size} color={color} background={background} />;
    case "all":
    default:
      return <GridMark size={size} color={color} />;
  }
}

/* --------------------------------- glyphs -------------------------------- */

function PokeballMark({ size, color, background }: { size: number; color: string; background: string }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* top half filled with accent, bottom with background */}
      <Path d="M2 12a10 10 0 0 1 20 0H2Z" fill={color} />
      <Path d="M22 12a10 10 0 0 1-20 0h20Z" fill={background} />
      {/* equator band */}
      <Path d="M2 11h20v2H2z" fill={color} />
      {/* center button */}
      <Circle cx="12" cy="12" r="3.4" fill={background} stroke={color} strokeWidth="1.6" />
      <Circle cx="12" cy="12" r="1.2" fill={color} />
      {/* outer ring */}
      <Circle cx="12" cy="12" r={r - 0.6} fill="none" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

function SoccerMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill={background} stroke={color} strokeWidth="1.4" />
      {/* central pentagon */}
      <Polygon points="12,7.2 15.8,9.9 14.4,14.4 9.6,14.4 8.2,9.9" fill={color} />
      {/* radiating seams */}
      <Path d="M12 7.2 L12 3.2" stroke={color} strokeWidth="1.2" />
      <Path d="M15.8 9.9 L19.6 8.6" stroke={color} strokeWidth="1.2" />
      <Path d="M14.4 14.4 L17.2 17.6" stroke={color} strokeWidth="1.2" />
      <Path d="M9.6 14.4 L6.8 17.6" stroke={color} strokeWidth="1.2" />
      <Path d="M8.2 9.9 L4.4 8.6" stroke={color} strokeWidth="1.2" />
    </Svg>
  );
}

function BaseballMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill={background} stroke={color} strokeWidth="1.4" />
      {/* curved stitching seams (two arcs) */}
      <Path d="M5.2 6.8 C 8 10, 8 14, 5.2 17.2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <Path d="M18.8 6.8 C 16 10, 16 14, 18.8 17.2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* tiny cross stitches */}
      <G stroke={color} strokeWidth="0.9" strokeLinecap="round">
        <Path d="M6.4 8.6 L7.6 8.0" />
        <Path d="M6.0 11.0 L7.4 10.6" />
        <Path d="M6.0 13.0 L7.4 13.4" />
        <Path d="M6.4 15.4 L7.6 16.0" />
        <Path d="M17.6 8.6 L16.4 8.0" />
        <Path d="M18.0 11.0 L16.6 10.6" />
        <Path d="M18.0 13.0 L16.6 13.4" />
        <Path d="M17.6 15.4 L16.4 16.0" />
      </G>
    </Svg>
  );
}

function ManaMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* diamond gem */}
      <Polygon points="12,2.5 21.5,12 12,21.5 2.5,12" fill={color} />
      {/* inner facets */}
      <Polygon points="12,5.5 18.5,12 12,18.5 5.5,12" fill="none" stroke={background} strokeWidth="1.1" />
      <Path d="M12 5.5 L12 18.5" stroke={background} strokeWidth="0.9" />
      <Path d="M5.5 12 L18.5 12" stroke={background} strokeWidth="0.9" />
      {/* spark */}
      <Circle cx="12" cy="12" r="1.4" fill={background} />
    </Svg>
  );
}

function GridMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={color}>
        <Path d="M4 4h7v7H4z" />
        <Path d="M13 4h7v7h-7z" />
        <Path d="M4 13h7v7H4z" />
        <Path d="M13 13h7v7h-7z" />
      </G>
    </Svg>
  );
}

/** Generic mystical-eye glyph evoking ancient-Egyptian iconography. */
function EyeMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* almond outline */}
      <Path
        d="M2.5 12 C 6 6, 18 6, 21.5 12 C 18 18, 6 18, 2.5 12 Z"
        fill={background}
        stroke={color}
        strokeWidth="1.4"
      />
      {/* iris */}
      <Circle cx="12" cy="12" r="3.2" fill={color} />
      {/* pupil highlight */}
      <Circle cx="13" cy="11" r="0.9" fill={background} />
      {/* tail flourish */}
      <Path d="M12 15.2 L11.4 18.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

/** Compass rose — evokes seafaring adventure without copying any logo. */
function CompassMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill={background} stroke={color} strokeWidth="1.4" />
      {/* N/S needle (filled) */}
      <Polygon points="12,3.5 13.6,12 12,20.5 10.4,12" fill={color} />
      {/* E/W needle (outline) */}
      <Polygon points="3.5,12 12,13.4 20.5,12 12,10.6" fill="none" stroke={color} strokeWidth="1.1" />
      <Circle cx="12" cy="12" r="1.2" fill={background} stroke={color} strokeWidth="1" />
    </Svg>
  );
}

/** Castle silhouette — generic fairy-tale tower, no Disney IP. */
function CastleMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill={background} stroke={color} strokeWidth="1.2" />
      {/* central spire */}
      <Path d="M11 6.5 L12 4.5 L13 6.5 L13 9 L11 9 Z" fill={color} />
      {/* battlements */}
      <Path
        d="M6 11 h2 v-2 h2 v2 h2 v-2 h2 v2 h2 v-2 h2 v2 v6 H6 Z"
        fill={color}
      />
      {/* door */}
      <Path d="M11 17 h2 v-2.6 a1 1 0 0 0 -2 0 Z" fill={background} />
    </Svg>
  );
}

/** Trophy cup — generic sports accolade. */
function TrophyMark({ size, color, background }: { size: number; color: string; background: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* cup body */}
      <Path
        d="M8 4 h8 v4 a4 4 0 0 1 -8 0 Z"
        fill={color}
      />
      {/* handles */}
      <Path d="M8 5.5 H5.5 a1.5 1.5 0 0 0 0 3 H8" fill="none" stroke={color} strokeWidth="1.3" />
      <Path d="M16 5.5 H18.5 a1.5 1.5 0 0 1 0 3 H16" fill="none" stroke={color} strokeWidth="1.3" />
      {/* stem + base */}
      <Path d="M11 11 h2 v4 h-2 z" fill={color} />
      <Path d="M7 19 h10 v1.5 H7 z M9 16.5 h6 v2.5 H9 z" fill={color} />
      {/* highlight star */}
      <Circle cx="12" cy="6.5" r="1.1" fill={background} />
    </Svg>
  );
}

/** Short display label for chip text (the set name is verbose). */
export function tcgShortLabel(set: CardSet | "All" | string): string {
  const key = brandKeyForSet(set);
  switch (key) {
    case "pokemon":
      return "Pokémon";
    case "soccer":
      return "Soccer";
    case "topps":
      return "Topps";
    case "magic":
      return "Magic";
    case "yugioh":
      return "Yu-Gi-Oh!";
    case "onepiece":
      return "One Piece";
    case "lorcana":
      return "Lorcana";
    case "sports":
      return "Sports";
    case "all":
    default:
      return "All";
  }
}
