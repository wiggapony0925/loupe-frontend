import React from "react";
import Svg, { Circle, Path, Polygon, G } from "react-native-svg";
import type { CardSet } from "@/types/domain";

interface TcgMarkProps {
  set: CardSet | "All";
  size?: number;
  /** Stroke + accent color. Defaults to currentColor-equivalent black. */
  color?: string;
  /** Background fill — usually the chip body color. */
  background?: string;
}

/**
 * Original, iconographic marks evoking each franchise category — NOT
 * the trademarked logos themselves. Designed to read at chip size
 * (16–20px) and scale cleanly via react-native-svg.
 */
export function TcgMark({ set, size = 16, color = "#0B0F14", background = "#FFFFFF" }: TcgMarkProps) {
  switch (set) {
    case "Pokemon Base Set":
      return <PokeballMark size={size} color={color} background={background} />;
    case "2026 World Cup Goals":
      return <SoccerMark size={size} color={color} background={background} />;
    case "Topps Chrome 2025":
      return <BaseballMark size={size} color={color} background={background} />;
    case "Magic Alpha":
      return <ManaMark size={size} color={color} background={background} />;
    case "All":
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

/** Short display label for chip text (the set name is verbose). */
export function tcgShortLabel(set: CardSet | "All"): string {
  switch (set) {
    case "Pokemon Base Set":
      return "Pokémon";
    case "2026 World Cup Goals":
      return "Soccer";
    case "Topps Chrome 2025":
      return "Topps";
    case "Magic Alpha":
      return "Magic";
    case "All":
    default:
      return "All";
  }
}
