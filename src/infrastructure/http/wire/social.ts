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
  relationship: SocialRelationship;
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
}

export interface SocialCollectionWire {
  total_cards: number;
  estimated_value_usd: string | null;
  items: SocialCollectionItemWire[];
}

export interface SocialProfileUpsertWire {
  username: string;
  bio?: string | null;
  location?: string | null;
  is_private?: boolean;
}
