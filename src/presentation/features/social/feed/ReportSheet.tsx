/**
 * ReportSheet — report a post, comment or profile.
 *
 * The reasons come from the SERVER, not a list hardcoded here: the same
 * closed set has to reach the web client and the moderation queue, and a
 * reason one client can send but another can't is a reason nobody counts.
 *
 * Reporting the same thing twice is idempotent server-side, so a second tap
 * needs no guard — and someone who reports again because nothing visibly
 * happened isn't met with an error.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Check, ShieldCheck } from "lucide-react-native";
import {
  useReportContent,
  useReportReasons,
} from "@/application/queries/social/useFeed";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export interface ReportTarget {
  type: "post" | "comment" | "profile";
  id: string;
  /** Whose content it is — shown so nobody reports the wrong thing. */
  label: string;
}

export function ReportSheet({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const reasons = useReportReasons(!!target);
  const report = useReportContent();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const close = () => {
    setReason(null);
    setNote("");
    setDone(false);
    onClose();
  };

  const submit = () => {
    if (!target || !reason || report.isPending) return;
    Haptics.selectionAsync().catch(() => {});
    report.mutate(
      {
        targetType: target.type,
        targetId: target.id,
        reason,
        note: note.trim() || undefined,
      },
      { onSuccess: () => setDone(true) },
    );
  };

  return (
    <BottomSheet
      visible={!!target}
      onClose={close}
      title={done ? "Thanks — we're on it" : "Report this"}
      subtitle={
        done
          ? null
          : `${target?.label ?? ""} — tell us what's wrong and a moderator will look.`
      }
      subtitleLines={2}
      overlay
      compact={done}
      minHeight="55%"
    >
      {done ? (
        <View style={styles.done}>
          <View
            style={[
              styles.doneGlyph,
              { backgroundColor: withAlpha(p.accent.mint, 0.16) },
            ]}
          >
            <ShieldCheck size={24} color={p.accent.mint} strokeWidth={2.2} />
          </View>
          <Text style={[styles.doneBody, { color: p.ink.muted }]}>
            It&rsquo;s in the review queue. We don&rsquo;t tell the other person
            who reported them.
          </Text>
          <Pressable
            onPress={close}
            style={[styles.cta, { backgroundColor: p.accent.mint }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.reasons}>
            {Object.entries(reasons.data ?? {}).map(([key, label]) => {
              const active = reason === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setReason(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.reason,
                    {
                      borderColor: active ? p.accent.mint : p.line.default,
                      backgroundColor: active
                        ? withAlpha(p.accent.mint, 0.1)
                        : p.bg.elevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      { color: active ? p.accent.mint : p.ink.default },
                    ]}
                  >
                    {label}
                  </Text>
                  {active ? (
                    <Check size={16} color={p.accent.mint} strokeWidth={3} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={note}
            onChangeText={(next) => setNote(next.slice(0, 1000))}
            placeholder="Anything else we should know? (optional)"
            placeholderTextColor={p.ink.dim}
            multiline
            style={[
              styles.note,
              {
                color: p.ink.default,
                borderColor: p.line.default,
                backgroundColor: p.bg.elevated,
              },
            ]}
            accessibilityLabel="Report details"
          />

          {report.isError ? (
            <Text style={[styles.error, { color: p.accent.rose }]}>
              {report.error?.message || "Couldn't send that. Try again."}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!reason || report.isPending}
            accessibilityRole="button"
            accessibilityLabel="Send report"
            style={[
              styles.cta,
              {
                backgroundColor: reason
                  ? p.accent.mint
                  : withAlpha(p.ink.default, 0.1),
              },
            ]}
          >
            {report.isPending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <Text
                style={[styles.ctaText, { color: reason ? "#06140d" : p.ink.dim }]}
              >
                Report
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: 8, paddingBottom: 14 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  reasonText: { fontSize: 14.5, fontWeight: "600" },
  note: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14.5,
  },
  error: { fontSize: 13, marginTop: 10 },
  cta: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 999,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: "#06140d" },
  done: { alignItems: "center", gap: 14, paddingVertical: 10 },
  doneGlyph: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
