/**
 * The random-logout rule.
 *
 * Only a definitive 401/403 from /auth/refresh means "the server rejected
 * the session" — those may destroy tokens. A network throw, a timeout, or
 * a 5xx says nothing about the session: the proactive foreground refresh
 * fires at the exact moment iOS networking wakes up, and treating a
 * dropped packet as a rejection was THE bug that logged people out for
 * opening the app in an elevator.
 *
 * Duck-typed on {name, status} rather than `instanceof ApiError` so this
 * module imports NOTHING — client.ts transitively pulls the Expo runtime,
 * which would drag every consumer (and this rule's own unit test) out of
 * the plain-node world. Same pattern as moderato's refusalFrom().
 */
export function isSessionRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, status } = err as { name?: unknown; status?: unknown };
  return name === "ApiError" && (status === 401 || status === 403);
}
