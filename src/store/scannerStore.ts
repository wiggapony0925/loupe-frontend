import { create } from "zustand";
import type { ConnectionTransport } from "@/types/domain";

interface ScannerState {
  transport: ConnectionTransport;
  isScanning: boolean;
  lastScanId: string | null;
  setTransport: (t: ConnectionTransport) => void;
  startScan: () => void;
  finishScan: (reportId: string) => void;
}

// Ephemeral device/UI state. Server data lives in TanStack Query, not here.
export const useScannerStore = create<ScannerState>((set) => ({
  transport: "ble",
  isScanning: false,
  lastScanId: null,
  setTransport: (transport) => set({ transport }),
  startScan: () => set({ isScanning: true }),
  finishScan: (lastScanId) => set({ isScanning: false, lastScanId }),
}));
