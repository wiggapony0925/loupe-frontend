/**
 * Card-detail "context" strips — three opt-in panels that surface
 * adjacent data the user can act on without extra fetches:
 *
 *   1. `CardActiveAlerts` — pending price alerts the signed-in user
 *      has set on this exact card. Each chip has a delete affordance.
 *
 *   2. `SetProgressForCard` — completion progress for the card's set,
 *      rendered as a single inline strip with logo, percent, and a few
 *      thumbnails of the user's still-missing cards from the set.
 *
 *   3. `RelatedCardsRail` — a horizontal carousel of cards that share
 *      this card's name root (e.g. all "Charizard" prints) so the user
 *      can hop between alternate sets/years.
 *
 * Each component returns `null` when its data isn't available so the
 * parent screen can mount all three unconditionally.
 */
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Bell, X } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { CardImage } from "@/presentation/components/CardImage";
import { CardHorizontalRail } from "@/presentation/cards";
import { useAuth } from "@/presentation/providers/AuthProvider";
import {
  useDeletePriceAlert,
  usePriceAlerts,
} from "@/application/queries/alerts/usePriceAlerts";
import { useSetProgress } from "@/application/queries/catalog/useSetProgress";
import { useCardSearch } from "@/application/queries/catalog/useCardSearch";
import { routes } from "@/shared/routes";
import type {
  CardSearchResult,
  PriceAlertWire,
  TcgKey,
} from "@/infrastructure/http";

/* ── 1. Active alerts for this card ──────────────────────────────── */

export function CardActiveAlerts({ cardId }: { cardId: string }) {
  const { isAuthenticated } = useAuth();
  const p = useThemedPalette();
  const alertsQ = usePriceAlerts({ pending: true });
  const del = useDeletePriceAlert();

  const mine: PriceAlertWire[] = useMemo(
    () => (alertsQ.data ?? []).filter((a) => a.card_id === cardId),
    [alertsQ.data, cardId],
  );

  if (!isAuthenticated) return null;
  if (mine.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Your Alerts
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {mine.map((a) => {
          const threshold = Number(a.threshold_usd);
          const isAbove = a.condition === "above";
          return (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingLeft: 10,
                paddingRight: 4,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(p.accent.amber, 0.35),
                backgroundColor: withAlpha(p.accent.amber, 0.1),
              }}
            >
              <Bell size={11} color={p.accent.amber} />
              <Text
                style={{
                  color: p.accent.amber,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {isAbove ? "≥" : "≤"} $
                {threshold.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Pressable
                onPress={() => del.mutate(a.id)}
                hitSlop={8}
                accessibilityLabel="Delete alert"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(p.accent.amber, 0.18),
                }}
              >
                <X size={10} color={p.accent.amber} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ── 2. Set-completion progress for this card's set ──────────────── */

export function SetProgressForCard({
  setId,
}: {
  setId: string | null | undefined;
}) {
  const { isAuthenticated } = useAuth();
  const p = useThemedPalette();
  const progressQ = useSetProgress();

  if (!isAuthenticated || !setId) return null;
  const row = (progressQ.data ?? []).find((r) => r.setId === setId);
  if (!row) return null;

  const pct = Math.max(0, Math.min(100, row.percent));
  const tone = pct >= 75 ? p.accent.mint : pct >= 25 ? p.accent.amber : p.accent.rose;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 9,
              letterSpacing: 1.4,
              fontWeight: "700",
            }}
          >
            SET PROGRESS
          </Text>
          <Text
            style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}
            numberOfLines={1}
          >
            {row.setName}
          </Text>
        </View>
        <Text style={{ color: tone, fontSize: 18, fontWeight: "800" }}>
          {pct.toFixed(0)}%
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 999,
          backgroundColor: withAlpha(p.ink.muted, 0.18),
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: tone,
          }}
        />
      </View>
      <Text style={{ color: p.ink.muted, fontSize: 11 }}>
        {row.owned} of {row.total} owned
      </Text>
      {row.missingTop.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 9,
              letterSpacing: 1.4,
              fontWeight: "700",
            }}
          >
            STILL MISSING
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {row.missingTop.slice(0, 5).map((m) => (
              <Pressable
                key={m.cardId}
                onPress={() => router.push(routes.card(m.cardId))}
                accessibilityRole="button"
                accessibilityLabel={`Open ${m.name}`}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <CardImage
                  uri={m.imageUrl}
                  width={48}
                  height={68}
                  rounded={6}
                  contentFit="contain"
                  alt={m.name}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── 3. Related cards rail (other prints of this name) ───────────── */

export function RelatedCardsRail({
  cardId,
  cardName,
  tcg,
}: {
  cardId: string;
  cardName: string | null | undefined;
  tcg: TcgKey | string | null | undefined;
}) {
  const p = useThemedPalette();

  // Use the first 2-3 tokens of the card name for a tight match.
  // "Charizard ex" → "Charizard ex", "Pikachu Illustrator" → "Pikachu Illustrator".
  // Strip parenthetical variants and trailing card numbers.
  const q = useMemo(() => {
    if (!cardName) return "";
    const cleaned = cardName.replace(/\(.*?\)/g, "").trim();
    const tokens = cleaned.split(/\s+/).slice(0, 2);
    return tokens.join(" ");
  }, [cardName]);

  const safeTcg: TcgKey | "all" =
    tcg === "pokemon" || tcg === "magic" || tcg === "yugioh"
      ? (tcg as TcgKey)
      : "all";

  const searchQ = useCardSearch({
    q,
    tcg: safeTcg,
    limit: 12,
    enabled: q.length >= 2,
  });

  const results: CardSearchResult[] = useMemo(
    () => (searchQ.data?.results ?? []).filter((r) => r.id !== cardId).slice(0, 10),
    [searchQ.data, cardId],
  );

  if (!q || results.length === 0) {
    if (searchQ.isLoading) {
      return (
        <View style={{ height: 130, justifyContent: "center" }}>
          <ActivityIndicator color={p.ink.dim} />
        </View>
      );
    }
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Other Prints
      </Text>
      <CardHorizontalRail
        cards={results}
        tileSize="sm"
        showSet
        gap={10}
        edgeBleed={20}
        onCardPress={(item) => router.push(routes.card(item.id))}
      />
    </View>
  );
}
