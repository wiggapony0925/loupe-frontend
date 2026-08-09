/**
 * PostMedia — a post's photos, edge to edge.
 *
 * Two decisions worth naming:
 *
 * **The frame is sized before the bytes arrive.** The server ships each
 * image's intrinsic width/height, so the container's height is known at
 * first render. Without it every image in a scrolling feed resizes its own
 * row as it decodes and shoves everything below it down — the single most
 * visible jank a feed can have.
 *
 * **Aspect is clamped, not obeyed.** A 9:21 screenshot would otherwise take
 * three screens on its own. Portrait is capped at 4:5 and landscape at 1.91:1
 * — Instagram's bounds — with the image cropped to fill, which is what a
 * feed reader expects.
 *
 * Edge-to-edge is the house rule for every horizontal surface in this app
 * (see the mobile-UI standing rule), so the carousel bleeds past the screen's
 * padding rather than sitting inside it.
 */
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { ScrollView } from "react-native-gesture-handler";
import type { PostMediaWire } from "@/infrastructure/http";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Instagram's crop bounds: tallest 4:5, widest 1.91:1. */
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

export function mediaAspectRatio(media: PostMediaWire[]): number {
  const first = media[0];
  if (!first?.width || !first?.height) return 1;
  const ratio = first.width / first.height;
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

export interface PostMediaProps {
  media: PostMediaWire[];
  /** Total horizontal padding of the surrounding surface, so the carousel
   *  can bleed back out to the full screen width. */
  bleed?: number;
  onPress?: () => void;
}

export function PostMedia({ media, bleed = 0, onPress }: PostMediaProps) {
  const p = useThemedPalette();
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const first = media[0];
  if (!first) return null;

  const width = screenWidth;
  const height = Math.round(width / mediaAspectRatio(media));

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const frame = {
    width,
    height,
    marginHorizontal: -bleed / 2,
    backgroundColor: p.bg.sunken,
  };

  if (media.length === 1) {
    return (
      <Pressable onPress={onPress} disabled={!onPress} style={frame}>
        <Slide item={first} width={width} height={height} />
      </Pressable>
    );
  }

  return (
    <View style={frame}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {media.map((item) => (
          <Pressable key={item.id} onPress={onPress} disabled={!onPress}>
            <Slide item={item} width={width} height={height} />
          </Pressable>
        ))}
      </ScrollView>
      {/* Dots, not a counter: at four slides the position is easier to read
          as a shape than as "2/4". */}
      <View style={styles.dots} pointerEvents="none">
        {media.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === page ? "#fff" : withAlpha("#ffffff", 0.45),
                width: index === page ? 7 : 5,
                height: index === page ? 7 : 5,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Slide({
  item,
  width,
  height,
}: {
  item: PostMediaWire;
  width: number;
  height: number;
}) {
  return (
    <Image
      source={{ uri: absolutize(item.url) ?? undefined }}
      style={{ width, height }}
      contentFit="cover"
      transition={140}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: { borderRadius: 999 },
});
