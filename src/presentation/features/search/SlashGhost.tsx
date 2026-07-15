/**
 * SlashGhost — the inline "/" autocomplete INSIDE the search bar.
 *
 * Typing "/" makes the input hug its content and this ghost takes the rest
 * of the bar: the completion types itself out in green right after the
 * caret — `ai · Ask Loupe AI ⌫swipe` — like an IDE inline suggestion.
 * Tap it, press return, or swipe the bar left to accept into AI mode.
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const COMMAND = "ai";
const LABEL = "  Ask Loupe AI";

export function SlashGhost({
  typed,
  onAccept,
}: {
  /** What the user typed after the slash ("", "a", or "ai"). */
  typed: string;
  onAccept: () => void;
}) {
  const p = useThemedPalette();
  // The completion still owed, e.g. "/" → "ai", "/a" → "i".
  const rest = COMMAND.slice(typed.length);
  const full = rest + LABEL;
  const [chars, setChars] = useState(0);

  // Slowly type the suggestion out whenever it (re)appears or shrinks.
  useEffect(() => {
    setChars(0);
    const id = setInterval(() => {
      setChars((c) => (c >= full.length ? c : c + 1));
    }, 34);
    return () => clearInterval(id);
  }, [full]);

  const shownRest = full.slice(0, Math.min(chars, rest.length));
  const shownLabel = full.slice(rest.length, chars);

  return (
    <Pressable
      onPress={onAccept}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Accept: Ask Loupe AI — describe the card in your own words"
      style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
    >
      <Text numberOfLines={1} style={{ fontSize: 15 }}>
        {/* Green completion of the command itself… */}
        <Text style={{ color: p.accent.mint, fontWeight: "800" }}>
          {shownRest}
        </Text>
        {/* …then the softer label. */}
        <Text style={{ color: withAlpha(p.accent.mint, 0.75), fontWeight: "600" }}>
          {shownLabel}
        </Text>
        {chars < full.length ? (
          <Text style={{ color: p.accent.mint }}>▍</Text>
        ) : null}
      </Text>
      {chars >= full.length ? (
        <Text
          style={{
            marginLeft: "auto",
            color: p.ink.dim,
            fontSize: 10,
            fontWeight: "700",
          }}
        >
          ‹ swipe
        </Text>
      ) : null}
    </Pressable>
  );
}
