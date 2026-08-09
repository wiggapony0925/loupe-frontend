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
  /** Active portfolio (collection) id; null = the "All" view. Shared across devices + web. */
  active_collection_id: string | null;
  theme: "system" | "light" | "dark";
  live_sync_enabled: boolean;
  push_notifications_enabled: boolean;
  /** Opt-in for product-update + blog emails; security/account emails always send. */
  email_announcements_enabled: boolean;
  updated_at: ISODate | null;
}

/** Body for `PATCH /v1/me/settings` — mirrors `UserSettingsUpdate`; omitted fields unchanged. */
export interface UserSettingsUpdate {
  currency?: string;
  /** Send `null` to clear back to the "All" view; omit to leave unchanged. */
  active_collection_id?: string | null;
  theme?: "system" | "light" | "dark";
  live_sync_enabled?: boolean;
  push_notifications_enabled?: boolean;
  email_announcements_enabled?: boolean;
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
  /** MASKED ("+1 ••• ••• 0123") — enough to recognise which line it is,
   *  not enough to read off a shoulder. The raw number never leaves the
   *  server, and never appears on another user's payload at all. */
  phone?: string | null;
  phone_verified?: boolean;
}

/** Body for `PATCH /v1/me` — omitted fields are left unchanged. */
export interface UserProfileUpdate {
  display_name?: string | null;
  /** Any shape a person types; the server normalises to E.164. Send null
   *  to remove it. */
  phone?: string | null;
}

// ─── Loupe Pro entitlements + billing ──────────────────────────────────

/** Mirrors `PlanLimits` in `app/schemas/entitlement.py`. `null` = unlimited. */
export interface PlanLimits {
  max_cards: number | null;
  /** Statement PDFs a free user may download (their latest N). */
  free_statements: number | null;
}

/** Mirrors `PlanFeatures` — boolean capability gates the UI reads. */
export interface PlanFeatures {
  unlimited_cards: boolean;
  scanner_import: boolean;
  full_history: boolean;
  unlimited_alerts: boolean;
  /** Semantic "describe it" AI search — a Pro capability. */
  ai_search?: boolean;
  statements: boolean;
  pro_badge: boolean;
}

/**
 * Mirrors `EntitlementsRead` (`GET /v1/me/entitlements`) — the signed-in
 * user's effective Loupe Pro access. The client never decides what's
 * unlocked; it renders this computed payload.
 */
export interface Entitlements {
  plan: "free" | "pro";
  is_pro: boolean;
  /** True while Pro access is a free trial (Stripe `trialing`). */
  trialing: boolean;
  /** Global kill switch. False ⇒ everyone is Pro, hide every upgrade CTA. */
  subscriptions_enabled: boolean;
  pro_since: ISODate | null;
  pro_expires_at: ISODate | null;
  /** Live count of owned cards (drives the "X of 50" meter). */
  card_count: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

/** `GET /v1/me/billing/config` — pricing + checkout availability. */
export interface BillingConfig {
  checkout_available: boolean;
  publishable_key: string | null;
  price_monthly_usd: number;
  price_yearly_usd: number;
  trial_days: number;
}

/** `POST /v1/me/billing/checkout` — hosted Stripe Checkout session. */
export interface CheckoutSession {
  status: "checkout" | "unavailable";
  url?: string;
  message?: string;
}

/** `POST /v1/me/billing/portal` — Stripe customer-portal session. */
export interface BillingPortalSession {
  url: string;
}

export type BillingInterval = "monthly" | "yearly";

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
