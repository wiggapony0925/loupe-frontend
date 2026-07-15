/**
 * AiModePanel — the search tab's AI MODE content (Notion-style).
 *
 * The user enters AI mode from the search bar (typing "/" or tapping the
 * sparkle toggle plants a "Loupe AI" pill in the bar); this panel is then the
 * whole results area:
 *
 *   • idle    — a hero prompt with example descriptions + an Ask button,
 *   • asking  — a thinking card,
 *   • answer  — the chat bubble: avatar, the model's explanation, tappable
 *               "Could be:" name chips, the REAL catalog cards, and a footer
 *               with Try again + the honesty line.
 *
 * The active game tag (Pokémon / Magic / …) rides to the backend as the
 * user's preference — "they're most likely describing a Pokémon card". The
 * parent owns `asked` (submitting the search bar asks), so the model is only
 * ever called on an explicit action. A 402 opens the paywall.
 */
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowRight, Lock, MoonStar, RotateCcw, Sparkles } from "lucide-react-native";
import {
  useAiSearch,
  useAiSearchLimits,
} from "@/application/queries/catalog/useAiSearch";
import { ApiError } from "@/infrastructure/http/client";
import { SearchResultRow } from "@/presentation/features/search/SearchResultRow";
import { useProFeature } from "@/presentation/features/pro";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const GAME_LABELS: Record<string, string> = {
  pokemon: "Pokémon",
  magic: "Magic",
  yugioh: "Yu-Gi-Oh!",
  onepiece: "One Piece",
  digimon: "Digimon",
};

