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
import { useTheme } from "@/presentation/theme";

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
  /**
   * Same-origin path prefixes the WebView may navigate to. Defaults to the
   * screen's `path`. Any hard navigation outside these (other app sections,
   * external origins) is blocked, so the bundled page can't roam the whole app.
   */
  confinePaths?: string[];
  /**
   * Embed scope handed to the web app (`?embed=`). "app" makes the web shell
   * hide its own chrome (TopBar / tab bar / public header+footer) and render
   * content edge-to-edge, so the native screen provides the chrome — the
   * YouTube-in-app pattern. Default "app".
   */
  embed?: "app" | "admin";
  /** Hide the native header (for tab-level surfaces with their own title). */
  showHeader?: boolean;
}

export function WebPageScreen({
  title,
  path,
  injectToken = false,
  confinePaths,
  embed = "app",
  showHeader = true,
}: WebPageScreenProps) {
  const p = useThemedPalette();
  const { scheme } = useTheme();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const webRef = useRef<WebView>(null);

  const sep = path.includes("?") ? "&" : "?";
  const uri = `${config.webUrl}${path}${sep}embed=${embed}`;

  // Runs before the web app's own scripts (mirrors the dev-portal screen):
  // seed embed scope + native theme + (optionally) the session token so the
  // page boots chrome-less, in-scheme, and signed in.
  const injectedBefore = useMemo(() => {
    const tokenLine =
      injectToken && token
        ? `try { window.localStorage.setItem('loupe.auth.token', ${JSON.stringify(token)}); } catch (e) {}`
        : "";
    return `
      try { window.sessionStorage.setItem('loupe.embed', ${JSON.stringify(embed)}); } catch (e) {}
      try { window.localStorage.setItem('loupe.theme', ${JSON.stringify(scheme)}); document.documentElement.setAttribute('data-theme', ${JSON.stringify(scheme)}); } catch (e) {}
      ${tokenLine}
      true;
    `;
  }, [embed, injectToken, scheme, token]);

  // Confine hard navigations to the page's own section + same origin. Blocks
  // links that would leave the bundled page for the rest of the app or an
  // external site.
  const allowed = confinePaths ?? [path];
  const onShouldStart = (request: { url: string }): boolean => {
    try {
      const u = new URL(request.url);
      const base = new URL(config.webUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") return true; // about:blank, data:
      if (u.origin !== base.origin) return false; // external origin
      return allowed.some(
        (a) => u.pathname === a || u.pathname.startsWith(`${a}/`),
      );
    } catch {
      return false;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg.base }} edges={["top"]}>
      {showHeader && (
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
      )}

      <View style={{ flex: 1 }}>
        <WebView
          ref={webRef}
          source={{ uri }}
          injectedJavaScriptBeforeContentLoaded={injectedBefore}
          onShouldStartLoadWithRequest={onShouldStart}
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
