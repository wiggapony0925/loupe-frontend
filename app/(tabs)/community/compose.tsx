/**
 * Compose — write a post.
 *
 * The caption is the primary field and gets focus on mount; photos are
 * optional. That ordering matters on a card app: plenty of good posts are
 * "does anyone else have this?" with no picture at all, and a composer that
 * opens on a photo picker implies otherwise.
 *
 * Publishing is ONE request (multipart) — see the backend's create_post. A
 * two-step "create then attach" would leave a captionless post behind every
 * time the upload failed.
 */
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ImagePlus, Layers, ShieldAlert, X } from "lucide-react-native";
import { useCreatePost } from "@/application/queries/social/useFeed";
import { useModeratedSubmit } from "@/presentation/features/social/feed/useModeratedSubmit";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import {
  CardPickerSheet,
  type PickedCard,
} from "@/presentation/features/social/feed/CardPickerSheet";
import {
  HashtagSuggestions,
  activeHashtag,
  completeHashtag,
} from "@/presentation/features/social/feed/HashtagSuggestions";
import { PostCaption } from "@/presentation/features/social/feed/PostCaption";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Matches the server's cap (`MAX_POST_BODY`). */
const MAX_BODY = 2200;
/** Matches `post_media.MAX_IMAGES_PER_POST`. */
const MAX_IMAGES = 4;

interface Draft {
  uri: string;
  mimeType?: string;
}

export default function ComposeScreen() {
  const p = useThemedPalette();
  const me = useSocialMe();
  const create = useCreatePost();
  // Every publish surface answers a refusal the same way — see the hook.
  const { submit, refusal, dismiss, pending } = useModeratedSubmit(create, {
    onDone: () => router.back(),
  });

  const [body, setBody] = useState("");
  const [images, setImages] = useState<Draft[]>([]);
  const [card, setCard] = useState<PickedCard | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Where the caret is, so we know which `#word` is being typed.
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Null unless the caret sits inside a `#tag`; "" the instant `#` is typed
  // (which is when a suggestion helps most — see HashtagSuggestions).
  const typingTag = activeHashtag(body, caret);

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
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    setImages((current) =>
      [
        ...current,
        ...result.assets.map((asset) => ({
          uri: asset.uri,
          mimeType: asset.mimeType,
        })),
      ].slice(0, MAX_IMAGES),
    );
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
              <TextInput
                ref={inputRef}
                value={body}
                onSelectionChange={(e) =>
                  setCaret(e.nativeEvent.selection.end)
                }
                onChangeText={(next) => {
                  setBody(next.slice(0, MAX_BODY));
                  // Editing is the user answering the refusal — clear it.
                  if (refusal) dismiss();
                }}
                placeholder="What did you pull? Use #tags and @mentions."
                placeholderTextColor={p.ink.dim}
                multiline
                autoFocus
                style={[styles.input, { color: p.ink.default }]}
                accessibilityLabel="Post caption"
              />
            </View>

            {/* How it will actually read. A caption's #tags and @mentions
                only turned green AFTER posting, so nobody could see they'd
                typed a real tag until it was too late to fix. */}
            {body.trim().length > 0 ? (
              <View
                style={[
                  styles.preview,
                  { borderColor: p.line.default, backgroundColor: p.bg.elevated },
                ]}
              >
                <Text style={[styles.previewLabel, { color: p.ink.dim }]}>
                  PREVIEW
                </Text>
                <PostCaption
                  body={body}
                  // Everything that LOOKS like a tag is shown as one here —
                  // the server hasn't indexed it yet, and the point is to
                  // show what will happen.
                  hashtags={(body.match(/#([A-Za-z0-9_]{1,64})/g) ?? []).map((t) =>
                    t.slice(1).toLowerCase(),
                  )}
                  mentions={(body.match(/@([A-Za-z0-9][A-Za-z0-9._]{2,29})/g) ?? []).map(
                    (m) => m.slice(1).toLowerCase(),
                  )}
                />
              </View>
            ) : null}

            {images.length > 0 ? (
              <View style={styles.thumbs}>
                {images.map((image, index) => (
                  <View key={image.uri} style={styles.thumb}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.thumbImage}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() =>
                        setImages((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
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

          <HashtagSuggestions
            query={typingTag}
            onPick={(tag) => {
              const next = completeHashtag(body, caret, tag);
              setBody(next.text.slice(0, MAX_BODY));
              setCaret(next.caret);
              inputRef.current?.focus();
            }}
          />

          <View style={[styles.tools, { borderTopColor: p.line.default }]}>
            <Pressable
              onPress={() => void pick()}
              disabled={images.length >= MAX_IMAGES}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
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
                  ? `${images.length}/${MAX_IMAGES} photos`
                  : "Add photos"}
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
  thumbImage: { width: 96, height: 120, borderRadius: 12 },
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
