// Stub for `expo/virtual/env` used by the `domain` Jest project.
// `babel-preset-expo` rewrites `process.env.EXPO_PUBLIC_*` reads into
// imports from this module; in a plain-node test environment we just
// proxy back to `process.env` so unit tests can run without the Expo
// runtime.
module.exports = { env: process.env };
