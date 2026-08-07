/**
 * The profile's collection section.
 *
 * The shelves (portfolios, top sets) are nested INSIDE this section, between
 * the filter rail and the cards. That placement carries one rule that is
 * easy to regress and invisible until someone searches: the shelves describe
 * the WHOLE collection, so they must disappear while a search or set filter
 * is narrowing the results — otherwise a carousel about everything sits
 * between the collector and the handful of cards they asked for.
 */
import React from "react";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import { CollectionGrid } from "../CollectionGrid";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

function item(over: Partial<SocialCollectionItemWire> = {}): SocialCollectionItemWire {
  return {
    id: "h1",
    card_id: "c1",
    card_name: "Umbreon",
    set_name: "Evolving Skies",
    house: "psa",
    grade: 10,
    estimated_value_usd: 1200,
    card_image_url: null,
    ...over,
  } as SocialCollectionItemWire;
}

const SHELVES = <Text>PORTFOLIOS · 6</Text>;

describe("CollectionGrid interlude", () => {
  it("shows the shelves between the filters and the cards", () => {
    render(
      <CollectionGrid items={[item()]} ownerLabel="your collection" interlude={SHELVES} />,
    );
    expect(screen.getByText("PORTFOLIOS · 6")).toBeTruthy();
  });

  it("hides the shelves once a search narrows the collection", () => {
    render(
      <CollectionGrid items={[item()]} ownerLabel="your collection" interlude={SHELVES} />,
    );
    fireEvent.changeText(screen.getByLabelText("Search this collection"), "umb");
    expect(screen.queryByText("PORTFOLIOS · 6")).toBeNull();
  });

  it("brings them back when the search is cleared", () => {
    render(
      <CollectionGrid items={[item()]} ownerLabel="your collection" interlude={SHELVES} />,
    );
    const search = screen.getByLabelText("Search this collection");
    fireEvent.changeText(search, "umb");
    fireEvent.changeText(search, "");
    expect(screen.getByText("PORTFOLIOS · 6")).toBeTruthy();
  });

  it("renders without an interlude — other callers pass nothing", () => {
    render(<CollectionGrid items={[item()]} ownerLabel="your collection" />);
    // The name appears on the tile and again in its accessibility label.
    expect(screen.getAllByText("Umbreon").length).toBeGreaterThan(0);
    expect(screen.queryByText("PORTFOLIOS · 6")).toBeNull();
  });
});
