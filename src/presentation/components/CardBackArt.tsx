/**
 * `CardBackArt` — vector-rendered placeholder for a card's reverse face.
 *
 * Real card backs are copyrighted artwork (WOTC's Magic back, The
 * Pokémon Company's Pokéball back, Konami's eye-of-Anubis, etc.) and
 * shipping bitmap copies of them into the app bundle is a legal /
 * brand-safety conversation we do NOT want to lose. So instead we hand-
 * compose tasteful **interpretations** in SVG that read instantly as
 * "that TCG's back" without reproducing protected art:
 *
 *   - Pokémon  → ringed orb on a teal field
 *   - MTG      → off-center mana symbol stamp on a saddle-brown panel
 *   - Yu-Gi-Oh → diamond-checker grille on a brown panel
 *   - Lorcana  → script "L" monogram on a deep indigo field
 *   - One Piece→ skull-cross on a parchment cream field
 *   - unknown  → quiet "?" on a slate field
 *
 * When (if) we license official back art later, swap the per-variant
 * branch for a `<CardImage uri={…} />` — the rest of the flip / 3D
 * machinery doesn't care what's inside the back face.
 */
import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import type { BackVariant } from "@/shared/cardBacks";

interface CardBackArtProps {
  variant: BackVariant;
  /** Pixel size for layout. The SVG scales to fill via `viewBox`. */
  width: number | string;
  height: number | string;
  /** Outer corner radius — keep in sync with the card front. */
  radius?: number;
}

