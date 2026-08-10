/**
 * Compose — write a post.
 *
 * The caption is the primary field and gets focus on mount; media is
 * optional. That ordering matters on a card app: plenty of good posts are
 * "does anyone else have this?" with no picture at all, and a composer that
 * opens on a media picker implies otherwise.
 *
 * Slides can be photos OR clips — the picker offers both, and the story
 * camera hands its capture here (`mediaUri`/`mediaKind` params) when the
 * shooter chooses "Post" over "Your story", the Instagram fork.
 *
 * Publishing is ONE request (multipart) — see the backend's create_post. A
 * two-step "create then attach" would leave a captionless post behind every
 * time the upload failed.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ImagePlus, Layers, Play, ShieldAlert, X } from "lucide-react-native";
import { useCreatePost } from "@/application/queries/social/useFeed";
import { useModeratedSubmit } from "@/presentation/features/social/feed/useModeratedSubmit";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { Video } from "@/presentation/features/social/Video";
import {
  CardPickerSheet,
  type PickedCard,
} from "@/presentation/features/social/feed/CardPickerSheet";
import { CaptionInput } from "@/presentation/features/social/feed/CaptionInput";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Matches the server's cap (`MAX_POST_BODY`). */
const MAX_BODY = 2200;
/** Matches `post_media.MAX_IMAGES_PER_POST`. */
const MAX_IMAGES = 4;
/** Feed clips cap at a minute, Instagram's old rule — long-form belongs
 *  nowhere near a card feed, and the server's 120 MB ceiling is easy to
 *  hit past this anyway. */
const MAX_VIDEO_SECONDS = 60;

interface Draft {
  uri: string;
  mimeType?: string;
  kind: "image" | "video";
}

/** Best-effort mime from a file URI, for handoffs that don't carry one. */
function mimeFromUri(uri: string, kind: "image" | "video"): string {
  const lower = uri.toLowerCase();
  if (kind === "video") {
    return lower.endsWith(".mp4") ? "video/mp4" : "video/quicktime";
  }
  return lower.endsWith(".png") ? "image/png" : "image/jpeg";
}

