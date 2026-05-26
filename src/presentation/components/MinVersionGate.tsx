/**
 * Force-update gate.
 *
 * When the backend's `/v1/app/config` response signals that the running
 * client is below `minSupportedVersion`, this component takes over the
 * entire screen and asks the user to update. Until they do, the rest of
 * the app is unreachable.
 *
 * The gate is *advisory* — if the config request fails or hasn't yet
 * returned, we render `children` so the app still works offline. We
 * only block when we have a positive `forceUpdate: true` signal.
 */
import React from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppConfig } from "@/application/queries/ops/useAppConfig";
import { LoupeMark } from "@/presentation/brand/LoupeMark";

const APP_STORE_URL = "https://apps.apple.com/app/id0000000000";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.loupe.client";

export function MinVersionGate({ children }: { children: React.ReactNode }) {
  const { data } = useAppConfig();
  if (!data?.forceUpdate) {
    return <>{children}</>;
  }
  return <UpdateRequiredScreen />;
}

function UpdateRequiredScreen() {
  const onUpdate = () => {
    const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {
      /* swallow — nothing we can do if the store can't open */
    });
  };
  return (
    <LinearGradient
      colors={["#0B0B0F", "#121214", "#0B0B0F"] as const}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <View style={{ marginBottom: 24 }}>
          <LoupeMark size={56} />
        </View>
        <Text
          style={{
            color: "#F5F5F7",
            fontSize: 22,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Update required
        </Text>
        <Text
          style={{
            color: "#9CA3AF",
            fontSize: 15,
            lineHeight: 22,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          This version of Loupe can no longer talk to the backend safely.
          Please install the latest update to keep scanning and grading.
        </Text>
        <Pressable
          onPress={onUpdate}
          style={({ pressed }) => ({
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: pressed ? "#E5E7EB" : "#F5F5F7",
          })}
        >
          <Text style={{ color: "#0B0B0F", fontSize: 15, fontWeight: "600" }}>
            Open {Platform.OS === "ios" ? "App Store" : "Play Store"}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
