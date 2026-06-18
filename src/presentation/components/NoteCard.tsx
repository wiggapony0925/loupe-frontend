/**
 * NoteCard — the one reusable inline note / empty-state card.
 *
 * Replaces the family of bespoke "no data" boxes that had drifted across
 * the card-detail screen (e.g. "No active seller rows", "No recent comps",
 * "No verified graded comps yet", "No live listings yet"). Each used to
 * re-implement the same accent-bar + icon-chip + headline + body layout
 * with slightly different spacing.
 *
 * A NoteCard is:
 *   - accent-tinted by `variant` (info / warn / error / success / muted),
 *   - led by an optional icon chip,
 *   - a headline + optional body,
 *   - an optional footer pill (a short status tag), and
 *   - optional action buttons (e.g. provider deep-links).
 *
 * Everything is theme-token driven via `useThemedPalette` so it tracks
 * Light/Dark instantly.
 */

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Info, type LucideIcon } from "lucide-react-native";
import { radius, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export type NoteVariant = "info" | "warn" | "error" | "success" | "muted";

export interface NoteAction {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
}

interface NoteCardProps {
  title: string;
  body?: string;
  variant?: NoteVariant;
  icon?: LucideIcon;
  /** Short uppercase status tag rendered as a pill under the body. */
  footerTag?: string;
  footerIcon?: LucideIcon;
  actions?: NoteAction[];
}

export function NoteCard({
  title,
  body,
  variant = "info",
  icon: Icon,
  footerTag,
  footerIcon: FooterIcon,
  actions,
}: NoteCardProps) {
  const p = useThemedPalette();
  const accent = accentFor(variant, p);
  const ResolvedIcon = Icon ?? Info;

  return (
    <View
      accessibilityRole="summary"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: withAlpha(accent, 0.18),
        backgroundColor: withAlpha(accent, 0.04),
        overflow: "hidden",
      }}
    >
      {/* Accent top bar — the shared visual signature of a note. */}
      <View style={{ height: 3, backgroundColor: withAlpha(accent, 0.5) }} />

      <View style={{ flexDirection: "row", gap: 12, padding: 14, alignItems: "flex-start" }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.md,
            backgroundColor: withAlpha(accent, 0.12),
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          <ResolvedIcon size={16} color={accent} strokeWidth={2.25} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{ color: p.ink.default, fontSize: 13, fontWeight: "800", letterSpacing: -0.1 }}
          >
            {title}
          </Text>
          {body ? (
            <Text style={{ color: p.ink.muted, fontSize: 11, lineHeight: 17 }}>{body}</Text>
          ) : null}

          {footerTag ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginTop: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: radius.sm,
                alignSelf: "flex-start",
                backgroundColor: withAlpha(accent, 0.1),
              }}
            >
              {FooterIcon ? <FooterIcon size={9} color={accent} strokeWidth={2.5} /> : null}
              <Text
                style={{
                  color: accent,
                  fontSize: 9,
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {footerTag}
              </Text>
            </View>
          ) : null}

          {actions && actions.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {actions.map((a) => {
                const ActionIcon = a.icon;
                return (
                  <Pressable
                    key={a.label}
                    onPress={a.onPress}
                    hitSlop={6}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: withAlpha(accent, 0.15),
                      borderWidth: 1,
                      borderColor: withAlpha(accent, 0.4),
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    {ActionIcon ? <ActionIcon size={12} color={accent} strokeWidth={2.5} /> : null}
                    <Text style={{ color: accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function accentFor(variant: NoteVariant, p: ReturnType<typeof useThemedPalette>): string {
  switch (variant) {
    case "error":
      return p.accent.rose;
    case "warn":
      return p.accent.amber;
    case "success":
      return p.accent.mint;
    case "muted":
      return p.ink.dim;
    case "info":
    default:
      return p.accent.blue;
  }
}
