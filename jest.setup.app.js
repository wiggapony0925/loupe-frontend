/**
 * Setup for the `app` (component) Jest project.
 *
 * AsyncStorage is a NATIVE module, so importing it under Jest throws
 * "NativeModule: AsyncStorage is null". Almost every component reaches it
 * indirectly — a card tile pulls in the theme tokens, which pull in the
 * persisted settings store — so a component test that never mentions storage
 * still dies on it. The package ships an official in-memory mock; registering
 * it here means each new component test doesn't have to rediscover this.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
