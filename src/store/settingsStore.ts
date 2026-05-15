import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "dark" | "light" | "system";
/**
 * ISO-4217 fiat code or crypto symbol. See `src/lib/currency.ts` for the
 * authoritative catalog (USD/EUR/GBP/JPY/… plus BTC/ETH/SOL/USDC/…).
 */
export type Currency = string;

interface SettingsState {
  // Appearance
  themeMode: ThemeMode;
  // General
  currency: Currency;
  hapticsEnabled: boolean;
  // Capture
  autoOcr: boolean;
  qualityGate: boolean;
  // Notifications
  scanCompleteAlerts: boolean;
  priceDropAlerts: boolean;

  setThemeMode: (m: ThemeMode) => void;
  setCurrency: (c: Currency) => void;
  toggleHaptics: () => void;
  toggleAutoOcr: () => void;
  toggleQualityGate: () => void;
  toggleScanCompleteAlerts: () => void;
  togglePriceDropAlerts: () => void;
  reset: () => void;
}

const DEFAULTS = {
  themeMode: "dark" as ThemeMode,
  currency: "USD" as Currency,
  hapticsEnabled: true,
  autoOcr: true,
  qualityGate: true,
  scanCompleteAlerts: true,
  priceDropAlerts: false,
};

/**
 * User preferences persisted to AsyncStorage. Survives app restarts.
 * Keep this minimal — only stuff a human user toggles in Settings.
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setThemeMode: (m) => set({ themeMode: m }),
      setCurrency: (c) => set({ currency: c }),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      toggleAutoOcr: () => set((s) => ({ autoOcr: !s.autoOcr })),
      toggleQualityGate: () => set((s) => ({ qualityGate: !s.qualityGate })),
      toggleScanCompleteAlerts: () => set((s) => ({ scanCompleteAlerts: !s.scanCompleteAlerts })),
      togglePriceDropAlerts: () => set((s) => ({ priceDropAlerts: !s.priceDropAlerts })),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: "loupe.settings.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
