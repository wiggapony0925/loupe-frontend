/**
 * usePriceTicks — live `price.tick` frames from `/ws/prices`.
 *
 * One authenticated socket while signed in. Every tick means a card the
 * user OWNS just changed price, so we refresh every holding-derived
 * cache — throttled, since a backfill sweep can tick a whole vault in
 * seconds and each surface only needs one repaint per burst.
 *
 * Reconnects with capped backoff; closes on sign-out/unmount. Silent on
 * failure — polling staleTimes remain the fallback freshness path.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl, getAuthToken } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { invalidateHoldingCaches } from "../invalidateHoldings";

const INVALIDATE_EVERY_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;

export function usePriceTicks(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastInvalidate = 0;

    const connect = () => {
      const token = getAuthToken();
      if (closed || !token) return;
      const base = getApiBaseUrl().replace(/^http/, "ws");
      ws = new WebSocket(
        `${base}${ENDPOINTS.ws.prices}?token=${encodeURIComponent(token)}`,
      );
      ws.onopen = () => {
        attempt = 0;
      };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(String(ev.data));
          if (frame?.type !== "price.tick") return;
          const now = Date.now();
          if (now - lastInvalidate < INVALIDATE_EVERY_MS) return;
          lastInvalidate = now;
          invalidateHoldingCaches(qc);
        } catch {
          // Non-JSON frame — ignore.
        }
      };
      ws.onclose = () => {
        if (closed) return;
        attempt += 1;
        const delay = Math.min(1_000 * 2 ** attempt, RECONNECT_MAX_MS);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [enabled, qc]);
}
