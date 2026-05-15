// Loupe Metro config — Expo SDK 52 + NativeWind v4.
// Keep this thin: every plugin we add here taxes the dev cycle.

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
