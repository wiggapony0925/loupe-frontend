// React Native defines `__DEV__` as a global; provide it (false) for the
// node-based vitest integration suite so app code that reads it doesn't throw.
(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
