/**
 * Auth endpoint wrappers for loupe-backend.
 *
 * Response shapes hand-mirror the Pydantic schemas in
 * loupe-backend/app/schemas/{auth,user}.py — replace with generated types
 * once an OpenAPI codegen pipeline lands.
 */

import { apiFetch } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface MeResponse {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: MeResponse;
}

export interface AppleSignInRequest {
  identity_token: string;
  nonce?: string | null;
  display_name?: string | null;
}

export interface GoogleSignInRequest {
  id_token: string;
  display_name?: string | null;
}

export interface RefreshRequest {
  refresh_token: string;
}

export function signInWithApple(body: AppleSignInRequest): Promise<TokenPair> {
  return apiFetch<TokenPair>(ENDPOINTS.auth.apple, {
    method: "POST",
    json: body,
    skipAuth: true,
  });
}

export function signInWithGoogle(body: GoogleSignInRequest): Promise<TokenPair> {
  return apiFetch<TokenPair>(ENDPOINTS.auth.google, {
    method: "POST",
    json: body,
    skipAuth: true,
  });
}

export function refreshSession(body: RefreshRequest): Promise<TokenPair> {
  return apiFetch<TokenPair>(ENDPOINTS.auth.refresh, {
    method: "POST",
    json: body,
    skipAuth: true,
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>(ENDPOINTS.auth.logout, { method: "POST" });
}

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>(ENDPOINTS.me.root, { method: "GET" });
}
