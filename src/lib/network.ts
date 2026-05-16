/**
 * Network connectivity — singleton listener around NetInfo.
 *
 * Exposes a small Zustand-style snapshot subscribed via `useSyncExternalStore`
 * so any component (banner, scanner, hook) can react to connectivity flips
 * without us hand-rolling re-render plumbing. Falls back to "online" when
 * NetInfo is unavailable (e.g. web builds or before native init).
 */

import { useEffect, useSyncExternalStore } from "react";

type ConnectionType = "wifi" | "cellular" | "none" | "unknown";

type Snapshot = {
  isConnected: boolean;
  type: ConnectionType;
};

type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string;
};

// Lazy module load so non-RN targets (and bundler edge cases) survive.
type NetInfoModule = {
  addEventListener: (cb: (state: NetInfoState) => void) => () => void;
  fetch: () => Promise<NetInfoState>;
};

let netInfo: NetInfoModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  netInfo = require("@react-native-community/netinfo").default as NetInfoModule;
} catch {
  netInfo = null;
}

let snapshot: Snapshot = { isConnected: true, type: "unknown" };
const listeners = new Set<() => void>();
let started = false;

function mapType(t: string | undefined): ConnectionType {
  if (t === "wifi") return "wifi";
  if (t === "cellular") return "cellular";
  if (t === "none" || t === "unknown") return t;
  return "unknown";
}

function setSnapshot(next: Snapshot) {
  if (next.isConnected === snapshot.isConnected && next.type === snapshot.type) return;
  snapshot = next;
  for (const l of listeners) l();
}

function ensureStarted() {
  if (started || !netInfo) return;
  started = true;
  void netInfo.fetch().then((s) => {
    setSnapshot({
      isConnected: s.isConnected !== false && s.isInternetReachable !== false,
      type: mapType(s.type),
    });
  });
  netInfo.addEventListener((s) => {
    setSnapshot({
      isConnected: s.isConnected !== false && s.isInternetReachable !== false,
      type: mapType(s.type),
    });
  });
}

function subscribe(cb: () => void): () => void {
  ensureStarted();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getServerSnapshot(): Snapshot {
  return snapshot;
}

export function useIsOnline(): boolean {
  const s = useSyncExternalStore(subscribe, () => snapshot, getServerSnapshot);
  return s.isConnected;
}

export function useConnectionType(): ConnectionType {
  const s = useSyncExternalStore(subscribe, () => snapshot, getServerSnapshot);
  return s.type;
}

export async function waitForOnline(timeoutMs = 8000): Promise<boolean> {
  if (snapshot.isConnected) return true;
  ensureStarted();
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      listeners.delete(check);
      resolve(false);
    }, timeoutMs);
    const check = () => {
      if (snapshot.isConnected) {
        clearTimeout(timer);
        listeners.delete(check);
        resolve(true);
      }
    };
    listeners.add(check);
  });
}

/** Convenience: imperative flag without subscribing. */
export function isOnlineNow(): boolean {
  ensureStarted();
  return snapshot.isConnected;
}

/** Internal: register a listener for use in non-hook code. */
export function useNetworkEffect(cb: (online: boolean) => void): void {
  useEffect(() => {
    return subscribe(() => cb(snapshot.isConnected));
  }, [cb]);
}
