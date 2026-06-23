/**
 * Developer portal (mobile) — embeds the React web admin in a WebView, already
 * authenticated as the signed-in admin. The mobile session token is injected
 * into the web app's localStorage before its JS runs, so the portal boots
 * straight into the dashboard. Admin-gated; non-admins see a notice.
 */
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { config } from "@/shared/config";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function AdminPortalScreen() {
  const p = useThemedPalette();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const webRef = useRef<WebView>(null);

  const adminUrl = `${config.webUrl}/admin?embed=admin`;

  // Runs before the web app's own scripts: seed the access token so the
  // embedded AuthProvider hydrates an authenticated session immediately, and
  // flag embedded mode so the web app locks itself to /admin (hides escape
  // links + bounces non-admin routes — see loupe-web `EmbeddedGuard`).
  const injectedBefore = useMemo(() => {
    const tokenLine = token
      ? `try { window.localStorage.setItem('loupe.auth.token', ${JSON.stringify(token)}); } catch (e) {}`
      : "";
    return `
      try { window.sessionStorage.setItem('loupe.embed', 'admin'); } catch (e) {}
      ${tokenLine}
      true;
    `;
  }, [token]);

  // Confine the WebView to the /admin section: block any hard navigation (full
  // page loads, external links, OAuth pop-outs) that isn't a same-origin
  // /admin URL. Client-side route changes are handled by the web EmbeddedGuard.
  const allowOnlyAdmin = (request: { url: string }): boolean => {
    try {
      const u = new URL(request.url);
      const base = new URL(config.webUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") return true; // about:blank, data:
      if (u.origin !== base.origin) return false; // external origin
      return u.pathname === "/admin" || u.pathname.startsWith("/admin/");
    } catch {
      return false;
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg.base }}>
        <View style={styles.center}>
          <Text style={{ color: p.ink.default, fontSize: 18, fontWeight: "700" }}>
            Not authorized
          </Text>
          <Text style={{ color: p.ink.muted, marginTop: 8, textAlign: "center" }}>
            The developer portal is available to admin accounts only.
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: p.accent.mint, fontWeight: "700" }}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg.base }} edges={["top"]}>
      <View
        style={[styles.header, { borderBottomColor: p.line.default }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: p.accent.mint, fontSize: 16, fontWeight: "700" }}>Done</Text>
        </Pressable>
        <Text style={{ color: p.ink.default, fontSize: 17, fontWeight: "700" }}>
          Developer portal
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          source={{ uri: adminUrl }}
          injectedJavaScriptBeforeContentLoaded={injectedBefore}
          onShouldStartLoadWithRequest={allowOnlyAdmin}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState={false}
          originWhitelist={["*"]}
          style={{ flex: 1, backgroundColor: p.bg.base }}
        />
        {loading ? (
          <View style={[StyleSheet.absoluteFillObject, styles.center, { backgroundColor: p.bg.base }]}>
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
