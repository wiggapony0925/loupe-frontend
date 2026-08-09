/**
 * The guard between an over-the-air update and a white screen.
 *
 * `expo-video` is native. JS ships OTA, native does not — so every user on
 * the current build receives this code the moment an update lands, and none
 * of them have the native module until they install a new binary. A static
 * import would throw at module-load time and take the whole Community tab
 * with it.
 */

describe("videoSupport", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("reports unsupported when the native module is missing", () => {
    jest.doMock("expo-video", () => {
      throw new Error("Cannot find native module 'ExpoVideo'");
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { canPlayVideo } = require("../videoSupport");
    expect(canPlayVideo()).toBe(false);
  });

  it("reports unsupported when the JS resolves but the native side is absent", () => {
    // The case that actually bites: the package is in node_modules, so the
    // require succeeds, and the component throws on mount instead. Missing
    // exports are the observable signal.
    jest.doMock("expo-video", () => ({}));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { canPlayVideo } = require("../videoSupport");
    expect(canPlayVideo()).toBe(false);
  });

  it("reports supported when both exports are present", () => {
    jest.doMock("expo-video", () => ({
      useVideoPlayer: () => ({}),
      VideoView: () => null,
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { canPlayVideo } = require("../videoSupport");
    expect(canPlayVideo()).toBe(true);
  });

  it("resolves once and caches the answer", () => {
    const factory = jest.fn(() => ({
      useVideoPlayer: () => ({}),
      VideoView: () => null,
    }));
    jest.doMock("expo-video", factory);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { canPlayVideo } = require("../videoSupport");
    canPlayVideo();
    canPlayVideo();
    canPlayVideo();
    // Metro caches the module itself; what's pinned here is that we don't
    // re-enter the try on every frame of a scrolling feed.
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
