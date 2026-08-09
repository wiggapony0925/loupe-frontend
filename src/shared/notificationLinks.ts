/**
 * Server notification links → native routes.
 *
 * The backend stamps every notification with an ``href`` (see the template
 * catalog in `app/services/notification_templates.py`): a PATH in the WEB
 * app's namespace — `/app/community/p/{id}`, `/cards/{id}` — because the
 * web router consumes it verbatim. Native routes drop the `/app` prefix
 * and sometimes differ (`/card/{id}`, singular; requests live on the
 * People page). Pushing the raw href into expo-router landed every
 * community notification on Not Found — which read as "notifications
 * don't work", because for tapping purposes they didn't.
 *
 * One resolver, used by BOTH the inbox rows and the push-tap handler, so
 * a notification opens the same screen no matter which surface it was
 * tapped on. Returns null for a link this build genuinely can't show —
 * callers render those rows unlinked rather than dead-ended.
 */

/** Web-namespace paths with a DIFFERENT native shape (checked first). */
const EXACT: Record<string, string> = {
  // The native requests inbox is a section of the People page.
  "/app/community/requests": "/community/people",
};

const PREFIX: { from: string; to: string }[] = [
  // Card detail is `/card/{id}` natively, `/cards/{id}` on the web.
  { from: "/cards/", to: "/card/" },
  // Only the blog INDEX is bundled natively; a per-article link still
  // lands somewhere honest.
  { from: "/blog/", to: "/blog" },
];

export function resolveNotificationHref(
  href: string | null | undefined,
): string | null {
  if (!href || typeof href !== "string" || !href.startsWith("/")) return null;

  const exact = EXACT[href];
  if (exact) return exact;

  for (const rule of PREFIX) {
    if (href.startsWith(rule.from)) {
      return rule.to.endsWith("/")
        ? rule.to + href.slice(rule.from.length)
        : rule.to;
    }
  }

  // The general rule: the web app's namespace minus its `/app` prefix IS
  // the native namespace (community, u/{handle}, settings…).
  if (href === "/app") return "/";
  if (href.startsWith("/app/")) return href.slice("/app".length);

  // Already-native or shared paths pass through.
  return href;
}
