/**
 * Server hrefs → native routes.
 *
 * Every path the backend's template catalog can stamp on a notification
 * must land on a REAL native screen — the bug this pins was community
 * notifications opening Not Found (web `/app/...` namespace pushed into
 * expo-router verbatim).
 */
import { resolveNotificationHref } from "../notificationLinks";

describe("resolveNotificationHref", () => {
  it("maps community post permalinks", () => {
    expect(resolveNotificationHref("/app/community/p/abc-123")).toBe(
      "/community/p/abc-123",
    );
  });

  it("maps the requests inbox to the People page", () => {
    expect(resolveNotificationHref("/app/community/requests")).toBe(
      "/community/people",
    );
  });

  it("maps collector profiles", () => {
    expect(resolveNotificationHref("/app/u/misty")).toBe("/u/misty");
  });

  it("maps price alerts to the singular card route", () => {
    expect(resolveNotificationHref("/cards/xyz")).toBe("/card/xyz");
  });

  it("maps article links to the bundled blog index", () => {
    expect(resolveNotificationHref("/blog/some-slug")).toBe("/blog");
  });

  it("strips the /app prefix for anything else in the web namespace", () => {
    expect(resolveNotificationHref("/app/settings")).toBe("/settings");
    expect(resolveNotificationHref("/app")).toBe("/");
  });

  it("passes already-native paths through", () => {
    expect(resolveNotificationHref("/community")).toBe("/community");
  });

  it("returns null for junk", () => {
    expect(resolveNotificationHref(null)).toBeNull();
    expect(resolveNotificationHref("")).toBeNull();
    expect(resolveNotificationHref("https://elsewhere.example")).toBeNull();
  });
});
