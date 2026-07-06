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
  /**
   * Web detail links to reroute into NATIVE screens. When the user taps a
   * link matching `${webPrefix}/:id` inside the embed, the tap is swallowed
   * before the web SPA can route (capture-phase click interceptor) and the
   * native route from `toNative(id)` is pushed instead — so an embedded
   * storefront can hand card taps to the real native card page rather than
   * showing the web detail page inside the WebView.
   */
  nativeDetours?: { webPrefix: string; toNative: (id: string) => string }[];
}

export function WebPageScreen({
  title,
  path,
  injectToken = false,
  confinePaths,
  embed = "app",
  showHeader = true,
  nativeDetours,
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
    // Capture-phase click interceptor for native detours: swallow taps on
    // matching detail links BEFORE the web SPA's router sees them (no flash
    // of the web detail page, no history pollution) and hand the id to the
    // native side via postMessage. The web app's links are real <a href>
    // elements (react-router), so click capture is reliable.
    const detourPrefixes = (nativeDetours ?? []).map((d) => d.webPrefix);
    const detourLine = detourPrefixes.length
      ? `
      (function () {
        var prefixes = ${JSON.stringify(detourPrefixes)};
        document.addEventListener('click', function (e) {
          var t = e.target;
          var a = t && t.closest ? t.closest('a[href]') : null;
          if (!a) return;
          var url;
          try { url = new URL(a.getAttribute('href') || '', location.origin); } catch (err) { return; }
          if (url.origin !== location.origin) return;
          for (var i = 0; i < prefixes.length; i++) {
            var p = prefixes[i];
            if (url.pathname.indexOf(p + '/') === 0 && url.pathname.length > p.length + 1) {
              e.preventDefault();
              e.stopPropagation();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'loupe:native-detour',
                prefix: p,
                pathname: url.pathname
              }));
              return;
            }
          }
        }, true);
      })();`
      : "";
    return `
      try { window.sessionStorage.setItem('loupe.embed', ${JSON.stringify(embed)}); } catch (e) {}
      try { window.localStorage.setItem('loupe.theme', ${JSON.stringify(scheme)}); document.documentElement.setAttribute('data-theme', ${JSON.stringify(scheme)}); } catch (e) {}
      ${tokenLine}
      ${detourLine}
      true;
    `;
  }, [embed, injectToken, scheme, token, nativeDetours]);

  // Native-detour messages from the interceptor above → push the native
  // screen. Ids arrive URL-encoded (composite ids like "pokemontcg:base1-4"
  // encode the colon); decode once — the route helper re-encodes.
  const onMessage = (event: { nativeEvent: { data: string } }) => {
    if (!nativeDetours?.length) return;
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        prefix?: string;
        pathname?: string;
      };
      if (msg.type !== "loupe:native-detour" || !msg.prefix || !msg.pathname) return;
      const detour = nativeDetours.find((d) => d.webPrefix === msg.prefix);
      if (!detour) return;
      const rawId = msg.pathname.slice(msg.prefix.length + 1).split("/")[0] ?? "";
      const id = decodeURIComponent(rawId);
      if (id) router.push(detour.toNative(id));
    } catch {
      // Malformed message — ignore; the embed keeps working.
    }
  };

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
          onMessage={onMessage}
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
