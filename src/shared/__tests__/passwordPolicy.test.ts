/**
 * Guards the password rules shared with loupe-web (`@loupe/auth`).
 *
 * `MIN`/`MAX` mirror the backend's `RegisterRequest` constraints — if these
 * drift, sign-up starts failing with a bare 422 instead of a useful message.
 */
import { PASSWORD_POLICY, scorePassword, validatePassword } from "@loupe/auth";

describe("PASSWORD_POLICY", () => {
  it("matches the backend's min_length=8 / max_length=128", () => {
    expect(PASSWORD_POLICY.MIN).toBe(8);
    expect(PASSWORD_POLICY.MAX).toBe(128);
  });
});

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum", () => {
    expect(validatePassword("short")).toBe(PASSWORD_POLICY.tooShort);
  });

  it("rejects passwords the backend would refuse as too long", () => {
    expect(validatePassword("a".repeat(129))).toBe(PASSWORD_POLICY.tooLong);
  });

  it("accepts passwords at both boundaries", () => {
    expect(validatePassword("a".repeat(8))).toBeNull();
    expect(validatePassword("a".repeat(128))).toBeNull();
  });
});

describe("scorePassword", () => {
  it("stays silent on an untouched field", () => {
    expect(scorePassword("")).toEqual({ score: 0, label: "" });
  });

  it("flags anything below the policy minimum as too short", () => {
    expect(scorePassword("abc")).toEqual({ score: 1, label: "Too short" });
  });

  it("rates a long, varied password strongest", () => {
    expect(scorePassword("Tr0ub4dor&3xtra").label).toBe("Strong");
  });

  it("rates a bare eight-character single-class password lowest of the valid tiers", () => {
    expect(scorePassword("aaaaaaaa").label).toBe("Fair");
  });

  it("never returns a score outside 0–4", () => {
    for (const pw of ["", "a", "aaaaaaaa", "Aa1!aaaaaaaaaaaaaaaa"]) {
      const { score } = scorePassword(pw);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });
});
