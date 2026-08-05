/**
 * The inbox item contract shared by the screen, the badge, and the hook.
 *
 * This module used to hold the merge logic that built a feed on-device from
 * the announcement banner, the public blog list and the user's price alerts.
 * The backend now owns the inbox as real rows (`/v1/me/notifications`), so the
 * merge — and the device-local read state it depended on — is gone. What's
 * left is the shape the UI renders, which is deliberately still a narrow view
 * of the server model: the screen needs a title, a time, a route and a read
 * flag, not the whole payload.
 */

/** Server categories. `social` and `billing` arrived with the community and
 *  subscription layers; anything unrecognised is rendered as `system` rather
 *  than dropped, because a notification we can't classify is still one the
 *  user was meant to see. */
export type NotificationCategory =
  | "market"
  | "news"
  | "social"
  | "billing"
  | "system";

export interface FeedItem {
  /** The server notification id — what read-state is keyed on. */
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  /** ISO timestamp. Items without one sort last rather than being dropped. */
  at: string | null;
  /** In-app route to open on tap, when the item points somewhere. */
  href: string | null;
  unread: boolean;
}
