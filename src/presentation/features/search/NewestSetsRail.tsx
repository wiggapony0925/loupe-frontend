/**
 * NewestSetsRail — horizontal discovery carousel of the newest set releases
 * across the date-backed games (Pokémon · Magic · Yu-Gi-Oh!). The feed is
 * backend-defined (`/v1/sets?tcg=all&sort=newest` via `useNewestSets`), so
 * both clients rank releases identically. Mirrors the SealedRail tile rhythm;
 * tapping any tile opens the Sets explorer (`/sets`).
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CardImage } from "@/presentation/components/CardImage";
import { routes } from "@/shared/routes";
import { useThemedPalette } from "@/presentation/theme/tokens";
import type { CardSetSummary } from "@/infrastructure/http";

const TILE_W = 148;
const LOGO_H = 84;

/** "2024/11/08" or "2024-11-08" → "Nov 2024" (release month + year). */
function releaseLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  const [y, m] = raw.replace(/\//g, "-").split("-").map(Number);
  if (!y) return null;
  if (!m || m < 1 || m > 12) return String(y);
  const month = new Date(Date.UTC(y, m - 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${month} ${y}`;
}

export function NewestSetsRail({ sets }: { sets: CardSetSummary[] }) {
  const p = useThemedPalette();
  if (sets.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 14 }}
    >
      {sets.map((s) => {
        const meta = [
          releaseLabel(s.release_date),
          s.total_cards ? `${s.total_cards} cards` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Pressable
            key={s.id}
            onPress={() => router.push(routes.sets())}
            style={({ pressed }) => ({
              width: TILE_W,
              overflow: "hidden",
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={`${s.name ?? "Set"}. New release. Browse sets.`}
          >
            <View
              style={{
                width: TILE_W,
                height: LOGO_H,
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: p.line.default,
                backgroundColor: p.bg.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.image_url ? (
                <CardImage
                  uri={s.image_url}
                  width={TILE_W - 20}
                  height={LOGO_H - 20}
                  rounded={0}
                  contentFit="contain"
                  alt={s.name ?? "Set logo"}
                />
              ) : (
                // No logo from the provider (Yu-Gi-Oh!) — the set code reads
                // as branding; a broken-image glyph reads as a bug.
                <Text
                  style={{
                    color: p.ink.muted,
                    fontSize: 15,
                    fontWeight: "700",
                    letterSpacing: 1,
                  }}
                >
                  {(s.code ?? "SET").toUpperCase().slice(0, 8)}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{
                width: TILE_W,
                color: p.ink.default,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 6,
                lineHeight: 15,
              }}
            >
              {s.name ?? "Set"}
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ width: TILE_W, color: p.ink.dim, fontSize: 11, marginTop: 2 }}
            >
              {meta || "New release"}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
