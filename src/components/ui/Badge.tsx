import React from "react";
import { Text } from "react-native";
import { Box } from "@/components/ui/box";
import { palette } from "@/theme/tokens";

type Tone = "mint" | "blue" | "amber" | "rose" | "neutral";

interface BadgeProps {
  label: string;
  tone?: Tone;
}

const TONES: Record<Tone, { fg: string; bg: string; border: string }> = {
  mint: {
    fg: palette.accent.mint,
    bg: "rgba(0,245,155,0.10)",
    border: "rgba(0,245,155,0.35)",
  },
  blue: {
    fg: palette.accent.blue,
    bg: "rgba(10,132,255,0.10)",
    border: "rgba(10,132,255,0.35)",
  },
  amber: {
    fg: palette.accent.amber,
    bg: "rgba(255,176,32,0.10)",
    border: "rgba(255,176,32,0.35)",
  },
  rose: {
    fg: palette.accent.rose,
    bg: "rgba(255,69,58,0.10)",
    border: "rgba(255,69,58,0.35)",
  },
  neutral: {
    fg: palette.ink.muted,
    bg: "rgba(255,255,255,0.04)",
    border: palette.line.default,
  },
};

/**
 * Loupe brand-tinted pill. Composed on gluestack `Box` so it inherits
 * cssInterop + variant context, but keeps the project's custom tone palette
 * (gluestack's default `error/warning/success/info/muted` set is too coarse).
 */
export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const t = TONES[tone];
  return (
    <Box
      className="self-start rounded-md px-2 py-1"
      style={{
        backgroundColor: t.bg,
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.5px]"
        style={{ color: t.fg }}
      >
        {label}
      </Text>
    </Box>
  );
}