export function CardBackArt({
  variant,
  width,
  height,
  radius = 18,
}: CardBackArtProps) {
  const theme = THEMES[variant] ?? THEMES.unknown;

  return (
    <View
      style={{
        width: width as number,
        height: height as number,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id={`bg-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.bgTop} />
            <Stop offset="100%" stopColor={theme.bgBottom} />
          </LinearGradient>
        </Defs>

        {/* Field */}
        <Rect x={0} y={0} width={100} height={140} fill={`url(#bg-${variant})`} />

        {/* Inner bevel (thin, double-stroke) — mimics the printed
            border every card back has. */}
        <Rect
          x={5}
          y={5}
          width={90}
          height={130}
          rx={6}
          ry={6}
          fill="none"
          stroke={theme.bevel}
          strokeWidth={0.8}
          opacity={0.85}
        />
        <Rect
          x={7.5}
          y={7.5}
          width={85}
          height={125}
          rx={4}
          ry={4}
          fill="none"
          stroke={theme.bevel}
          strokeWidth={0.4}
          opacity={0.5}
        />

        {/* Per-variant motif, centered */}
        <G transform="translate(50 70)">{renderMotif(variant, theme)}</G>

        {/* Footer wordmark — tiny, uppercase, so the placeholder reads
            as intentional chrome and not a missing asset. */}
        <SvgText
          x={50}
          y={130}
          fontSize={4}
          fontWeight="700"
          letterSpacing={0.6}
          fill={theme.bevel}
          textAnchor="middle"
          opacity={0.8}
        >
          {theme.wordmark}
        </SvgText>
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Per-variant motif renderers. Composed as pure SVG so they tilt with
// the parent 3D layer for free.
// ---------------------------------------------------------------------------

function renderMotif(variant: BackVariant, t: Theme) {
  switch (variant) {
    case "pokemon_en_modern":
    case "pokemon_en_wotc":
    case "pokemon_jp_modern":
    case "pokemon_jp_classic":
      // Two-tone ringed orb. Not a Pokéball — we use a single seam and
      // an off-center highlight so it reads as "spherical motif" rather
      // than reproducing the protected design.
      return (
        <>
          <Circle r={26} fill={t.accent} />
          <Circle r={26} fill="none" stroke={t.bevel} strokeWidth={1.2} />
          <Path
            d="M -26 0 L 26 0"
            stroke={t.bevel}
            strokeWidth={1.2}
            opacity={0.9}
          />
          <Circle cx={-9} cy={-9} r={3.5} fill={t.shine} opacity={0.55} />
        </>
      );
    case "mtg_standard":
    case "mtg_dfc_helper":
      // Centered diamond stamp + faint "M" wordmark feel via the bevel.
      return (
        <>
          <G transform="rotate(45)">
            <Rect
              x={-18}
              y={-18}
              width={36}
              height={36}
              fill={t.accent}
              stroke={t.bevel}
              strokeWidth={1.2}
            />
          </G>
          <Circle r={9} fill={t.shine} opacity={0.18} />
        </>
      );
    case "ygo_en":
    case "ygo_jp":
      // Diamond-grille hint — three nested rotated squares. Reads as
      // "occult vibe" without copying the eye-of-Anubis.
      return (
        <G transform="rotate(45)">
          <Rect x={-22} y={-22} width={44} height={44} fill={t.accent} />
          <Rect
            x={-15}
            y={-15}
            width={30}
            height={30}
            fill="none"
            stroke={t.bevel}
            strokeWidth={1}
          />
          <Rect
            x={-8}
            y={-8}
            width={16}
            height={16}
            fill={t.shine}
            opacity={0.35}
          />
        </G>
      );
    case "lorcana_en":
      // Script "L" monogram inside a soft halo.
      return (
        <>
          <Circle r={24} fill={t.accent} />
          <SvgText
            x={0}
            y={9}
            fontSize={32}
            fontWeight="800"
            fontStyle="italic"
            fill={t.shine}
            textAnchor="middle"
          >
            L
          </SvgText>
        </>
      );
    case "onepiece_en":
      // Stylised "OP" stamp inside a circle — reads as the franchise
      // shorthand without using the Jolly Roger.
      return (
        <>
          <Circle r={24} fill={t.accent} />
          <SvgText
            x={0}
            y={6}
            fontSize={16}
            fontWeight="900"
            letterSpacing={-1}
            fill={t.shine}
            textAnchor="middle"
          >
            OP
          </SvgText>
        </>
      );
    case "unknown":
    default:
      return (
        <>
          <Circle r={20} fill={t.accent} opacity={0.4} />
          <SvgText
            x={0}
            y={9}
            fontSize={26}
            fontWeight="800"
            fill={t.shine}
            textAnchor="middle"
          >
            ?
          </SvgText>
        </>
      );
  }
}

// ---------------------------------------------------------------------------
// Theme palette per variant. Lifted from each TCG's brand palette but
// shifted enough to read as "inspired by" not "ripped from".
// ---------------------------------------------------------------------------

interface Theme {
  bgTop: string;
  bgBottom: string;
  accent: string;
  bevel: string;
  shine: string;
  wordmark: string;
}

const THEMES: Record<BackVariant, Theme> = {
  pokemon_en_modern: {
    bgTop: "#1F6F8B",
    bgBottom: "#0E3A4A",
    accent: "#E94F4F",
    bevel: "#F2E9C3",
    shine: "#FFFFFF",
    wordmark: "POKÉMON · EN",
  },
  pokemon_en_wotc: {
    bgTop: "#1A5F78",
    bgBottom: "#0A2F3D",
    accent: "#D74545",
    bevel: "#EBD89A",
    shine: "#FFFFFF",
    wordmark: "POKÉMON · WOTC",
  },
  pokemon_jp_modern: {
    bgTop: "#23607F",
    bgBottom: "#0F354A",
    accent: "#E94F4F",
    bevel: "#F2E9C3",
    shine: "#FFFFFF",
    wordmark: "ポケモン · JP",
  },
  pokemon_jp_classic: {
    bgTop: "#9A5A2C",
    bgBottom: "#5A2F12",
    accent: "#D7B36A",
    bevel: "#F1D9A8",
    shine: "#FFFFFF",
    wordmark: "ポケモン · 旧",
  },
  mtg_standard: {
    bgTop: "#7A4A26",
    bgBottom: "#3F2510",
    accent: "#D9B57A",
    bevel: "#1F1208",
    shine: "#FFE8B8",
    wordmark: "MAGIC",
  },
  mtg_dfc_helper: {
    bgTop: "#5A3D26",
    bgBottom: "#2A1908",
    accent: "#B58A52",
    bevel: "#1F1208",
    shine: "#FFE8B8",
    wordmark: "DOUBLE-FACED",
  },
  ygo_en: {
    bgTop: "#6B4226",
    bgBottom: "#33180A",
    accent: "#C89A52",
    bevel: "#1A0E04",
    shine: "#F2D898",
    wordmark: "YU-GI-OH! · EN",
  },
  ygo_jp: {
    bgTop: "#6B4226",
    bgBottom: "#33180A",
    accent: "#C89A52",
    bevel: "#1A0E04",
    shine: "#F2D898",
    wordmark: "遊戯王 · JP",
  },
  lorcana_en: {
    bgTop: "#2E2360",
    bgBottom: "#100A2E",
    accent: "#7C5BD8",
    bevel: "#F2E9C3",
    shine: "#FFE7A8",
    wordmark: "LORCANA",
  },
  onepiece_en: {
    bgTop: "#D8C39A",
    bgBottom: "#9A8156",
    accent: "#5C2F1A",
    bevel: "#2E180A",
    shine: "#F5E6C0",
    wordmark: "ONE PIECE",
  },
  unknown: {
    bgTop: "#1F2227",
    bgBottom: "#0B0D10",
    accent: "#3A3F47",
    bevel: "#5A6068",
    shine: "#A2A8B0",
    wordmark: "BACK",
  },
};
