/**
 * Panel — the canonical themed surface wrapper.
 *
 * Every boxed section on a detail screen (price block, comps, attributes,
 * notes) sits on the same elevated surface with the same border + radius.
 * Centralizing it here means a tweak to the surface treatment propagates
 * everywhere instead of being re-typed inline in a dozen sections.
 *
 * Tone controls the background layer:
 *   - "elevated" (default): cards floating above the page.
 *   - "sunken": insets / wells (e.g. a chart trough).
 *   - "plain": transparent — border-only grouping.
 */

import React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";
import { radius as radii, spacing } from "@/presentation/theme/tokens";

type PanelTone = "elevated" | "sunken" | "plain";
type PanelPadding = keyof typeof spacing | "none";

interface PanelProps extends ViewProps {
  tone?: PanelTone;
  /** Inner padding from the spacing scale, or "none". Default: "lg" (16). */
  padding?: PanelPadding;
  /** Border radius from the radius scale. Default: "lg" (14). */
  rounded?: keyof typeof radii;
  /** Hide the 1px border (e.g. when nested inside another Panel). */
  borderless?: boolean;
  style?: ViewStyle | ViewStyle[];
}

const TONE_CLASS: Record<PanelTone, string> = {
  elevated: "bg-bg-elevated",
  sunken: "bg-bg-sunken",
  plain: "",
};

export function Panel({
  tone = "elevated",
  padding = "lg",
  rounded = "lg",
  borderless = false,
  className,
  style,
  children,
  ...rest
}: PanelProps) {
  const pad = padding === "none" ? 0 : spacing[padding];
  return (
    <View
      className={[TONE_CLASS[tone], borderless ? "" : "border border-line", className]
        .filter(Boolean)
        .join(" ")}
      style={[{ borderRadius: radii[rounded], padding: pad }, style as ViewStyle]}
      {...rest}
    >
      {children}
    </View>
  );
}
