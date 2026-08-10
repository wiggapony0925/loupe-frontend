/**
 * PostCaption — a caption with its #tags and @mentions made tappable.
 *
 * The server tells us which words are REAL: `hashtags` are what it indexed,
 * `mentions` are the handles that resolved to accounts. Highlighting is
 * matched against those lists rather than against the regex alone, so an
 * email address in a caption isn't rendered as a broken link to nobody, and
 * a tag stays highlighted exactly when the tag page will have the post on it.
 */
import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Splits on the two token shapes; the capture groups keep the delimiters. */
const TOKEN_RE = /(#[A-Za-z0-9_]+|@[A-Za-z0-9][A-Za-z0-9._]*)/g;

export interface PostCaptionProps {
  body: string;
  /** Lowercase, no '#'. */
  hashtags: string[];
  /** Handles that resolve to real accounts. */
  mentions: string[];
  /** Collapse to a few lines with the full text one tap away. */
  numberOfLines?: number;
  /** Rendered before the caption, in bold — the author's handle, Instagram-style. */
  prefix?: string;
  onPressPrefix?: () => void;
}

export function PostCaption({
  body,
  hashtags,
  mentions,
  numberOfLines,
  prefix,
  onPressPrefix,
}: PostCaptionProps) {
  const p = useThemedPalette();
  // Wire data: a post row that arrives without its `hashtags`/`mentions`
  // arrays (or with a non-string body) must render as plain text, not
  // throw — every caption in the feed passes through here.
  const tags = useMemo(
    () =>
      new Set(
        (Array.isArray(hashtags) ? hashtags : [])
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.toLowerCase()),
      ),
    [hashtags],
  );
  const handles = useMemo(
    () =>
      new Set(
        (Array.isArray(mentions) ? mentions : [])
          .filter((m): m is string => typeof m === "string")
          .map((m) => m.toLowerCase()),
      ),
    [mentions],
  );

  const parts = useMemo(
    () => (typeof body === "string" ? body : String(body ?? "")).split(TOKEN_RE),
    [body],
  );

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.body, { color: p.ink.default }]}
    >
      {prefix ? (
        <Text
          onPress={onPressPrefix}
          style={[styles.prefix, { color: p.ink.default }]}
        >
          {prefix}{" "}
        </Text>
      ) : null}
      {parts.map((part, index) => {
        const key = `${index}-${part}`;
        if (part.startsWith("#")) {
          const tag = part.slice(1).toLowerCase();
          if (!tags.has(tag)) return <Text key={key}>{part}</Text>;
          return (
            <Text
              key={key}
              onPress={() => router.push(routes.communityTag(tag))}
              style={{ color: p.accent.mint }}
            >
              {part}
            </Text>
          );
        }
        if (part.startsWith("@")) {
          // Trailing punctuation is part of the sentence, not the handle —
          // the same trimming the server does when it resolves mentions.
          const handle = part.slice(1).toLowerCase().replace(/[._]+$/, "");
          if (!handles.has(handle)) return <Text key={key}>{part}</Text>;
          return (
            <Text
              key={key}
              onPress={() => router.push(routes.collector(handle))}
              style={{ color: p.accent.mint }}
            >
              {part}
            </Text>
          );
        }
        return <Text key={key}>{part}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14.5, lineHeight: 20.5 },
  prefix: { fontWeight: "700" },
});