export function AiModePanel({
  query,
  game,
  asked,
  onAsk,
  onPickCandidate,
}: {
  query: string;
  /** The active game tag — sent as the description's game preference. */
  game?: string;
  /** Parent-owned: true once the user submitted the description. */
  asked: boolean;
  onAsk: () => void;
  /** Tap a candidate chip → run a normal search for that exact name. */
  onPickCandidate?: (name: string) => void;
}) {
  const p = useThemedPalette();
  const { allowed, locked, requirePro } = useProFeature("ai_search");
  const { queryMaxChars, enabled: serviceUp } = useAiSearchLimits();
  const ai = useAiSearch(query, asked && allowed && serviceUp, game);

  // Server-side gate is the source of truth — a 402 opens the paywall even
  // if the local entitlement snapshot was stale.
  useEffect(() => {
    if (ai.error instanceof ApiError && ai.error.status === 402) {
      requirePro("ai_search");
    }
  }, [ai.error, requirePro]);

  const gameLabel = game && game !== "all" ? GAME_LABELS[game] : undefined;
  const ready = query.trim().length >= 3;
  const answer = asked && allowed ? ai.data : undefined;
  const showBubble = Boolean(answer?.message && (answer?.results.length ?? 0) > 0);
  // Model down/unconfigured → the backend answered with plain name matches
  // (source:"fallback", no message): still show the cards, honestly labeled.
  const fallbackResults =
    answer && !answer.message && answer.results.length > 0
      ? answer.results
      : null;
  const unreachable =
    ai.isError && !(ai.error instanceof ApiError && ai.error.status === 402);

  // ── Loupe AI is resting (quota / provider outage — backend says so) ──
  if (!serviceUp) {
    return (
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 26 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.1),
          }}
        >
          <MoonStar size={20} color={p.accent.mint} />
        </View>
        <Text style={{ color: p.ink.default, fontSize: 16, fontWeight: "700" }}>
          Loupe AI is taking a quick break
        </Text>
        <Text
          style={{
            color: p.ink.muted,
            fontSize: 12,
            textAlign: "center",
            maxWidth: 280,
            lineHeight: 18,
          }}
        >
          It'll be back shortly — name search works as always in the meantime.
        </Text>
      </View>
    );
  }

  // ── Locked — the feature sells itself (free accounts) ──
  if (locked) {
    return (
      <View style={{ gap: 14, paddingTop: 8 }}>
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 18 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(p.accent.mint, 0.14),
            }}
          >
            <Sparkles size={20} color={p.accent.mint} />
          </View>
          <Text
            style={{
              color: p.ink.default,
              fontSize: 18,
              fontWeight: "700",
              letterSpacing: -0.3,
            }}
          >
            Describe the card. Loupe finds it.
          </Text>
          <Text
            style={{
              color: p.ink.muted,
              fontSize: 12,
              textAlign: "center",
              lineHeight: 18,
              maxWidth: 280,
            }}
          >
            “red lizard with fire on its tail” → Charizard. AI search is part
            of Loupe Pro.
          </Text>
        </View>
        <Pressable
          onPress={() => requirePro("ai_search")}
          accessibilityRole="button"
          accessibilityLabel="Unlock AI search with Loupe Pro"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 13,
            borderRadius: 14,
            backgroundColor: withAlpha(p.accent.mint, pressed ? 0.9 : 1),
          })}
        >
          <Lock size={14} color="#04150c" />
          <Text style={{ color: "#04150c", fontSize: 14, fontWeight: "800" }}>
            Unlock with Loupe Pro
          </Text>
        </Pressable>
        <Text style={{ color: p.ink.dim, fontSize: 10, textAlign: "center" }}>
          Unlimited cards, alerts, statements — and Loupe AI.
        </Text>
      </View>
    );
  }

  // ── Idle — the hero ask state ──
  if (!asked || !allowed) {
    return (
      <View style={{ gap: 14, paddingTop: 8 }}>
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 18 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(p.accent.mint, 0.14),
            }}
          >
            <Sparkles size={20} color={p.accent.mint} />
          </View>
          <Text
            style={{
              color: p.ink.default,
              fontSize: 18,
              fontWeight: "700",
              letterSpacing: -0.3,
            }}
          >
            Describe the card. Loupe finds it.
          </Text>
          <Text
            style={{
              color: p.ink.muted,
              fontSize: 12,
              textAlign: "center",
              lineHeight: 18,
              maxWidth: 280,
            }}
          >
            “red lizard with fire on its tail” · “blue turtle with water
            cannons” · “the crying ghost from the first set”
          </Text>
          {gameLabel ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: withAlpha(p.accent.mint, 0.1),
              }}
            >
              <Sparkles size={10} color={p.accent.mint} />
              <Text
                style={{ color: p.accent.mint, fontSize: 10, fontWeight: "800" }}
              >
                Tuned to {gameLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={onAsk}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel="Ask Loupe AI"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 13,
            borderRadius: 14,
            backgroundColor: ready
              ? withAlpha(p.accent.mint, pressed ? 0.9 : 1)
              : withAlpha(p.accent.mint, 0.18),
          })}
        >
          <Text
            style={{
              color: ready ? "#04150c" : p.accent.mint,
              fontSize: 14,
              fontWeight: "800",
            }}
          >
            {ready ? "Ask Loupe AI" : "Type a description above"}
          </Text>
          {ready ? <ArrowRight size={16} color="#04150c" /> : null}
        </Pressable>
        <Text style={{ color: p.ink.dim, fontSize: 10, textAlign: "center" }}>
          {query.length}/{queryMaxChars} · Loupe Pro
        </Text>
      </View>
    );
  }

  // ── Thinking ──
  if (ai.isLoading) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, 0.3),
          backgroundColor: withAlpha(p.accent.mint, 0.06),
        }}
      >
        <ActivityIndicator size="small" color={p.accent.mint} />
        <Text style={{ flex: 1, color: p.ink.muted, fontSize: 12, fontWeight: "600" }}>
          Loupe AI is thinking about “{query.trim()}”…
        </Text>
      </View>
    );
  }

  // ── Loupe AI unreachable (network / an app newer than the backend) ──
  if (unreachable) {
    return (
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}>
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
          Loupe AI is unreachable right now
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, textAlign: "center" }}>
          Check your connection and try again in a moment.
        </Text>
        <Pressable onPress={() => void ai.refetch()} hitSlop={8}>
          <Text style={{ color: p.accent.mint, fontSize: 12, fontWeight: "800" }}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Model unavailable → honest plain matches (source: "fallback") ──
  if (fallbackResults) {
    return (
      <View style={{ gap: 10 }}>
        <Text style={{ color: p.ink.muted, fontSize: 12 }}>
          Loupe AI is resting — here are the closest name matches instead.
        </Text>
        <View>
          {fallbackResults.slice(0, 8).map((card, i) => (
            <SearchResultRow key={card.id} card={card} bordered={i > 0} />
          ))}
        </View>
      </View>
    );
  }

  // ── No usable answer ──
  if (!showBubble || !answer) {
    return (
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}>
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
          Couldn't pin that one down
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, textAlign: "center" }}>
          Add a couple more details — colours, creatures, attacks — and ask
          again.
        </Text>
        <Pressable onPress={() => void ai.refetch()} hitSlop={8}>
          <Text style={{ color: p.accent.mint, fontSize: 12, fontWeight: "800" }}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── The answer ──
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(p.accent.mint, 0.3),
        backgroundColor: withAlpha(p.accent.mint, 0.05),
        padding: 14,
        gap: 10,
      }}
    >
      {/* The chatbot bubble */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.16),
          }}
        >
          <Sparkles size={15} color={p.accent.mint} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                color: p.accent.mint,
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 0.8,
              }}
            >
              LOUPE AI
            </Text>
            {gameLabel ? (
              <Text style={{ color: p.ink.dim, fontSize: 10, fontWeight: "700" }}>
                · tuned to {gameLabel}
              </Text>
            ) : null}
          </View>
          {/* Backend-clamped (MESSAGE_MAX_CHARS) — never an essay. */}
          <Text
            style={{
              color: p.ink.default,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "500",
            }}
          >
            {answer.message}
          </Text>
        </View>
      </View>

      {/* Its guesses, as tappable name chips */}
      {answer.candidates.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "700" }}>
            Could be:
          </Text>
          {answer.candidates.map((name) => (
            <Pressable
              key={name}
              onPress={() => onPickCandidate?.(name)}
              disabled={!onPickCandidate}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${name}`}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(p.accent.mint, 0.4),
                backgroundColor: withAlpha(p.accent.mint, pressed ? 0.16 : 0.08),
              })}
            >
              <Text
                style={{ color: p.accent.mint, fontSize: 11, fontWeight: "800" }}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* The real cards it found */}
      <View>
        {answer.results.slice(0, 8).map((card, i) => (
          <SearchResultRow key={card.id} card={card} bordered={i > 0} />
        ))}
      </View>
      {answer.results.length > 8 ? (
        <Text style={{ color: p.ink.dim, fontSize: 11 }}>
          Showing 8 of {answer.results.length} — tap a name above to see every
          printing.
        </Text>
      ) : null}

      {/* Footer: honesty line + retry (the Notion AI pattern) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: withAlpha(p.accent.mint, 0.15),
        }}
      >
        <Text style={{ flex: 1, color: p.ink.dim, fontSize: 10 }}>
          AI can misread a description — cards and prices always come from the
          live catalog.
        </Text>
        <Pressable
          onPress={() => void ai.refetch()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ask Loupe AI again"
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <RotateCcw size={11} color={p.accent.mint} />
          <Text style={{ color: p.accent.mint, fontSize: 11, fontWeight: "800" }}>
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
