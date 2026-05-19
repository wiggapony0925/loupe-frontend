import React from "react";
import { Text } from "react-native";
import { Box } from "@/components/ui/box";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type Tone = "mint" | "blue" | "amber" | "rose" | "neutral";

interface BadgeProps {
  label: string;
  tone?: Tone;
}

/**
 * Loupe brand-tinted pill. Tones are derived from the live palette so they
 * remain legible in both Light and Dark modes (10% fill, 35% border in dark;
 * 8% fill, 28% border in light to compensate for the brighter background).
 */
export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const p = useThemedPalette();
  const accentForTone: Record<Exclude<Tone, "neutral">, string> = {
    mint: p.accent.mint,
    blue: p.accent.blue,
    amber: p.accent.amber,
    rose: p.accent.rose,
  };

  let fg: string;
  let bg: string;
  let border: string;
  if (tone === "neutral") {
    fg = p.ink.muted;
    bg = withAlpha(p.ink.dim, 0.08);
    border = p.line.default;
  } else {
    const c = accentForTone[tone];
    fg = c;
    bg = withAlpha(c, 0.1);
    border = withAlpha(c, 0.32);
  }

  return (
    <Box
      className="self-start rounded-md px-2 py-1"
      style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.5px]"
        style={{ color: fg }}
      >
        {label}
      </Text>
    </Box>
  );
}
