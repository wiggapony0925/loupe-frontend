/**
 * AiModePanel — the search tab's AI MODE content, styled as a conversation.
 *
 * The user enters AI mode from the search bar ("/" command or the sparkle
 * toggle); this panel then owns the results area:
 *
 *   • idle    — a hero + a SUGGESTION LIST of example descriptions (game-aware,
 *               one tap fills and asks),
 *   • asking  — the user's description as a sent chat bubble + Loupe AI's
 *               typing-dots bubble while the model works,
 *   • answer  — the reply TYPES OUT like a message; the candidate chips and
 *               real catalog cards reveal once it finishes, with the
 *               Try-again + honesty footer,
 *   • locked / resting / unreachable / miss — honest dedicated states.
 *
 * The active game tag rides to the backend as the description's preference.
 * The parent owns `asked` (explicit submit only — the model costs money).
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import {
  ArrowRight,
  Lock,
  MoonStar,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react-native";
import {
  useAiFeedback,
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

/** Tappable example descriptions, tuned to the active game tag. */
const SUGGESTIONS: Record<string, string[]> = {
  all: [
    "red lizard with fire on its tail",
    "white dragon with blue eyes",
    "a wizard that copies spells",
    "yellow mouse with red cheeks",
  ],
  pokemon: [
    "blue turtle with water cannons",
    "the crying ghost from the first set",
    "yellow mouse with red cheeks",
    "sleeping pink balloon that sings",
  ],
  magic: [
    "a wizard that copies spells",
    "angel with three pairs of wings",
    "a black lotus flower artifact",
    "goblin that throws dynamite",
  ],
  yugioh: [
    "white dragon with blue eyes",
    "dark wizard in purple armor",
    "a golden egyptian bird god",
    "a jar that destroys everything",
  ],
  onepiece: [
    "rubber pirate with a straw hat",
    "swordsman with three swords",
    "a cook who only kicks",
  ],
  digimon: [
    "orange dinosaur that breathes fire",
    "angel digimon with eight wings",
    "a small yellow reptile rookie",
  ],
};

/** Reveal text a few characters per tick — the "typing out" effect. */
function useTypewriter(text: string | null | undefined, cps = 3) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!text) return;
    const id = setInterval(() => {
      setCount((c) => (c >= text.length ? c : c + cps));
    }, 24);
    return () => clearInterval(id);
  }, [text, cps]);
  const shown = text ? text.slice(0, count) : "";
  return { shown, done: !text || count >= text.length };
}

