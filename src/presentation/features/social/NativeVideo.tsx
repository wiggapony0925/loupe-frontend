/**
 * The real player. **Never import this module directly** — go through
 * `Video.tsx`, which only reaches it on builds that ship `expo-video`.
 *
 * Everything native lives behind this file boundary on purpose: in Metro a
 * module isn't evaluated until it's `require`d, so as long as nothing on
 * the common path imports this one, an older binary never touches
 * `expo-video` at all. See `videoSupport.ts` for why that matters.
 */
import React, { useEffect } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

export interface NativeVideoProps {
  uri: string;
  style?: ViewStyle;
  loop?: boolean;
  muted?: boolean;
  /** Playing or held. Held covers pause, a sheet on top, and off-screen. */
  paused?: boolean;
  contentFit?: "cover" | "contain";
}

export function NativeVideo({
  uri,
  style,
  loop = true,
  muted = true,
  paused = false,
  contentFit = "cover",
}: NativeVideoProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
  });

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  // Mute is changed on the live instance rather than by re-creating the
  // player: recreating restarts the clip, so unmuting would jump back to
  // the first frame — the single most annoying thing a feed player does.
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <VideoView
      style={style ?? StyleSheet.absoluteFill}
      player={player}
      contentFit={contentFit}
      nativeControls={false}
    />
  );
}
