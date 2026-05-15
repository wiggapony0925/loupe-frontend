/**
 * Lightweight JWT holder. In-memory only for now — swap the getter/setter
 * for `expo-secure-store` once auth screens land. Keeping the surface small
 * means the API client doesn't have to change when storage does.
 */

let accessToken: string | null = null;
const listeners = new Set<(t: string | null) => void>();

export const auth = {
  getToken: () => accessToken,
  setToken(token: string | null) {
    accessToken = token;
    listeners.forEach((l) => l(token));
  },
  subscribe(fn: (t: string | null) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