/** Three staggered bouncing dots — the classic "is typing" indicator. */
function TypingDots({ color }: { color: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(280 - delay),
        ]),
      );
    const loops = [bounce(a, 0), bounce(b, 140), bounce(c, 280)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a, b, c]);
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingVertical: 6 }}>
      {[a, b, c].map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [
              {
                translateY: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function AiModePanel({
  query,
  game,
  asked,
  onAsk,
  onAnswered,
  onFeedbackSent,
  onPickSuggestion,
  onPickCandidate,
}: {
  query: string;
  /** The active game tag — sent as the description's game preference. */
  game?: string;
  /** Parent-owned: true once the user submitted the description. */
  asked: boolean;
  onAsk: () => void;
  /** Fires once when Loupe AI successfully answers (recents recording). */
  onAnswered?: (q: string) => void;
  /** Fires when the user taps a thumb — the host shows the thank-you banner. */
  onFeedbackSent?: () => void;
  /** Tap a suggested description → fill the search bar and ask. */
  onPickSuggestion?: (text: string) => void;
  /** Tap a candidate chip → run a normal search for that exact name. */
  onPickCandidate?: (name: string) => void;
}) {
  const p = useThemedPalette();
  const { locked, allowed, requirePro } = useProFeature("ai_search");
  const { queryMaxChars, enabled: serviceUp } = useAiSearchLimits();
  const ai = useAiSearch(query, asked && allowed && serviceUp, game);
  const feedback = useAiFeedback();
  const [verdict, setVerdict] = useState<"up" | "down" | null>(null);

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
  // Model resting mid-session → the backend answered with plain name matches.
  const fallbackResults =
    answer && !answer.message && answer.results.length > 0
      ? answer.results
      : null;
  const unreachable =
    ai.isError && !(ai.error instanceof ApiError && ai.error.status === 402);
  const typed = useTypewriter(showBubble ? answer?.message : null);

  // A successful AI answer earns a sparkle tag in recent searches.
  useEffect(() => {
    if (showBubble && answer?.source === "ai") onAnswered?.(query.trim());
  }, [showBubble, answer?.source, query, onAnswered]);

  // A new exchange gets fresh thumbs.
  useEffect(() => setVerdict(null), [answer?.askId]);

  const rate = (v: "up" | "down") => {
    if (!answer?.askId) return;
    setVerdict(v);
    feedback.mutate({ askId: answer.askId, verdict: v });
    onFeedbackSent?.();
  };

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
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 13,
            borderRadius: 14,
            backgroundColor: p.accent.mint,
          }}
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

  // ── Idle — hero + tappable suggestions ──
  if (!asked) {
    const suggestions = SUGGESTIONS[game && game !== "all" ? game : "all"] ?? [];
    return (
      <View style={{ gap: 12, paddingTop: 8 }}>
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 10 }}>
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

        {/* Suggested descriptions — one tap fills the bar and asks. */}
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.25),
            backgroundColor: withAlpha(p.accent.mint, 0.04),
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 10,
              fontWeight: "800",
              letterSpacing: 0.8,
              textTransform: "uppercase",
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 4,
            }}
          >
            Try asking
          </Text>
          {suggestions.map((text, i) => (
            <Pressable
              key={text}
              onPress={() => onPickSuggestion?.(text)}
              accessibilityRole="button"
              accessibilityLabel={`Ask Loupe AI: ${text}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: withAlpha(p.accent.mint, 0.12),
              }}
            >
              <Sparkles size={12} color={p.accent.mint} />
              <Text
                style={{
                  flex: 1,
                  color: p.ink.default,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                “{text}”
              </Text>
              <ArrowRight size={13} color={p.ink.dim} />
            </Pressable>
          ))}
        </View>

        {ready ? (
          <Pressable
            onPress={onAsk}
            accessibilityRole="button"
            accessibilityLabel="Ask Loupe AI"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 13,
              borderRadius: 14,
              backgroundColor: p.accent.mint,
            }}
          >
            <Text style={{ color: "#04150c", fontSize: 14, fontWeight: "800" }}>
              Ask Loupe AI
            </Text>
            <ArrowRight size={16} color="#04150c" />
          </Pressable>
        ) : null}
        <Text style={{ color: p.ink.dim, fontSize: 10, textAlign: "center" }}>
          {query.length}/{queryMaxChars} · Loupe Pro
        </Text>
      </View>
    );
  }

  // ── The conversation ──
  return (
    <View style={{ gap: 10 }}>
      {/* Your message — sent bubble, right-aligned. */}
      <View style={{ alignItems: "flex-end" }}>
        <View
          style={{
            maxWidth: "85%",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 18,
            borderBottomRightRadius: 6,
            backgroundColor: p.accent.mint,
          }}
        >
          <Text style={{ color: "#04150c", fontSize: 14, fontWeight: "600" }}>
            {query.trim()}
          </Text>
        </View>
      </View>

      {/* Loupe AI's bubble — typing dots, then the reply types out. */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.16),
          }}
        >
          <Sparkles size={14} color={p.accent.mint} />
        </View>
        <View
          style={{
            flexShrink: 1,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 18,
            borderBottomLeftRadius: 6,
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.25),
            backgroundColor: withAlpha(p.accent.mint, 0.05),
          }}
        >
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
          {ai.isLoading ? (
            <TypingDots color={p.accent.mint} />
          ) : unreachable ? (
            <Text
              style={{
                color: p.ink.default,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 2,
              }}
            >
              I can't reach the catalog right now — check your connection and{" "}
              <Text
                onPress={() => void ai.refetch()}
                style={{ color: p.accent.mint, fontWeight: "800" }}
              >
                try again
              </Text>
              .
            </Text>
          ) : fallbackResults ? (
            <Text
              style={{
                color: p.ink.default,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 2,
              }}
            >
              I'm resting right now — here are the closest name matches instead.
            </Text>
          ) : showBubble && answer ? (
            <Text
              style={{
                color: p.ink.default,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 2,
                fontWeight: "500",
              }}
            >
              {typed.shown}
              {!typed.done ? (
                <Text style={{ color: p.accent.mint }}>▍</Text>
              ) : null}
            </Text>
          ) : (
            <Text
              style={{
                color: p.ink.default,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 2,
              }}
            >
              I couldn't pin that one down — add a couple more details (colours,
              creatures, attacks) and{" "}
              <Text
                onPress={() => void ai.refetch()}
                style={{ color: p.accent.mint, fontWeight: "800" }}
              >
                try again
              </Text>
              .
            </Text>
          )}
          {/* Thumbs live ON the message — every AI summary can be rated. */}
          {showBubble && typed.done && answer?.askId ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderColor: withAlpha(p.accent.mint, 0.18),
              }}
            >
              <Text style={{ color: p.ink.dim, fontSize: 11, flex: 1 }}>
                {verdict ? "Thanks for the feedback" : "Did Loupe AI get it right?"}
              </Text>
              <Pressable
                onPress={() => rate("up")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Loupe AI got it right"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor:
                    verdict === "up"
                      ? withAlpha(p.accent.mint, 0.55)
                      : p.line.default,
                  backgroundColor:
                    verdict === "up"
                      ? withAlpha(p.accent.mint, 0.14)
                      : "transparent",
                }}
              >
                <ThumbsUp
                  size={13}
                  color={verdict === "up" ? p.accent.mint : p.ink.dim}
                />
              </Pressable>
              <Pressable
                onPress={() => rate("down")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Loupe AI missed"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor:
                    verdict === "down"
                      ? withAlpha(p.accent.rose, 0.55)
                      : p.line.default,
                  backgroundColor:
                    verdict === "down"
                      ? withAlpha(p.accent.rose, 0.14)
                      : "transparent",
                }}
              >
                <ThumbsDown
                  size={13}
                  color={verdict === "down" ? p.accent.rose : p.ink.dim}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {/* The reveal — chips + the results card once the reply finishes. */}
      {showBubble && answer && typed.done ? (
        <View style={{ gap: 12, marginTop: 2 }}>
          {answer.candidates.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                paddingLeft: 36,
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
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: withAlpha(p.accent.mint, 0.4),
                    backgroundColor: withAlpha(p.accent.mint, 0.08),
                  }}
                >
                  <Text
                    style={{
                      color: p.accent.mint,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Results — the EXACT same look as normal search results: a
              count line, then plain rows. No box. */}
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 2,
              }}
            >
              <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "700" }}>
                {answer.results.length > 8
                  ? `Showing 8 of ${answer.results.length}`
                  : `${answer.results.length} ${
                      answer.results.length === 1 ? "match" : "matches"
                    }`}
                {" · best first"}
              </Text>
              <Pressable
                onPress={() => void ai.refetch()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Ask Loupe AI again"
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <RotateCcw size={11} color={p.accent.mint} />
                <Text
                  style={{
                    color: p.accent.mint,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
            {answer.results.slice(0, 8).map((card, i) => (
              <SearchResultRow key={card.id} card={card} bordered={i > 0} />
            ))}
            <Text style={{ color: p.ink.dim, fontSize: 10, marginTop: 8 }}>
              AI can misread — cards and prices come from the live catalog.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Fallback name matches (model resting) render right away. */}
      {fallbackResults ? (
        <View>
          {fallbackResults.slice(0, 8).map((card, i) => (
            <SearchResultRow key={card.id} card={card} bordered={i > 0} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
