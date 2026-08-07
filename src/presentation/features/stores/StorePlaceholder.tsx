/**
 * StorePlaceholder — what a shop looks like when it publishes no photo.
 *
 * Not a colour block. A drawn surface: a hairline diagonal lattice with
 * card-corner motifs (the diamond/pip vocabulary of the thing these shops
 * actually sell), rendered in SCREEN-NEUTRAL theme ink at low opacity, so
 * it reads as designed stationery rather than a failed image. The shop's
 * NAME is the subject — the reason you're looking at the tile at all.
 *
 * All geometry is SVG, so it stays crisp at any tile size and costs no
 * image bandwidth.
 */
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Rect,
} from "react-native-svg";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** A stable pip motif per shop so two tiles never look identical. */
function motifFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 3;
}

export function StorePlaceholder({
  name,
  size = "card",
}: {
  name: string;
  /** `card` = drawer tile, `hero` = the store page's full-width header. */
  size?: "card" | "hero";
}) {
  const p = useThemedPalette();
  const motif = useMemo(() => motifFor(name), [name]);
  const hero = size === "hero";

  // Ink-on-surface, never a saturated wash: the pattern is the app's own
  // line colour at a whisper, so it belongs to every theme.
  const lattice = withAlpha(p.ink.default, 0.07);
  const pip = withAlpha(p.ink.default, 0.1);

  return (
    <View style={[styles.wrap, { backgroundColor: p.bg.sunken }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Diagonal lattice — the texture of a card sleeve. */}
          <Pattern
            id="lattice"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <Line x1="0" y1="22" x2="22" y2="0" stroke={lattice} strokeWidth="1" />
            <Line x1="-6" y1="6" x2="6" y2="-6" stroke={lattice} strokeWidth="1" />
            <Line x1="16" y1="28" x2="28" y2="16" stroke={lattice} strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#lattice)" />

        {/* Card-corner pips, placed like the marks on a playing card. */}
        <G opacity={0.9}>
          {motif === 0 ? (
            <>
              <Path d="M22 26 l7 -9 7 9 -7 9 z" fill={pip} />
              <Path d="M-6 -6 m0 0" fill="none" />
            </>
          ) : motif === 1 ? (
            <Path
              d="M29 16 a7 7 0 0 1 12 7 l-12 13 -12 -13 a7 7 0 0 1 12 -7 z"
              fill={pip}
            />
          ) : (
            <Path d="M29 15 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 z" fill={pip} />
          )}
        </G>
      </Svg>

      <View style={styles.center}>
        <Text
          numberOfLines={hero ? 3 : 2}
          style={[
            hero ? styles.heroName : styles.cardName,
            { color: p.ink.default },
          ]}
        >
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  cardName: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  heroName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
});
