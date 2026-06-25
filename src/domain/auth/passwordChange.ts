/**
 * Pure validation for the change-password form (shared by the screen so the
 * rules are unit-testable without rendering React Native).
 */

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordChangeFields {
  current: string;
  next: string;
  confirm: string;
}

/** True once the user has typed a too-short new password (for inline error). */
export function newPasswordTooShort(next: string): boolean {
  return next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
}

/** True once the confirm field is non-empty and doesn't match (for inline error). */
export function passwordsMismatch(next: string, confirm: string): boolean {
  return confirm.length > 0 && next !== confirm;
}

/** Whether the form may be submitted: a current password, a long-enough new one,
 *  and a matching confirmation. */
export function canSubmitPasswordChange({
  current,
  next,
  confirm,
}: PasswordChangeFields): boolean {
  return (
    current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === confirm
  );
}
