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

/**
 * Reanimated (v4) is native-backed the moment it's imported — its worklets
 * RUNTIME throws under Jest before a single test runs. Mocking reanimated
 * itself doesn't help (even its official mock imports the real runtime);
 * the throw originates one layer down in react-native-worklets, which
 * ships its own mock. With the runtime mocked, reanimated's actual JS runs
 * fine: animations resolve immediately and shared values are plain boxes —
 * so any component that animates can be rendered in a test.
 */
jest.mock("react-native-worklets", () =>
  require("react-native-worklets/src/mock"),
);
