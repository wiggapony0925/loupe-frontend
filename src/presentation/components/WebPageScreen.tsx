/**
 * WebPageScreen — bundles a Loupe web page into the app as a native-chromed
 * WebView screen (the same pattern as the developer portal). A themed header
 * with a "Done" affordance sits above the embedded page; an optional token
 * injection seeds the web app's auth so account-aware pages boot signed-in.
 *
 * Used for pages we don't (yet) have a native screen for — Support (/help),
 * the device scanner (/scanner), etc. — so they ship in-app without a separate
 * native rewrite.
 */
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { config } from "@/shared/config";
import { useThemedPalette } from "@/presentation/theme/tokens";

export interface WebPageScreenProps {
  /** Header title. */
  title: string;
  /** Web route to embed, e.g. "/help" or "/scanner". */
  path: string;
  /**
   * Seed the signed-in token into the web app's localStorage before its JS
   * runs, so account-aware pages render authenticated. Default false (public
   * pages don't need it).
   */
  injectToken?: boolean;
}

export function WebPageScreen({ title, path, injectToken = false }: WebPageScreenProps) {
  const p = useThemedPalette();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const webRef = useRef<WebView>(null);

  const uri = `${config.webUrl}${path}`;

  // Runs before the web app's own scripts (mirrors the dev-portal screen).
  const injectedBefore = useMemo(() => {
    if (!injectToken || !token) return "true;";
    return `
      try { window.localStorage.setItem('loupe.auth.token', ${JSON.stringify(token)}); } catch (e) {}
      true;
    `;
  }, [injectToken, token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg.base }} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: p.line.default }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: p.accent.mint, fontSize: 16, fontWeight: "700" }}>
            Done
          </Text>
        </Pressable>
        <Text style={{ color: p.ink.default, fontSize: 17, fontWeight: "700" }}>
          {title}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          source={{ uri }}
          injectedJavaScriptBeforeContentLoaded={injectedBefore}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState={false}
          originWhitelist={["*"]}
          style={{ flex: 1, backgroundColor: p.bg.base }}
        />
        {loading ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              styles.center,
              { backgroundColor: p.bg.base },
            ]}
          >
            <ActivityIndicator color={p.accent.mint} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
