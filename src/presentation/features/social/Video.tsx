/**
 * Video, or an honest stand-in when this build can't play it.
 *
 * The one entry point every surface uses. It resolves the native player
 * lazily — `require` is not evaluated until called, so a binary without
 * `expo-video` never loads it and never throws. See `videoSupport.ts`.
 *
 * The fallback is deliberately not silent. A blank box would read as a
 * broken post; saying "update to watch" names the actual situation and the
 * actual fix, and the poster underneath still shows what the clip is of.
 */
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Play } from "lucide-react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import type { NativeVideoProps } from "./NativeVideo";
import { canPlayVideo } from "./videoSupport";

let Impl: React.ComponentType<NativeVideoProps> | null | undefined;

function resolve(): React.ComponentType<NativeVideoProps> | null {
  if (Impl !== undefined) return Impl;
  if (!canPlayVideo()) {
    Impl = null;
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Impl = (require("./NativeVideo") as typeof import("./NativeVideo")).NativeVideo;
  return Impl;
}

export function Video(props: NativeVideoProps) {
  const Player = resolve();
  if (Player) return <Player {...props} />;
  return <Unsupported style={props.style} />;
}

function Unsupported({ style }: { style?: ViewStyle }) {
  const p = useThemedPalette();
  return (
    <View style={[styles.wrap, style ?? StyleSheet.absoluteFill]}>
      <View style={styles.badge}>
        <Play size={20} color="#fff" fill="#fff" />
      </View>
      <Text style={styles.text}>Update Loupe to watch videos</Text>
      <Text style={[styles.sub, { color: p.ink.dim }]}>
        This build can't play video yet.
      </Text>
    </View>
  );
}

export { canPlayVideo };

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badge: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  text: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  sub: { fontSize: 11.5, fontWeight: "600" },
});
