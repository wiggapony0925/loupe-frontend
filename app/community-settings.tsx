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
import { Camera, ChevronLeft, ChevronRight, LogOut } from "lucide-react-native";
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
  const [armedLeave, setArmedLeave] = useState(false);
  const [seeded, setSeeded] = useState(false);

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

  const save = useUpsertProfile();
  const upload = useUploadAvatar();
  const deactivate = useDeactivateCommunity();
  const busy = save.isPending || deactivate.isPending;

  const dirty =
    seeded &&
    (username.trim() !== (profile?.username ?? "") ||
      bio.trim() !== (profile?.bio ?? "") ||
      location.trim() !== (profile?.location ?? "") ||
      isPrivate !== (profile?.is_private ?? false));

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
      upload.mutate(
        { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" },
        { onError: (e) => setError(e.message) },
      );
    } catch {
      Alert.alert(
        "Almost there",
        "Changing your photo needs the next app update — everything else works now.",
      );
    }
  };

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
        onSuccess: () => {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
          setSeeded(false); // re-seed from the fresh server state
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
                url={profile?.avatar_url}
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

            {/* Save — appears only when something changed. */}
            <View className="px-5 pt-5">
              <Pressable
                onPress={onSave}
                disabled={busy || (!dirty && !!profile)}
                accessibilityRole="button"
                className="h-12 items-center justify-center rounded-full"
                style={{
                  backgroundColor: p.accent.mint,
                  opacity: busy ? 0.6 : !dirty && profile ? 0.35 : 1,
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
