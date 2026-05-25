/**
 * `/watchlist` — deep-link target for the price-alert list.
 *
 * The Watch tab was retired (Scan took its tab slot); the canonical
 * surface for "what am I watching?" now lives under the bell, inside
 * the Notifications screen's [Inbox | Watching] segmented control.
 * This route stays around so push notifications and existing share
 * links that point at `/watchlist` still resolve.
 */
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { WatchingList } from "@/presentation/features/watchlist/WatchingList";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function WatchlistScreen() {
  const p = useThemedPalette();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <WatchingList />
    </SafeAreaView>
  );
}
