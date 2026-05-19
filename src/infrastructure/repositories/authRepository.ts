/**
 * Auth endpoint wrappers for loupe-backend.
 *
 * Response shapes hand-mirror the Pydantic schemas in
 * loupe-backend/app/schemas/{auth,user}.py — replace with generated types
 * once an OpenAPI codegen pipeline lands.
 */

import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { MeResponse } from "@/infrastructure/http";

export type { MeResponse };

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

export interface EmailSignUpRequest {
  email: string;
  password: string;
  display_name?: string | null;
}

export interface EmailSignInRequest {
  email: string;
  password: string;
}

export interface DevLoginRequest {
  email: string;
  display_name?: string | null;
}

export function registerWithEmail(body: EmailSignUpRequest): Promise<TokenPair> {
  return apiFetch<TokenPair>(ENDPOINTS.auth.register, {
    method: "POST",
    json: body,
    skipAuth: true,
  });
}

export function loginWithEmail(body: EmailSignInRequest): Promise<TokenPair> {
  return apiFetch<TokenPair>(ENDPOINTS.auth.login, {
    method: "POST",
    json: body,
    skipAuth: true,
  });
}

export function devLogin(body: DevLoginRequest): Promise<TokenPair> {
  return apiFetch<TokenPair>(ENDPOINTS.auth.devLogin, {
    method: "POST",
    json: body,
    skipAuth: true,
  });
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
