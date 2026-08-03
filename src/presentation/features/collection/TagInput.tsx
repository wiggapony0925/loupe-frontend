/**
 * TagInput — edit a holding's organization tags (e.g. "PC", "For sale").
 *
 * Chips with a remove affordance + a type-to-add field, plus tap-to-add
 * suggestions drawn from the tags the user already uses elsewhere in their
 * vault (`summary.availableTags`). House style: tap = do it, no chooser popups.
 * Cleaning mirrors the backend `_clean_tags` (trim, ≤24 chars, ≤12 tags,
 * case-insensitive de-dupe) so the client never sends something the server
 * would silently drop.
 */
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Plus, X } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const MAX_TAGS = 12;
const MAX_TAG_LEN = 24;

/**
 * Offered on a first-ever add, when the vault has no tags to suggest yet.
 *
 * Without these the control rendered as a bare bordered box, which is what
 * made tagging look like a free-text field nobody knew what to type into. A
 * few concrete examples teach the feature in one glance.
 */
const STARTER_TAGS = ["PC", "For sale", "Graded", "Invest", "Traded"] as const;

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags the user already uses — offered as tap-to-add chips. */
  suggestions?: string[];
}

export function TagInput({ value, onChange, suggestions = [] }: TagInputProps) {
  const p = useThemedPalette();
  const [draft, setDraft] = useState("");

  const lowerSet = useMemo(
    () => new Set(value.map((t) => t.toLowerCase())),
    [value],
  );

  const addTag = (raw: string) => {
    const tag = raw.trim().slice(0, MAX_TAG_LEN).trim();
    if (!tag || value.length >= MAX_TAGS || lowerSet.has(tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const removeTag = (tag: string) =>
    onChange(value.filter((t) => t !== tag));

  // Suggestions not already applied — the quick-add row.
  const pool = suggestions.length > 0 ? suggestions : [...STARTER_TAGS];
  const unusedSuggestions = pool.filter(
    (s) => s && !lowerSet.has(s.toLowerCase()),
  );

  const atMax = value.length >= MAX_TAGS;

  return (
    <View style={{ gap: 10 }}>
      {/* An empty tag box is just a bordered rectangle with a caret in it —
          indistinguishable from any other text field, which is why this
          didn't read as "tags" at all. Name the control and say what it's
          for, then let the chips below carry the meaning. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: p.ink.muted,
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          Tags
        </Text>
        <Text style={{ color: p.ink.dim, fontSize: 11 }}>
          {value.length}/{MAX_TAGS}
        </Text>
      </View>

      {/* Selected tags + inline add field */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
        }}
      >
        {value.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => removeTag(tag)}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${tag}`}
            style={[
              styles.tagChip,
              {
                backgroundColor: withAlpha(p.accent.mint, 0.14),
                borderColor: withAlpha(p.accent.mint, 0.4),
              },
            ]}
          >
            <Text
              style={{ color: p.accent.mint, fontSize: 12.5, fontWeight: "700" }}
            >
              {tag}
            </Text>
            <X size={12} color={p.accent.mint} strokeWidth={2.5} />
          </Pressable>
        ))}
        {!atMax ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => addTag(draft)}
            onBlur={() => draft.trim() && addTag(draft)}
            placeholder={value.length === 0 ? "Add a tag…" : "Add…"}
            placeholderTextColor={p.ink.dim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit={false}
            maxLength={MAX_TAG_LEN}
            accessibilityLabel="New tag"
            style={{
              flex: 1,
              minWidth: 90,
              color: p.ink.default,
              fontSize: 13.5,
              paddingVertical: 0,
            }}
          />
        ) : null}
      </View>

      {/* Quick-add chips. Rendering these at the empty state too is what
          actually communicates "these are tags" on a first-ever add. */}
      {unusedSuggestions.length > 0 && !atMax ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {unusedSuggestions.slice(0, 12).map((s) => (
            <Pressable
              key={s}
              onPress={() => addTag(s)}
              accessibilityRole="button"
              accessibilityLabel={`Add tag ${s}`}
              style={[
                styles.suggestChip,
                { borderColor: p.line.default, backgroundColor: p.bg.base },
              ]}
            >
              <Plus size={11} color={p.ink.dim} strokeWidth={2.5} />
              <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "600" }}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Chip layout lives in a StyleSheet, not in a `style={({pressed}) => ({...})}`
 * callback. Returning a plain object from that callback loses its layout props
 * under this project's NativeWind transform: `flexDirection: "row"` never
 * applied, so every chip rendered its "+" stacked above the label instead of
 * beside it. (The same failure produced the broken Google sign-in button.)
 */
const styles = StyleSheet.create({
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 10,
    paddingRight: 7,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
});
