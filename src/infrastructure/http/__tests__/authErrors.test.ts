/**
 * The random-logout rule.
 *
 * The rule under test: ONLY a definitive 401/403 from /auth/refresh may
 * destroy the session. A network throw, a timeout, or a 5xx says nothing
 * about the tokens — treating those as rejection was the bug that logged
 * people out for opening the app in an elevator.
 *
 * The fake mirrors ApiError's duck shape ({name: "ApiError", status}) —
 * the real class can't be imported here without dragging the Expo runtime
 * into the plain-node project, which is exactly why isSessionRejection
 * duck-types in the first place.
 */
import { isSessionRejection } from "../authErrors";

class FakeApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

describe("isSessionRejection", () => {
  it("treats 401 and 403 as the server rejecting the session", () => {
    expect(isSessionRejection(new FakeApiError(401))).toBe(true);
    expect(isSessionRejection(new FakeApiError(403))).toBe(true);
  });

  it("keeps the session on server trouble (5xx) and rate limits", () => {
    expect(isSessionRejection(new FakeApiError(500))).toBe(false);
    expect(isSessionRejection(new FakeApiError(502))).toBe(false);
    expect(isSessionRejection(new FakeApiError(429))).toBe(false);
  });

  it("keeps the session on transport failures — the elevator case", () => {
    expect(isSessionRejection(new TypeError("Network request failed"))).toBe(
      false,
    );
    expect(isSessionRejection(new Error("timeout"))).toBe(false);
    expect(isSessionRejection(undefined)).toBe(false);
  });

  it("ignores a 401 that isn't an ApiError — no impostor sign-outs", () => {
    expect(isSessionRejection({ status: 401 })).toBe(false);
  });
});

/**
 * The COLD-BOOT rule, which the first version of this fix missed.
 *
 * On a cold open the hydration path calls /me. If the access token is
 * stale the client asks the refresh handler to save it; when that handler
 * fails transiently it keeps the tokens and returns null, and the client
 * then rethrows the ORIGINAL 401. The hydration handler used to wipe the
 * keychain on that 401 unconditionally — so the session the refresh
 * deliberately preserved was destroyed one frame later.
 *
 * The surviving refresh token is the signal: the refresh handler has
 * already signed out if the server truly rejected it, so a token still
 * being there means "transient — keep going".
 */
function shouldDropSessionOnHydration(
  err: unknown,
  refreshTokenStillPresent: boolean,
): boolean {
  return isSessionRejection(err) && !refreshTokenStillPresent;
}

describe("cold-boot hydration", () => {
  it("keeps the session when a refresh token survived the 401", () => {
    // Transient refresh failure → tokens kept → original 401 rethrown.
    expect(shouldDropSessionOnHydration(new FakeApiError(401), true)).toBe(
      false,
    );
  });

  it("signs out when a 401 arrives with no refresh token left", () => {
    // Nothing left to trade — genuinely unrecoverable.
    expect(shouldDropSessionOnHydration(new FakeApiError(401), false)).toBe(
      true,
    );
  });

  it("never signs out on a transport failure, token or not", () => {
    const err = new TypeError("Network request failed");
    expect(shouldDropSessionOnHydration(err, true)).toBe(false);
    expect(shouldDropSessionOnHydration(err, false)).toBe(false);
  });
});
