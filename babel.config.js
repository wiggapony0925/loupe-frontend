module.exports = function (api) {
  api.cache(true);

  return {
    // We deliberately DON'T include `nativewind/babel` here.
    //
    // That preset (via `react-native-css-interop/babel`) loads
    // `react-native-worklets/plugin`, which is meant for Reanimated 4 and
    // double-transforms worklets when paired with Reanimated 3 — the symptom
    // is `Property '__reanimatedLoggerConfig' doesn't exist` at runtime.
    //
    // Instead we:
    //   1. let `babel-preset-expo` set the NativeWind JSX runtime
    //      (`jsxImportSource: 'nativewind'`),
    //   2. add only the css-interop className → style plugin manually,
    //   3. let `babel-preset-expo` auto-load `react-native-reanimated/plugin`
    //      (it does this whenever reanimated is installed).
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [require("react-native-css-interop/dist/babel-plugin").default],
  };
};
