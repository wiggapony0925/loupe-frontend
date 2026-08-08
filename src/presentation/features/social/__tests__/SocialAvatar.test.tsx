/**
 * Avatar URL resolution.
 *
 * The reported bug: "I change the profile picture, it applies, and seconds
 * later it goes back to the blank one." The upload succeeded; the screen
 * then swapped the local preview for the SERVER url; that url was resolved
 * against a base that pointed at localhost in a release build; the load
 * failed; and the component fell back to its monogram.
 *
 * It only affected avatars because the rest of the app fetches through the
 * HTTP client, which hardens its base against exactly this. So these pin
 * that avatars use the SAME base as everything else.
 */
import { getApiBaseUrl } from "@/infrastructure/http/client";
import { absolutize } from "../SocialAvatar";

// The base the CLIENT reports, made distinctive. In a test env config.apiUrl
// and getApiBaseUrl() happen to agree, so without this the test would pass
// even with the bug still in place — it has to prove which one is used.
jest.mock("@/infrastructure/http/client", () => ({
  getApiBaseUrl: () => "https://live-base.example",
}));

describe("avatar URL resolution", () => {
  it("resolves against the base the HTTP CLIENT is using, not config", () => {
    // config.apiUrl is a different value; using it is the bug.
    expect(absolutize("/v1/social/avatar/abc?v=3")).toBe(
      "https://live-base.example/v1/social/avatar/abc?v=3",
    );
    expect(getApiBaseUrl()).toBe("https://live-base.example");
  });

  it("never resolves to localhost", () => {
    // A release build with no baked env var used to land on
    // http://localhost:8000 — a port nothing is listening on, and iOS
    // blocks plain http anyway.
    expect(absolutize("/v1/social/avatar/abc?v=3")).not.toContain("localhost");
  });

  it("leaves an already-absolute url alone", () => {
    const cdn = "https://cdn.example/avatars/abc.jpg";
    expect(absolutize(cdn)).toBe(cdn);
  });

  it("returns null for no picture rather than a bare origin", () => {
    // A bare origin would 200 with HTML and render as a broken image.
    expect(absolutize(null)).toBeNull();
    expect(absolutize(undefined)).toBeNull();
    expect(absolutize("")).toBeNull();
  });

  it("keeps the cache-busting query, or every client shows the old photo", () => {
    expect(absolutize("/v1/social/avatar/abc?v=7")).toContain("?v=7");
  });
});
