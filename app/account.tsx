/**
 * Account — the details Loupe holds about YOU, as opposed to the profile
 * other collectors see (that's /community-settings).
 *
 * The split matters: a display name here is what appears on a receipt and a
 * statement PDF; the handle, bio and avatar over there are the public face.
 * Folding them into one screen would put "who can see my collection" next
 * to "which email gets the invoice", and neither question would be easy to
 * find.
 *
 * Email is read-only. Changing the address on an account is an
 * identity change — it needs verification at the new address and a notice
 * to the old one, or it's an account-takeover primitive. Until that flow
 * exists, showing an editable field that silently can't be saved would be
 * worse than showing the truth.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  BadgeCheck,
  ChevronLeft,
  Mail,
  Phone,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react-native";
import { useMe, useUpdateProfile } from "@/application/queries";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export default function AccountScreen() {
  const p = useThemedPalette();
  const me = useMe();
  const update = useUpdateProfile();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The server hands back a MASKED phone, which must never be echoed into
  // the input — submitting "+1 ••• ••• 0123" back would either fail
  // validation or, worse, store the bullets. The field starts empty and the
  // number on file is shown beside it as a fact, not as an editable value.
  useEffect(() => {
    if (me.data) setName(me.data.display_name ?? "");
  }, [me.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = me.data?.phone ?? null;
  const nameChanged = (me.data?.display_name ?? "") !== name.trim();
  const phoneChanged = phone.trim().length > 0;
  const canSave = (nameChanged || phoneChanged) && !update.isPending;

  const save = () => {
    if (!canSave) return;
    setError(null);
    Haptics.selectionAsync().catch(() => {});
    update.mutate(
      {
        ...(nameChanged ? { display_name: name.trim() || null } : {}),
        ...(phoneChanged ? { phone: phone.trim() } : {}),
      },
      {
        onSuccess: () => {
          setPhone("");
          setSaved(true);
          setTimeout(() => setSaved(false), 2200);
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  const removePhone = () => {
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    update.mutate(
      { phone: null },
      { onSuccess: () => setPhone(""), onError: (e) => setError(e.message) },
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <View className="flex-row items-center gap-1 px-2 pb-1 pt-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color={p.ink.default} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pb-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Your details
          </Text>
          <Text className="mt-1 text-[28px] font-bold tracking-tight text-ink">
            Account
          </Text>
          <Text className="mt-1 text-[13px] text-ink-muted">
            Private to you. Your public profile lives in Community settings.
          </Text>
        </View>

        <Field icon={UserIcon} label="Display name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="How receipts and statements address you"
            placeholderTextColor={p.ink.muted}
            className="text-[17px] font-semibold text-ink"
            accessibilityLabel="Display name"
          />
        </Field>

        <Field icon={Mail} label="Email">
          <Text className="text-[17px] font-semibold" style={{ color: p.ink.muted }}>
            {me.data?.email ?? "—"}
          </Text>
          <Text className="mt-1 text-[12px]" style={{ color: p.ink.dim }}>
            Changing this needs verification at the new address — contact
            support.
          </Text>
        </Field>

        <Field icon={Phone} label="Phone">
          {onFile ? (
            <View className="mb-2 flex-row items-center gap-2">
              <Text
                className="text-[17px] font-semibold"
                style={{ color: p.ink.default }}
              >
                {onFile}
              </Text>
              {me.data?.phone_verified ? (
                <BadgeCheck size={15} color={p.accent.mint} strokeWidth={2.5} />
              ) : null}
              <Pressable
                onPress={removePhone}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove phone number"
              >
                <Text className="text-[13px] font-bold" style={{ color: p.accent.rose }}>
                  Remove
                </Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              if (error) setError(null);
            }}
            placeholder={onFile ? "Replace with a new number" : "(415) 555-0123"}
            placeholderTextColor={p.ink.muted}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            className="text-[17px] font-semibold text-ink"
            accessibilityLabel="Phone number"
          />
          <Text className="mt-1.5 text-[12px]" style={{ color: p.ink.dim }}>
            Type it however you like — we store one standard format. Used for
            account recovery and security alerts. Never shown to other
            collectors.
          </Text>
        </Field>

        {error ? (
          <View
            className="mx-5 mt-4 flex-row items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: withAlpha(p.accent.rose, 0.12) }}
          >
            <ShieldAlert size={15} color={p.accent.rose} />
            <Text
              className="flex-1 text-[13px] font-semibold leading-[18px]"
              style={{ color: p.accent.rose }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <View className="mt-6 px-5">
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save account details"
            className="items-center rounded-full py-3.5"
            style={{
              backgroundColor: canSave
                ? p.accent.mint
                : withAlpha(p.ink.default, 0.08),
            }}
          >
            {update.isPending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <Text
                className="text-[15px] font-extrabold"
                style={{ color: canSave ? "#06140d" : p.ink.dim }}
              >
                {saved ? "Saved" : "Save changes"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserIcon;
  label: string;
  children: React.ReactNode;
}) {
  const p = useThemedPalette();
  return (
    <View className="border-b border-line px-5 py-4">
      <View className="flex-row items-center gap-1.5 pb-1.5">
        <Icon size={13} color={p.ink.dim} strokeWidth={2.2} />
        <Text className="text-[12px] font-semibold uppercase tracking-[1.5px] text-ink-dim">
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}
