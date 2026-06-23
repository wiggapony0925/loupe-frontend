/**
 * Identity & access wire types — `/v1/me`, `/v1/auth/*`, `/v1/scanners`, keys, audit.
 */

import type { ID, ISODate, ScannerTransport } from "../atoms";

// ─── User ──────────────────────────────────────────────────────────────

/** Mirrors `UserRead` in `app/schemas/user.py`. */
export interface User {
  id: ID;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: ISODate;
}

/** Mirrors `UserSettingsRead` in `app/schemas/user.py`. */
export interface UserSettings {
  currency: string;
  theme: "system" | "light" | "dark";
  live_sync_enabled: boolean;
  push_notifications_enabled: boolean;
  updated_at: ISODate | null;
}

/** Response from `GET /v1/me` — identical to `User`, kept distinct for clarity. */
export interface MeResponse {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  /** True when the account is in the admin allowlist — unlocks the portal. */
  is_admin?: boolean;
}

// ─── Scanners (paired hardware) ────────────────────────────────────────

/** Mirrors `ScannerRead` in `app/schemas/scanner.py`. */
export interface Scanner {
  id: ID;
  device_id: string;
  name: string | null;
  firmware_version: string | null;
  transport: ScannerTransport;
  is_active: boolean;
  last_seen_at: ISODate | null;
  created_at: ISODate;
}

// ─── Auth tokens & API keys ────────────────────────────────────────────

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface ApiKey {
  id: ID;
  user_id: ID;
  label: string;
  prefix: string;
  last_used_at: ISODate | null;
  expires_at: ISODate | null;
  created_at: ISODate;
  revoked_at: ISODate | null;
}

export interface AuditLogEntry {
  id: ID;
  user_id: ID | null;
  action: string;
  target_type: string | null;
  target_id: ID | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: ISODate;
  metadata: Record<string, unknown> | null;
}