export default function ComposeScreen() {
  const p = useThemedPalette();
  const me = useSocialMe();
  const create = useCreatePost();
  // The story camera's handoff: its capture arrives as params when the
  // shooter picked "Post" at the review step. Read once into initial
  // state — params persist across re-renders and must not re-seed.
  const params = useLocalSearchParams<{
    mediaUri?: string;
    mediaKind?: string;
    prefill?: string;
  }>();
  // Every publish surface answers a refusal the same way — see the hook.
  const { submit, refusal, dismiss, pending } = useModeratedSubmit(create, {
    onDone: () => router.back(),
  });

  const [body, setBody] = useState(() =>
    typeof params.prefill === "string" ? params.prefill.slice(0, MAX_BODY) : "",
  );
  const [images, setImages] = useState<Draft[]>(() => {
    if (typeof params.mediaUri !== "string" || !params.mediaUri) return [];
    const kind = params.mediaKind === "video" ? "video" : "image";
    return [
      {
        uri: params.mediaUri,
        kind,
        mimeType: mimeFromUri(params.mediaUri, kind),
      },
    ];
  });
  const [card, setCard] = useState<PickedCard | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const remaining = MAX_BODY - body.length;
  const canPost =
    (body.trim().length > 0 || images.length > 0 || card !== null) && !pending;

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access in Settings to add pictures to a post.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // Photos AND clips — "i cant upload vidoes" was this one word.
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    const drafts: Draft[] = [];
    for (const asset of result.assets) {
      const kind = asset.type === "video" ? "video" : "image";
      // Picker duration is milliseconds. Refuse long clips HERE, where the
      // fix (trim it) is still possible — the server would only refuse
      // after the whole file uploaded.
      if (
        kind === "video" &&
        typeof asset.duration === "number" &&
        asset.duration > MAX_VIDEO_SECONDS * 1000
      ) {
        Alert.alert(
          "Clip too long",
          `Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`,
        );
        continue;
      }
      drafts.push({
        uri: asset.uri,
        mimeType: asset.mimeType ?? mimeFromUri(asset.uri, kind),
        kind,
      });
    }
    if (drafts.length === 0) return;
    setImages((current) => [...current, ...drafts].slice(0, MAX_IMAGES));
  };

  const publish = () => {
    if (!canPost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    submit({ body: body.trim() || undefined, images, cardId: card?.cardId });
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={[styles.bar, { borderBottomColor: p.line.default }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancel, { color: p.ink.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: p.ink.default }]}>New post</Text>
          <Pressable
            onPress={publish}
            disabled={!canPost}
            accessibilityRole="button"
            accessibilityLabel="Publish post"
            style={[
              styles.post,
              {
                backgroundColor: canPost
                  ? p.accent.mint
                  : withAlpha(p.ink.default, 0.1),
              },
            ]}
          >
            {pending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <Text
                style={[
                  styles.postText,
                  { color: canPost ? "#06140d" : p.ink.dim },
                ]}
              >
                Post
              </Text>
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.safe}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {refusal ? (
              // The draft is deliberately untouched — most refusals are one
              // word away from fine, and wiping what someone wrote is punitive.
              <View
                style={[
                  styles.refusal,
                  {
                    borderColor: withAlpha(p.accent.rose, 0.4),
                    backgroundColor: withAlpha(p.accent.rose, 0.1),
                  },
                ]}
              >
                <ShieldAlert size={17} color={p.accent.rose} strokeWidth={2.2} />
                <Text style={[styles.refusalText, { color: p.ink.default }]}>
                  {refusal}
                </Text>
              </View>
            ) : null}

            <View style={styles.writer}>
              {me.data?.profile ? (
                <SocialAvatar
                  handle={me.data.profile.username}
                  url={me.data.profile.avatar_url}
                  size={38}
                />
              ) : null}
              <CaptionInput
                value={body}
                onChangeText={(next) => {
                  setBody(next.slice(0, MAX_BODY));
                  // Editing is the user answering the refusal — clear it.
                  if (refusal) dismiss();
                }}
                placeholder="What did you pull? Use #tags and @mentions."
                autoFocus
              />
            </View>


            {images.length > 0 ? (
              <View style={styles.thumbs}>
                {images.map((image, index) => (
                  <View key={image.uri} style={styles.thumb}>
                    {image.kind === "video" ? (
                      // A paused player shows the clip's real first frame —
                      // no thumbnail pipeline needed. The play glyph marks
                      // it as a clip, not a photo.
                      <View style={styles.thumbImage}>
                        <Video
                          uri={image.uri}
                          style={styles.thumbImage}
                          muted
                          paused
                          contentFit="cover"
                        />
                        <View style={styles.thumbPlay} pointerEvents="none">
                          <Play size={16} color="#fff" fill="#fff" />
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: image.uri }}
                        style={styles.thumbImage}
                        contentFit="cover"
                      />
                    )}
                    <Pressable
                      onPress={() =>
                        setImages((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove slide ${index + 1}`}
                      style={styles.thumbRemove}
                    >
                      <X size={13} color="#fff" strokeWidth={3} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {/* The attached card. This is what makes a Loupe post different
                from a photo: readers get a chip that opens the real card. */}
            {card ? (
              <View
                style={[
                  styles.cardChip,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                {card.imageUrl ? (
                  <Image
                    source={{ uri: card.imageUrl }}
                    style={styles.cardArt}
                    contentFit="cover"
                  />
                ) : null}
                <View style={styles.cardText}>
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, { color: p.ink.default }]}
                  >
                    {card.name ?? "Card"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.cardMeta, { color: p.ink.dim }]}
                  >
                    {[card.setName, card.number && `#${card.number}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setCard(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove the attached card"
                >
                  <X size={15} color={p.ink.dim} strokeWidth={2.4} />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>


          <View style={[styles.tools, { borderTopColor: p.line.default }]}>
            <Pressable
              onPress={() => void pick()}
              disabled={images.length >= MAX_IMAGES}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add photos or videos"
              style={styles.tool}
            >
              <ImagePlus
                size={21}
                color={images.length >= MAX_IMAGES ? p.ink.dim : p.accent.mint}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.toolText,
                  {
                    color:
                      images.length >= MAX_IMAGES ? p.ink.dim : p.ink.default,
                  },
                ]}
              >
                {images.length > 0
                  ? `${images.length}/${MAX_IMAGES} slides`
                  : "Photos & video"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPickerOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Attach a card from your vault"
              style={styles.tool}
            >
              <Layers size={20} color={p.accent.mint} strokeWidth={2.2} />
              <Text style={[styles.toolText, { color: p.ink.default }]}>
                {card ? "Change card" : "Attach card"}
              </Text>
            </Pressable>

            <View style={styles.toolSpacer} />

            {/* Only shown near the limit: a counter that is always on screen
                turns writing into a budget. */}
            {remaining <= 200 ? (
              <Text
                style={[
                  styles.counter,
                  { color: remaining < 0 ? p.accent.rose : p.ink.dim },
                ]}
              >
                {remaining}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CardPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={setCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancel: { fontSize: 15, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  post: {
    minWidth: 66,
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  postText: { fontSize: 14, fontWeight: "800" },
  content: { padding: 20, gap: 16 },
  writer: { flexDirection: "row", gap: 12 },
  refusal: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  refusalText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  preview: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  previewLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  input: { flex: 1, fontSize: 16, lineHeight: 22, minHeight: 120, paddingTop: 8 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumb: { width: 96, height: 120, borderRadius: 12, overflow: "visible" },
  thumbImage: { width: 96, height: 120, borderRadius: 12, overflow: "hidden" },
  thumbPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tool: { flexDirection: "row", alignItems: "center", gap: 9 },
  toolSpacer: { flex: 1 },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
  },
  cardArt: { width: 34, height: 47, borderRadius: 5 },
  cardText: { flex: 1, gap: 2 },
  cardName: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
  cardMeta: { fontSize: 11.5 },
  toolText: { fontSize: 14, fontWeight: "600" },
  counter: { fontSize: 13, fontWeight: "700" },
});
