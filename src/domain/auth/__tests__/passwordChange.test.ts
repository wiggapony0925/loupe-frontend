import {
  canSubmitPasswordChange,
  newPasswordTooShort,
  passwordsMismatch,
  MIN_PASSWORD_LENGTH,
} from "../passwordChange";

describe("password-change validation", () => {
  describe("newPasswordTooShort", () => {
    it("is false while empty (no premature error)", () => {
      expect(newPasswordTooShort("")).toBe(false);
    });
    it("is true below the minimum length", () => {
      expect(newPasswordTooShort("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(true);
    });
    it("is false at or above the minimum", () => {
      expect(newPasswordTooShort("a".repeat(MIN_PASSWORD_LENGTH))).toBe(false);
    });
  });

  describe("passwordsMismatch", () => {
    it("is false while confirm is empty", () => {
      expect(passwordsMismatch("password1", "")).toBe(false);
    });
    it("is true when they differ", () => {
      expect(passwordsMismatch("password1", "password2")).toBe(true);
    });
    it("is false when they match", () => {
      expect(passwordsMismatch("password1", "password1")).toBe(false);
    });
  });

  describe("canSubmitPasswordChange", () => {
    const valid = { current: "old", next: "newpassword", confirm: "newpassword" };

    it("accepts a current pw + long-enough matching new pw", () => {
      expect(canSubmitPasswordChange(valid)).toBe(true);
    });
    it("rejects a missing current password", () => {
      expect(canSubmitPasswordChange({ ...valid, current: "" })).toBe(false);
    });
    it("rejects a too-short new password", () => {
      expect(
        canSubmitPasswordChange({ current: "old", next: "short", confirm: "short" }),
      ).toBe(false);
    });
    it("rejects a non-matching confirmation", () => {
      expect(canSubmitPasswordChange({ ...valid, confirm: "different1" })).toBe(false);
    });
  });
});
