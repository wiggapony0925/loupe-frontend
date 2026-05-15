import { create } from "zustand";
import type { ConnectionTransport } from "@/types/domain";

interface ScannerState {
  transport: ConnectionTransport;
  isScanning: boolean;
  lastScanId: string | null;
  /**
   * If the user initiated this scan from a market detail page, the catalog
   * id is parked here for the lifetime of the scan. The forensic report
   * screen reads it to render the "Compared to market: …" cross-link, and
   * `finishScan` clears it as soon as the report is ready.
   */
  pendingMarketCardId: string | null;
  setTransport: (t: ConnectionTransport) => void;
  startScan: (opts?: { marketCardId?: string | null }) => void;
  finishScan: (reportId: string) => void;
}

// Ephemeral device/UI state. Server data lives in TanStack Query, not here.
export const useScannerStore = create<ScannerState>((set) => ({
  transport: "ble",
  isScanning: false,
  lastScanId: null,
  pendingMarketCardId: null,
  setTransport: (transport) => set({ transport }),
  startScan: (opts) =>
    set({ isScanning: true, pendingMarketCardId: opts?.marketCardId ?? null }),
  finishScan: (lastScanId) =>
    set({ isScanning: false, lastScanId, pendingMarketCardId: null }),
}));
