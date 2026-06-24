/**
 * Test stub for `@/infrastructure/observability/sentry` — aliased in by
 * vitest.config.ts so node integration tests can import the real http client
 * (which calls `captureApiError` on failures) without loading the native-backed
 * observability module (expo-constants / Sentry native).
 */
export function initSentry(): void {}
export function captureNormalizedError(): void {}
export function captureMessage(): void {}
export function captureApiError(): void {}
