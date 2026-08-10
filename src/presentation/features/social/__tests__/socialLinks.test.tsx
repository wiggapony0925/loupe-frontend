/**
 * Link cosmetics — the profile shows "@lisacollects", never a wall of URL.
 */
import {
  linkDisplayText,
  orderedLinks,
  SOCIAL_PLATFORMS,
} from "../socialLinks";

describe("linkDisplayText", () => {
  it("shows the handle for profile-shaped URLs", () => {
    expect(linkDisplayText("https://instagram.com/lisacollects")).toBe(
      "@lisacollects",
    );
    expect(linkDisplayText("https://tiktok.com/@lisacollects")).toBe(
      "@lisacollects",
    );
  });

  it("shows the bare host for everything else", () => {
    expect(linkDisplayText("https://www.lisacollects.com")).toBe(
      "lisacollects.com",
    );
    expect(
      linkDisplayText("https://ebay.com/str/lisacollects/all/of/this"),
    ).toBe("ebay.com");
  });

  it("returns junk unchanged instead of throwing", () => {
    expect(linkDisplayText("not a url")).toBe("not a url");
  });
});

describe("orderedLinks", () => {
  it("orders by the canonical platform order and keeps unknowns", () => {
    const rows = orderedLinks({
      zzz_future: "https://example.com",
      youtube: "https://youtube.com/@x",
      instagram: "https://instagram.com/x",
    });
    expect(rows.map((r) => r.platform.key)).toEqual([
      "instagram",
      "youtube",
      "zzz_future",
    ]);
  });

  it("is empty for null and skips blank values", () => {
    expect(orderedLinks(null)).toEqual([]);
    expect(orderedLinks({ instagram: "" })).toEqual([]);
  });

  it("has a unique icon-label pair per platform", () => {
    const labels = new Set(SOCIAL_PLATFORMS.map((s) => s.label));
    expect(labels.size).toBe(SOCIAL_PLATFORMS.length);
  });
});
