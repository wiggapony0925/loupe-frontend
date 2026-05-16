/**
 * Centralized user-facing copy for error and empty states.
 *
 * One source of truth so we can tune tone, l10n, or experiment via flags
 * without hunting through screens. Keys map roughly to feature × state.
 */

export type CopyEntry = { title: string; message: string };

export const COPY = {
  offline: {
    title: "You're offline",
    message: "Showing what we have. Reconnect to refresh.",
  },
  backOnline: { title: "Back online", message: "Refreshing fresh data…" },

  searchEmpty: { title: "No cards found", message: "Try a different name or set." },
  searchError: {
    title: "Search isn't working",
    message: "We couldn't reach our card database.",
  },
  searchHint: {
    title: "Search anything",
    message: "Type a card, player, or set to begin.",
  },

  listingsEmpty: {
    title: "No active listings",
    message: "Check back soon — eBay listings update frequently.",
  },
  listingsError: {
    title: "Listings unavailable",
    message: "Live listings are temporarily down. Try again in a moment.",
  },

  compsEmpty: {
    title: "No recent sales",
    message: "This card hasn't sold publicly in the selected window.",
  },
  compsError: {
    title: "Sales data unavailable",
    message: "We couldn't fetch recent comps.",
  },

  marketError: {
    title: "Market data unavailable",
    message: "Showing what we have. Some prices may be estimates.",
  },
  cardNotFound: {
    title: "Card not found",
    message: "This card may have been removed from our database.",
  },

  vaultEmpty: {
    title: "Your vault is empty",
    message: "Scan or add a card to begin tracking.",
  },
  vaultError: {
    title: "Can't load your vault",
    message: "We couldn't sync your collection.",
  },
  vaultFiltersEmpty: {
    title: "No cards match",
    message: "Try clearing filters or adding more to your vault.",
  },

  analyticsEmpty: {
    title: "No data yet",
    message: "Scan or add cards to see your portfolio analytics.",
  },
  analyticsError: {
    title: "Analytics unavailable",
    message: "We couldn't compute your stats right now.",
  },

  scannerOffline: {
    title: "Scanner offline",
    message: "Connect to the internet to scan and grade cards.",
  },
  scannerError: {
    title: "Scanner crashed",
    message: "Please try again. If this keeps happening, restart the app.",
  },

  signInRequired: {
    title: "Sign in to continue",
    message: "Save cards, get alerts, and sync across devices.",
  },

  permissionCamera: {
    title: "Camera permission needed",
    message: "Enable camera access in Settings to scan cards.",
  },
  permissionNotifications: {
    title: "Notifications off",
    message: "Enable notifications to get price alerts.",
  },
  permissionMicrophone: {
    title: "Microphone access denied",
    message: "Enable the microphone in Settings to capture audio.",
  },

  imageFailed: { title: "Image unavailable", message: "" },

  rateLimited: {
    title: "Slow down",
    message: "You're moving fast — give it a few seconds and try again.",
  },
  serverError: {
    title: "Something went wrong",
    message: "Our servers are having a moment. Try again shortly.",
  },
  timeout: {
    title: "This is taking longer than usual",
    message: "Check your connection and try again.",
  },
  unauthorized: {
    title: "Session expired",
    message: "Please sign in again to continue.",
  },
  forbidden: {
    title: "Not allowed",
    message: "You don't have access to this content.",
  },
  notFound: {
    title: "Not found",
    message: "That page or item couldn't be located.",
  },
  unknown: {
    title: "Something went wrong",
    message: "Try again — if this keeps happening, contact support.",
  },
} satisfies Record<string, CopyEntry>;

export type CopyKey = keyof typeof COPY;
