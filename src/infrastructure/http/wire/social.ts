/**
 * Wire types for `/v1/social` — the community layer.
 *
 * Mirrors `app/social/schemas.py`. Deliberately hand-written rather than
 * pulled from the generated OpenAPI types: these are the shapes the native
 * screens read, and keeping them here documents which fields the app relies
 * on when the backend schema grows.
 */

/** How the *viewer* stands to the profile being looked at. */
export type SocialRelationship = "self" | "following" | "requested" | "none";

/** My own profile row — null until a username is claimed. */
export interface SocialProfileWire {
  user_id: string;
  username: string;
  bio: string | null;
  location: string | null;
  is_private: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface SocialMeWire {
  profile: SocialProfileWire | null;
  incoming_request_count: number;
}

/** A collector in a list — search results, suggestions, follower lists. */
export interface SocialUserCardWire {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  is_private: boolean;
  is_pro: boolean;
  /** Loupe staff — drives the ADMIN tag on people rows. */
  is_admin: boolean;
  relationship: SocialRelationship;
  /** How many cards they own — 0 for private accounts you can't see. */
  card_count: number;
  /** Art for their best few cards; empty when private or nothing owned. */
  preview_image_urls: string[];
}

/** A collector I follow who owns a given card (card-detail friends strip). */
export interface FriendOwnerWire extends SocialUserCardWire {
  copies: number;
}

/** The full profile header. */
export interface SocialProfileViewWire {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_private: boolean;
  is_pro: boolean;
  joined_at: string;
  follower_count: number;
  following_count: number;
  card_count: number;
  /** Collectors who have appreciated this collection. */
  like_count: number;
  /** DISTINCT collectors who have opened this profile — never raw hits. */
  view_count: number;
  viewer_has_liked: boolean;
  relationship: SocialRelationship;
  /** False on a private profile you don't follow — the header still shows. */
  can_view_collection: boolean;
}

export interface SocialFollowRequestWire {
  id: string;
  requester: SocialUserCardWire;
  created_at: string;
}

export interface SocialFollowStateWire {
  relationship: SocialRelationship;
}

export interface SocialLikeStateWire {
  liked: boolean;
  like_count: number;
}

export interface SocialCollectionItemWire {
  id: string;
  card_id: string;
  card_name: string | null;
  card_image_url: string | null;
  card_set_name: string | null;
  card_number: string | null;
  card_tcg: string | null;
  grade: string;
  house: string;
  condition: string | null;
  estimated_value_usd: string | null;
  graded_at: string;
  /** 14-point price trend for the row's sparkline (flat when unknown). */
  spark_points: number[];
  /** Percent change across those points — colours the delta. */
  spark_delta_pct: number | null;
}

/** One of the collector's CURATED collections (binders/decks). */
export interface SocialPortfolioWire {
  id: string;
  name: string;
  color: string | null;
  count: number;
  estimated_value_usd: string | null;
  cover_image_url: string | null;
}

/** One set inside a shared collection — "5 Evolving Skies". */
export interface SocialCollectionSetWire {
  name: string;
  count: number;
  estimated_value_usd: string | null;
  cover_image_url: string | null;
}

/** The Community page's people shelves, composed and ranked server-side. */
export interface DiscoverWire {
  featured: SocialUserCardWire[];
  more: SocialUserCardWire[];
}

/** One sealed SKU on a shared profile (boxes, ETBs, bundles…). */
export interface SocialSealedItemWire {
  product_id: string;
  name: string;
  set_name: string | null;
  product_type: string;
  tcg: string;
  image_url: string | null;
  quantity: number;
  /** TOTAL for the row (unit value x quantity). */
  estimated_value_usd: string | null;
}

export interface SocialCollectionWire {
  total_cards: number;
  estimated_value_usd: string | null;
  /** Sealed rollup — unopened units / their value / cards+sealed headline.
   *  Absent on older backends; treat missing as zero/absent. */
  sealed_count?: number;
  sealed_value_usd?: string | null;
  total_value_usd?: string | null;
  /** Vault-wide set count — `sets` is capped server-side to the top few. */
  total_sets?: number;
  /** Curated portfolios (binders), largest value first. */
  portfolios?: SocialPortfolioWire[];
  /** Sealed shelf, largest value first (server-capped). */
  sealed?: SocialSealedItemWire[];
  /** Whole-collection breakdown, largest value first (may be absent on
   *  older backends — treat missing as empty). */
  sets?: SocialCollectionSetWire[];
  items: SocialCollectionItemWire[];
}

/** ``GET /v1/social/users/{u}/collections/{id}`` — one binder, drilled into. */
export interface SocialPortfolioItemsWire {
  id: string;
  name: string;
  color: string | null;
  count: number;
  estimated_value_usd: string | null;
  items: SocialCollectionItemWire[];
}

export interface SocialProfileUpsertWire {
  username: string;
  bio?: string | null;
  location?: string | null;
  is_private?: boolean;
}

/** One tile in the Community Explore mosaic. */
export interface ExploreCardWire {
  id: string;
  card_id: string;
  card_name: string | null;
  image_url: string;
  /** Whose card it is — the tile's route to a person. */
  username: string;
  /** Server-assigned: this tile leads a hero band in the mosaic. */
  is_hero: boolean;
}

export interface ExploreReadWire {
  cards: ExploreCardWire[];
}
