/**
 * Is the native video player in THIS binary?
 *
 * `expo-video` is a native module. A static `import` of it resolves at
 * module-load time, and on a build that doesn't ship the native side that
 * throw takes down whatever imported it — which here is the feed's media
 * component, i.e. the whole Community tab, as a white screen.
 *
 * That matters because JS ships over the air and native does not. Every
 * user on the current build gets new JS the moment an update lands, and
 * they will not have `expo-video` until they install a new binary from
 * TestFlight. Without this guard, shipping the stories work would brick
 * Community for everyone who hasn't updated yet.
 *
 * So it's resolved through `require` inside a try, once, at first use.
 * Callers that get `null` render a poster and a "update to watch" note
 * instead of a player: a video you can't play yet is a small
 * disappointment, and a crash is not.
 *
 * **Delete this once the binary carrying expo-video is the minimum
 * supported build.** It is scaffolding for one release, not architecture.
 */

interface VideoModule {
  useVideoPlayer: unknown;
  VideoView: unknown;
}

let resolved: VideoModule | null | undefined;

export function videoModule(): VideoModule | null {
  if (resolved !== undefined) return resolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-video") as VideoModule;
    // Present but not linked natively is the case that actually bites: the
    // JS resolves, the component throws on mount. Check for both exports.
    resolved = mod?.useVideoPlayer && mod?.VideoView ? mod : null;
  } catch {
    resolved = null;
  }
  return resolved;
}

/** True when this build can play video. */
export function canPlayVideo(): boolean {
  return videoModule() !== null;
}
