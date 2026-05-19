/**
 * Post-capture review screen shown for phone scans:
 *   - Runs best-effort OCR on the front-ambient frame
 *   - Lets the user confirm/edit detected title before grading kicks off
 *   - Shows the 4 (or 2) thumbnails with re-take affordance back to the flow
 *
 * Confirm → calls `onConfirm(captures, ocr)` so the parent can hand off to
 * the existing scan-job pipeline.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, RotateCcw, Sparkles } from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { OcrSuggestion, PhotometricCapture } from "@/domain";
import { recognizeCardText } from "./imageOps";

interface CaptureReviewScreenProps {
  captures: PhotometricCapture[];
  onConfirm: (captures: PhotometricCapture[], ocr: OcrSuggestion | null) => void;
  onRetake: () => void;
}

export function CaptureReviewScreen({ captures, onConfirm, onRetake }: CaptureReviewScreenProps) {
  const p = useThemedPalette();
  const [ocr, setOcr] = useState<OcrSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  useEffect(() => {
    let cancelled = false;
    const front = captures.find((c) => c.lightIndex === 0);
    if (!front) {
      setLoading(false);
      return;
    }
    recognizeCardText(front.uri).then((res) => {
      if (cancelled) return;
      setOcr(res);
      setTitle(res.title ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [captures]);

  const submit = () => {
    const merged: OcrSuggestion | null = ocr
      ? { ...ocr, title: title.trim() || ocr.title }
      : title.trim()
        ? { title: title.trim(), confidence: 1, rawLines: [] }
        : null;
    onConfirm(captures, merged);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 24 }}>
        <View className="gap-1">
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Review captures
          </Text>
          <Text className="text-2xl font-semibold text-ink">Confirm before grading</Text>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {captures.map((c) => (
            <View
              key={c.lightIndex}
              className="overflow-hidden rounded-xl border border-line bg-bg-elevated"
              style={{ width: "47%", aspectRatio: 2.5 / 3.5 }}
            >
              <Image source={{ uri: c.uri }} style={{ flex: 1 }} resizeMode="cover" />
              <View className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5">
                <Text className="text-[9px] font-semibold uppercase tracking-[2px] text-white">
                  Light {c.lightIndex}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-2xl border border-line bg-bg-elevated p-4">
          <View className="flex-row items-center gap-2">
            <Sparkles size={14} color={p.accent.mint} />
            <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              Auto-detected
            </Text>
            {ocr ? (
              <View
                className="ml-auto rounded-full px-2 py-0.5"
                style={{ backgroundColor: withAlpha(p.accent.mint, 0.13) }}
              >
                <Text
                  className="text-[9px] font-semibold uppercase tracking-[2px]"
                  style={{ color: p.accent.mint }}
                >
                  {(ocr.confidence * 100).toFixed(0)}% confidence
                </Text>
              </View>
            ) : null}
          </View>
          {loading ? (
            <View className="flex-row items-center gap-2 py-2">
              <ActivityIndicator color={p.accent.mint} />
              <Text className="text-sm text-ink-muted">Reading card text…</Text>
            </View>
          ) : (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Card title"
                placeholderTextColor={p.ink.dim}
                className="rounded-xl border border-line bg-bg px-3 py-3 text-base text-ink"
                style={{ color: p.ink.default }}
              />
              {ocr?.set || ocr?.year ? (
                <Text className="text-xs text-ink-muted">
                  {[ocr?.set, ocr?.year].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View className="gap-2">
          <PrimaryButton label="Grade this card" icon={Check} variant="mint" onPress={submit} />
          <PrimaryButton
            label="Retake captures"
            icon={RotateCcw}
            variant="ghost"
            onPress={onRetake}
          />
        </View>

        <Pressable onPress={() => onConfirm(captures, null)} hitSlop={10} className="items-center">
          <Text className="text-xs text-ink-dim">Skip — grade without title</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
