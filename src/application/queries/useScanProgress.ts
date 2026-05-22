import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { ScanProgressEvent } from "@/infrastructure/http";

type Status = "connecting" | "open" | "closed" | "unreachable";

// Backoff: cap exponent at 6 (=> 64s) and give up entirely after this many
// consecutive failures so a permanently-down backend doesn't drain battery.
const MAX_RECONNECT_ATTEMPTS = 8;

const env = (process.env ?? {}) as Record<string, string | undefined>;

function deriveWsBase(): string {
  const explicit = env.EXPO_PUBLIC_WS_URL;
  if (explicit) return explicit;
  return apiBaseUrl.replace(/^http/i, "ws");
}

/**
 * Subscribe to `/ws/scans` with exponential-backoff reconnect.
 * Returns the rolling list of events (most-recent last) + current status.
 * Closes the socket on unmount.
 */
export function useScanProgress(): { events: ScanProgressEvent[]; status: Status } {
  const { token, isAuthenticated } = useAuth();
  const [events, setEvents] = useState<ScanProgressEvent[]>([]);
  const [status, setStatus] = useState<Status>("closed");
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setStatus("closed");
      return;
    }
    cancelledRef.current = false;

    const connect = () => {
      if (cancelledRef.current) return;
      setStatus("connecting");
      const base = deriveWsBase();
      const url = `${base}${ENDPOINTS.ws.scans}?token=${encodeURIComponent(token)}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
      };
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as ScanProgressEvent;
          setEvents((prev) => [...prev.slice(-49), payload]);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onerror = () => {
        /* surfaced through onclose */
      };
      ws.onclose = () => {
        setStatus("closed");
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelledRef.current) return;
      if (retryRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus("unreachable");
        return;
      }
      const attempt = retryRef.current + 1;
      retryRef.current = attempt;
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 6), 30_000);
      setTimeout(connect, delay);
    };

    connect();

    return () => {
      cancelledRef.current = true;
      try {
        socketRef.current?.close();
      } catch {
        /* noop */
      }
      socketRef.current = null;
    };
  }, [token, isAuthenticated]);

  return { events, status };
}
