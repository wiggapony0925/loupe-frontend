/**
 * Community settings — `/community-settings`
 *
 * Manage the community identity in one place, on the SAME visual template
 * as the regular Settings page (hero title + avatar bubble, hairline menu
 * rows, no card containers): change the photo (tap the avatar), username,
 * bio, location, flip private/public, jump to your public profile, or
 * deactivate the community profile entirely.
 *
 * Deactivation keeps the house no-popup rule with a two-tap arm. It removes
 * only the SOCIAL profile (follows/requests/likes severed server-side) —
 * the Loupe account, vault and billing are untouched; rejoining is just
 * claiming a handle again.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Camera, Check, ChevronLeft, ChevronRight, LogOut } from "lucide-react-native";
import {
  useDeactivateCommunity,
  useSocialMe,
  useUploadAvatar,
  useUpsertProfile,
} from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._]{2,29}$/;

export default function CommunitySettingsScreen() {
  const p = useThemedPalette();
  const me = useSocialMe();
  const profile = me.data?.profile ?? null;

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Freshly picked photo, shown instantly while (and after) it uploads.
  // The just-picked local file, shown instantly so a change doesn't look
  // like nothing happened. Cleared once the SERVER's URL changes, below.
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [armedLeave, setArmedLeave] = useState(false);
  const [seeded, setSeeded] = useState(false);
  // Timestamp of the last successful save — drives the confirmation. A save
  // that changes nothing visible (privacy, a cleared bio) otherwise gives no
  // sign it worked, which reads as a broken button.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Seed the form once real server state arrives (not on every refetch,
  // or a background refresh would stomp in-progress edits).
  useEffect(() => {
    if (!seeded && me.data) {
      setUsername(profile?.username ?? "");
      setBio(profile?.bio ?? "");
      setLocation(profile?.location ?? "");
      setIsPrivate(profile?.is_private ?? false);
      setSeeded(true);
    }
  }, [seeded, me.data, profile]);

  // Hand the preview back to the server's URL as soon as the upload has
  // actually landed (avatar_url carries ?v=N, so it changes every upload).
  // Holding the local file forever meant a picture that failed server-side
  // still LOOKED applied until the next cold start — the screen was showing
  // the file we'd read, not the avatar anyone else would see.
  const serverAvatar = profile?.avatar_url ?? null;
  const lastServerAvatar = React.useRef(serverAvatar);
  useEffect(() => {
    if (serverAvatar !== lastServerAvatar.current) {
      lastServerAvatar.current = serverAvatar;
      setPickedUri(null);
    }
  }, [serverAvatar]);

  const save = useUpsertProfile();
  const upload = useUploadAvatar();
  const deactivate = useDeactivateCommunity();
  const busy = save.isPending || deactivate.isPending;

  const pickAvatar = async () => {
    Haptics.selectionAsync().catch(() => {});
    let picker: typeof import("expo-image-picker");
    try {
      picker = await import("expo-image-picker");
    } catch {
      Alert.alert(
        "Almost there",
        "Changing your photo needs the next app update — everything else works now.",
      );
      return;
    }
    try {
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      // Show the picked photo IMMEDIATELY — waiting for the round trip made
      // a successful change look like nothing happened.
      setPickedUri(asset.uri);
      setPhotoSaved(false);
      upload.mutate(
        { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" },
        {
          onSuccess: () => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
            setError(null);
            setPhotoSaved(true);
          },
          onError: (e) => {
            setPickedUri(null);
            setError(`Couldn't upload the photo: ${e.message}. Try again.`);
          },
        },
      );
    } catch (e) {
      // Tell the truth — a picker error is not "update the app".
      setError(
        `Couldn't open your photo library: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  // Editing anything invalidates the "Saved" confirmation — a stale tick
  // next to unsaved edits is worse than no tick.
  useEffect(() => {
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, bio, location, isPrivate]);

  const onSave = () => {
    const handle = username.trim();
    if (!USERNAME_RE.test(handle)) {
      setError(
        "Usernames are 3–30 characters: letters, numbers, dots or underscores.",
      );
      return;
    }
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    save.mutate(
      {
        username: handle,
        bio: bio.trim() || null,
        location: location.trim() || null,
        is_private: isPrivate,
      },
      {
        onSuccess: (saved) => {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
          // Re-seed from the mutation's OWN response, which is the freshest
          // truth there is. Flipping `seeded` instead re-ran the seeding
          // effect against the still-stale cached profile, so the form
          // visibly snapped back to the old values until the refetch
          // landed — indistinguishable from "my changes didn't save".
          setUsername(saved.username);
          setBio(saved.bio ?? "");
          setLocation(saved.location ?? "");
          setIsPrivate(saved.is_private);
          setSavedAt(Date.now());
          // Saving is the end of the task: go look at the result. Staying on
          // the form made a successful save feel like nothing happened.
          // Claiming a handle for the FIRST time stays put, because the rest
          // of the form (photo, bio, privacy) is the natural next step.
          if (profile) router.replace(routes.myProfile());
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const onLeave = () => {
    if (!armedLeave) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setArmedLeave(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
    deactivate.mutate(undefined, {
      onSuccess: () => router.replace(routes.community()),
      onError: (e) => setError(e.message),
    });
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg-base">
      {/* Header — same bar as the regular settings sub-pages. */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="-ml-1 h-9 w-9 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={p.ink.default} />
        </Pressable>
        <Text className="text-base font-semibold tracking-tight text-ink">
          Community
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero — large title + the avatar bubble (tap to change photo). */}
        <View className="flex-row items-center justify-between px-5 pb-4 pt-1">
          <Text className="text-[40px] font-bold tracking-tight text-ink">
            Profile
          </Text>
          <Pressable
            onPress={pickAvatar}
            disabled={upload.isPending || !profile}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            style={{ position: "relative" }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{ borderWidth: 2, borderColor: p.accent.mint, padding: 2 }}
            >
              <SocialAvatar
                handle={profile?.username ?? (username || "?")}
                url={pickedUri ?? profile?.avatar_url}
                size={48}
              />
            </View>
            {profile ? (
              <View
                className="absolute items-center justify-center rounded-full"
                style={{
                  right: -2,
                  bottom: -2,
                  width: 22,
                  height: 22,
                  backgroundColor: p.accent.mint,
                }}
              >
                {upload.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color="#06140d"
                    style={{ transform: [{ scale: 0.6 }] }}
                  />
                ) : (
                  <Camera size={12} color="#06140d" strokeWidth={2.6} />
                )}
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* The photo saves itself the moment it's picked — say so, or a
            successful change looks like nothing happened. */}
        {photoSaved ? (
          <Text
            className="px-5 pb-2 text-[12px] font-semibold"
            style={{ color: p.accent.mint }}
          >
            Photo updated — it may take a minute to show everywhere.
          </Text>
        ) : upload.isPending ? (
          <Text className="px-5 pb-2 text-[12px] text-ink-dim">
            Uploading photo…
          </Text>
        ) : null}

        {me.isLoading && !seeded ? (
          <View className="items-center py-16">
            <ActivityIndicator color={p.ink.dim} />
          </View>
        ) : (
          <>
            {!profile ? (
              <Text className="px-5 pb-4 text-[13px] leading-[18px] text-ink-muted">
                Pick a username so other collectors can find and follow you.
              </Text>
            ) : null}

            {/* Identity fields — hairline rows, same rhythm as Settings. */}
            <View className="border-t border-line">
              <FieldRow label="Username">
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. jeffcollects"
                  placeholderTextColor={p.ink.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="text-[17px] font-semibold text-ink"
                />
              </FieldRow>
              <FieldRow label="Bio">
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="What do you collect?"
                  placeholderTextColor={p.ink.muted}
                  multiline
                  maxLength={280}
                  className="text-[15px] text-ink"
                  style={{ minHeight: 44, textAlignVertical: "top" }}
                />
              </FieldRow>
              <FieldRow label="Location">
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Region (optional)"
                  placeholderTextColor={p.ink.muted}
                  className="text-[15px] text-ink"
                />
              </FieldRow>

              {/* Privacy toggle. */}
              <View className="flex-row items-center gap-3 border-b border-line px-5 py-5">
                <View className="flex-1">
                  <Text className="text-[17px] font-semibold text-ink">
                    Private account
                  </Text>
                  <Text className="mt-1 text-[13px] leading-[18px] text-ink-muted">
                    People must request to follow you before they can see your
                    collection.
                  </Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={(v) => {
                    Haptics.selectionAsync().catch(() => {});
                    setIsPrivate(v);
                  }}
                  trackColor={{
                    true: p.accent.mint,
                    false: withAlpha(p.ink.dim, 0.25),
                  }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {error ? (
              <Text
                className="px-5 pt-3 text-[13px] font-semibold"
                style={{ color: p.accent.rose }}
              >
                {error}
              </Text>
            ) : null}

            {savedAt ? (
              <View className="flex-row items-center gap-1.5 px-5 pt-3">
                <Check size={14} color={p.accent.mint} strokeWidth={3} />
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: p.accent.mint }}
                >
                  Saved
                </Text>
              </View>
            ) : null}

            <View className="px-5 pt-5">
              <Pressable
                onPress={onSave}
                disabled={busy}
                accessibilityRole="button"
                className="h-12 items-center justify-center rounded-full"
                style={{
                  backgroundColor: p.accent.mint,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {save.isPending ? (
                  <ActivityIndicator color="#06140d" />
                ) : (
                  <Text className="text-[15px] font-extrabold" style={{ color: "#06140d" }}>
                    {profile ? "Save changes" : "Claim username"}
                  </Text>
                )}
              </Pressable>
            </View>

            {profile ? (
              <>
                {/* Jump to the public view of me. */}
                <View className="mt-6 border-t border-line">
                  <Pressable
                    onPress={() => router.push(routes.myProfile())}
                    accessibilityRole="button"
                    accessibilityLabel="View my public profile"
                    style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                  >
                    <View className="flex-row items-center gap-3 border-b border-line px-5 py-5">
                      <View className="flex-1">
                        <Text className="text-[17px] font-semibold text-ink">
                          View my profile
                        </Text>
                        <Text className="mt-1 text-[13px] leading-[18px] text-ink-muted">
                          Exactly what other collectors see
                        </Text>
                      </View>
                      <ChevronRight size={18} color={p.ink.dim} />
                    </View>
                  </Pressable>

                  {/* Deactivate — two-tap arm, no popup (house rule). */}
                  <Pressable
                    onPress={busy ? undefined : onLeave}
                    accessibilityRole="button"
                    accessibilityLabel="Deactivate my community profile"
                    style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                  >
                    <View
                      className="flex-row items-center gap-3 border-b border-line px-5 py-5"
                      style={
                        armedLeave
                          ? { backgroundColor: withAlpha(p.accent.rose, 0.08) }
                          : null
                      }
                    >
                      <View className="flex-1">
                        <Text
                          className="text-[17px] font-semibold"
                          style={{ color: p.accent.rose }}
                        >
                          {armedLeave
                            ? "Tap again to leave the community"
                            : "Deactivate community profile"}
                        </Text>
                        <Text className="mt-1 text-[13px] leading-[18px] text-ink-muted">
                          Removes your profile, followers and follows. Your
                          vault and Loupe account are untouched — rejoin
                          anytime.
                        </Text>
                      </View>
                      {deactivate.isPending ? (
                        <ActivityIndicator color={p.accent.rose} />
                      ) : (
                        <LogOut size={16} color={p.accent.rose} strokeWidth={2.4} />
                      )}
                    </View>
                  </Pressable>
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Label-over-input row with the settings page's hairline rhythm. */
function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="border-b border-line px-5 py-4">
      <Text className="pb-1 text-[12px] font-semibold uppercase tracking-[1.5px] text-ink-dim">
        {label}
      </Text>
      {children}
    </View>
  );
}
