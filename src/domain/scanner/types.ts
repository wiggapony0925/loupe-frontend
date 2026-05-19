/**
 * Scanner aggregate — physical hardware state.
 */

/** Connection transport between the app and the scanner hardware. */
export type ConnectionTransport = "ble" | "wifi" | "offline";

/** Live snapshot of a connected scanner's health & telemetry. */
export interface HardwareStatus {
  transport: ConnectionTransport;
  deviceName: string;
  firmware: string;
  /** ISO timestamp of the scanner's last heartbeat. `null` if never seen. */
  lastSeenAt: string | null;
  /** 0..1 — `null` when the backend doesn't have live telemetry. */
  signalStrength: number | null;
  /** Remaining scans on the device's plan. `null` when unknown. */
  scansRemaining: number | null;
  /** Live sensor temperature in °C. `null` when unknown. */
  temperatureC: number | null;
}
