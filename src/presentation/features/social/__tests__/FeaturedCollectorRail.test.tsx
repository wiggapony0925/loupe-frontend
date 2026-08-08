/**
 * The featured rail.
 *
 * The tile IS card art, so a collector with no art has nothing to put in it
 * and an empty frame reading "No cards yet" only advertises the emptiness.
 * They belong in the rows below instead, where a face and a handle are the
 * point.
 *
 * This is tested because it has regressed TWICE: once when the rail was
 * deleted and later restored from the commit before the fix, and it shipped
 * to a device both times.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { SocialUserCardWire } from "@/infrastructure/http";
import { FeaturedCollectorRail } from "../FeaturedCollectorRail";

function collector(over: Partial<SocialUserCardWire> = {}): SocialUserCardWire {
  return {
    user_id: `u${Math.random()}`,
    username: "someone",
    display_name: "Some One",
    avatar_url: null,
    location: null,
    is_private: false,
    is_pro: false,
    is_admin: false,
    relationship: "none",
    card_count: 0,
    preview_image_urls: [],
    ...over,
  } as SocialUserCardWire;
}

const noop = () => {};

describe("FeaturedCollectorRail", () => {
  it("never renders an empty art frame", () => {
    render(
      <FeaturedCollectorRail
        users={[collector({ username: "empty_vault" })]}
        onOpen={noop}
        onToggleFollow={noop}
      />,
    );
    expect(screen.queryByText("No cards yet")).toBeNull();
  });

  it("omits collectors who have no art at all", () => {
    render(
      <FeaturedCollectorRail
        users={[collector({ display_name: "Empty Ed" })]}
        onOpen={noop}
        onToggleFollow={noop}
      />,
    );
    expect(screen.queryByText("Empty Ed")).toBeNull();
  });

  it("renders collectors who do have art", () => {
    render(
      <FeaturedCollectorRail
        users={[
          collector({
            display_name: "Arty Alice",
            preview_image_urls: ["https://img.example/a.png"],
          }),
          collector({ display_name: "Empty Ed" }),
        ]}
        onOpen={noop}
        onToggleFollow={noop}
      />,
    );
    expect(screen.getByText("Arty Alice")).toBeTruthy();
    expect(screen.queryByText("Empty Ed")).toBeNull();
  });
});
