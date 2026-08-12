/**
 * CaptionInput — the one caption editor. Used by the composer and by
 * "Edit post", so a caption is written the same way whenever it's written.
 *
 * **Tags go green as you type, in the field itself.** There used to be a
 * separate PREVIEW card underneath showing how the caption would read.
 * It answered a real question — a caption's tags only turned green *after*
 * posting, so nobody could tell they'd typed a real one until it was too
 * late — but it answered it by showing the same sentence twice, which
 * doubled the height of the composer and left the user comparing two
 * copies of their own words. Styling the live text removes the question
 * instead of illustrating it.
 *
 * This works because RN lets a multiline `TextInput` take `<Text>` children
 * as its rendered content while remaining fully editable — the value still
 * comes from `value`/`onChangeText`, the children only decide how it looks.
 *
 * **The suggestion row is always there.** It offers the tags you've used
 * before (falling back to trending on a new account), and narrows to
 * matches the moment you type a `#`. The old behaviour showed nothing
 * until a `#` was typed, which meant the feature was invisible to anyone
 * who didn't already know it existed.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { HashtagRow } from "./HashtagRow";
import { activeHashtag, completeHashtag } from "./hashtagCaret";

/** Same token shapes PostCaption highlights, so the two agree. */
const TOKEN_RE = /(#[A-Za-z0-9_]+|@[A-Za-z0-9][A-Za-z0-9._]*)/g;
/** Un-anchored twin for testing a single split part. Deliberately NOT the
 *  same object: `.test()` on a /g regex advances `lastIndex`, so reusing
 *  TOKEN_RE would make every other tag come back unstyled. */
const IS_TOKEN = /^(#[A-Za-z0-9_]+|@[A-Za-z0-9][A-Za-z0-9._]*)$/;

export interface CaptionInputProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  /**
   * How far this input sits from each screen edge — forwarded to the
   * suggestion row so its chips can bleed edge-to-edge out of a padded
   * (or avatar-indented) column. See HashtagRow.
   */
  suggestionInsets?: { left: number; right: number };
  /** Rendered under the field — the photo picker row, a card chip, etc. */
  children?: React.ReactNode;
}

export function CaptionInput({
  value,
  onChangeText,
  placeholder = "Write a caption…",
  autoFocus = false,
  maxLength,
  suggestionInsets,
  children,
}: CaptionInputProps) {
  const p = useThemedPalette();
  const [caret, setCaret] = useState(0);

  // `""` (not null) the instant a bare '#' is typed — that's the signal to
  // narrow the row rather than hide it. See hashtagCaret.
  const typingTag = activeHashtag(value, caret);

  // Everything that LOOKS like a token is tinted. The server hasn't indexed
  // anything yet, and the point is to show what WILL happen — which is also
  // why this can't reuse PostCaption, whose whole contract is that it only
  // highlights what the server confirmed.
  const parts = useMemo(() => value.split(TOKEN_RE), [value]);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)}
        placeholder={placeholder}
        placeholderTextColor={p.ink.dim}
        multiline
        autoFocus={autoFocus}
        maxLength={maxLength}
        style={[styles.input, { color: p.ink.default }]}
        accessibilityLabel="Post caption"
      >
        {parts.map((part, i) =>
          IS_TOKEN.test(part) ? (
            // eslint-disable-next-line react/no-array-index-key
            <Text key={i} style={{ color: p.accent.mint, fontWeight: "600" }}>
              {part}
            </Text>
          ) : (
            // eslint-disable-next-line react/no-array-index-key
            <Text key={i}>{part}</Text>
          ),
        )}
      </TextInput>

      {children}

      <HashtagRow
        query={typingTag}
        insetLeft={suggestionInsets?.left ?? 0}
        insetRight={suggestionInsets?.right ?? 0}
        onPick={(tag) => {
          const next = completeHashtag(value, caret, tag);
          onChangeText(next.text);
          setCaret(next.caret);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  input: {
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: "top",
  },
});
