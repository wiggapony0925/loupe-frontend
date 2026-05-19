/**
 * Storage adapters — token persistence, AsyncStorage helpers.
 *
 * `tokenStorage` is an in-memory holder today; swap the getter/setter
 * for `expo-secure-store` once auth screens land. Keeping the surface
 * small means callers don't change when storage does.
 */
export * from "./tokenStorage";
