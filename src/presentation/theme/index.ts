/**
 * `@/presentation/theme` — single entry point for design tokens, the
 * theme provider/hook, and our Gluestack UI v3 primitive surface.
 *
 * Prefer importing from this barrel so feature code reads tidily:
 *
 *     import { useTheme, Box, HStack, Text, Button, palette } from "@/presentation/theme";
 *
 * That nudges callers toward (a) the reactive `useTheme()` hook, and
 * (b) the Gluestack primitives that already understand our token CSS
 * variables — rather than reaching for raw `react-native` `View`/`Text`
 * and re-inventing spacing rules per screen.
 */

// ── Tokens + helpers ────────────────────────────────────────────────
export {
  applyTheme,
  darkPalette,
  getActiveScheme,
  gradeColor,
  lightPalette,
  palette,
  radius,
  spacing,
  useThemedPalette,
  withAlpha,
} from "./tokens";
export type { Palette, Scheme } from "./tokens";

// ── Provider + reactive hook ────────────────────────────────────────
export { ThemeProvider, useTheme } from "./ThemeProvider";

// ── Gluestack UI v3 primitives (theme-aware out of the box) ─────────
//   These resolve to the same CSS-var-backed Tailwind tokens flipped
//   by ThemeProvider, so anything composed from them automatically
//   responds to light/dark switches without extra wiring.
export { Badge, BadgeIcon, BadgeText } from "@/components/ui/badge";
export { Box } from "@/components/ui/box";
export {
  Button,
  ButtonGroup,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@/components/ui/button";
export { Center } from "@/components/ui/center";
export { Divider } from "@/components/ui/divider";
export { Heading } from "@/components/ui/heading";
export { HStack } from "@/components/ui/hstack";
export { Pressable } from "@/components/ui/pressable";
export { Spinner } from "@/components/ui/spinner";
export { Text } from "@/components/ui/text";
export { VStack } from "@/components/ui/vstack";
