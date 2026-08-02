/**
 * The password rules both clients have to agree on.
 *
 * `MIN`/`MAX` mirror the backend's `RegisterRequest` field constraints
 * (`min_length=8, max_length=128`). Client-side checks exist to give a useful
 * message before the round-trip, so when they disagree with the server the
 * user gets a generic 422 instead — keeping the numbers in one place is what
 * stops that drift.
 */
export const PASSWORD_POLICY = {
  MIN: 8,
  MAX: 128,
  /** Message shown when the password is too short. */
  tooShort: "Use at least 8 characters.",
  /** Message shown when the password exceeds what the backend accepts. */
  tooLong: "Use 128 characters or fewer.",
} as const;

/** `null` when acceptable, else the message to show under the field. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_POLICY.MIN) return PASSWORD_POLICY.tooShort;
  if (password.length > PASSWORD_POLICY.MAX) return PASSWORD_POLICY.tooLong;
  return null;
}

export type PasswordStrength = {
  /** 0–4. 0 is empty/hopeless, 4 is strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

/**
 * A deliberately simple strength estimate: length does most of the work,
 * character variety the rest.
 *
 * This is a nudge toward a better password, not a security control — the
 * server's policy is what actually gates the account. Anything heavier (a
 * cracked-password dictionary, zxcvbn) would be a large dependency shipped
 * into the app bundle to render one four-segment bar.
 */
export function scorePassword(password: string): PasswordStrength {
  if (password.length === 0) return { score: 0, label: "" };
  if (password.length < PASSWORD_POLICY.MIN)
    return { score: 1, label: "Too short" };

  let points = 0;
  if (password.length >= 10) points++;
  if (password.length >= 14) points++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  if (classes >= 2) points++;
  if (classes >= 3) points++;

  if (points <= 1) return { score: 2, label: "Fair" };
  if (points <= 3) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}
