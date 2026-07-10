/**
 * Zustand stores — client-side state slices.
 *
 *   - `scannerStore`        Scanner connection state (transport, device, firmware)
 *   - `settingsStore`       User prefs (theme, currency, haptics, OCR, alerts) — persisted
 *   - `vaultStore`          Vault filters (set, minGrade, type) — transient
 *   - `vaultSelectionStore` Vault multi-select + island chrome handlers — transient
 */

export * from "./scannerStore";
export * from "./settingsStore";
export * from "./vaultStore";
export * from "./vaultSelectionStore";
