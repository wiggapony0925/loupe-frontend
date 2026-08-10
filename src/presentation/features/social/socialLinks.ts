/**
 * The social-link platforms a profile can carry, in display order.
 *
 * One module owns the platform → icon/label mapping and the URL cosmetics,
 * so the profile header, the settings editor and anything future (a share
 * sheet, the web parity pass) can't disagree about what "tiktok" looks
 * like. The KEYS mirror the backend allowlist in
 * `app/social/services/links.py` — the server canonicalises whatever the
 * user typed into a https URL, so clients only ever render and open.
 *
 * Icon honesty: lucide has no TikTok/X/eBay brand marks (brand glyphs are
 * trademark-encumbered), so those get the closest honest metaphor — a
 * music note, the bird's successor keeps the bird, a shopping bag.
 */
import {
  Droplet,
  Facebook,
  Gamepad2,
  Globe,
  Instagram,
  Layers,
  Music2,
  ShoppingBag,
  Store,
  Twitch,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react-native";

export interface SocialPlatform {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: "instagram", label: "Instagram", Icon: Instagram },
  { key: "x", label: "X", Icon: Twitter },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "tiktok", label: "TikTok", Icon: Music2 },
  { key: "twitch", label: "Twitch", Icon: Twitch },
  { key: "web", label: "Website", Icon: Globe },
  { key: "youtube", label: "YouTube", Icon: Youtube },
  { key: "whatnot", label: "Whatnot", Icon: ShoppingBag },
  { key: "drip", label: "Drip", Icon: Droplet },
  { key: "ebay", label: "eBay", Icon: ShoppingBag },
  { key: "cardmarket", label: "Cardmarket", Icon: Store },
  { key: "tcgplayer", label: "TCGplayer", Icon: Layers },
  { key: "kick", label: "Kick", Icon: Gamepad2 },
];

const BY_KEY = new Map(SOCIAL_PLATFORMS.map((s) => [s.key, s]));

export function platformFor(key: string): SocialPlatform {
  return BY_KEY.get(key) ?? { key, label: key, Icon: Globe };
}

/** The profile's links in the canonical display order, unknowns last. */
export function orderedLinks(
  links: Record<string, string> | null | undefined,
): { platform: SocialPlatform; url: string }[] {
  if (!links) return [];
  const known: { platform: SocialPlatform; url: string }[] = [];
  for (const s of SOCIAL_PLATFORMS) {
    const url = links[s.key];
    if (typeof url === "string" && url) known.push({ platform: s, url });
  }
  const extras = Object.entries(links)
    .filter(([k, v]) => !BY_KEY.has(k) && typeof v === "string" && v)
    .map(([k, v]) => ({ platform: platformFor(k), url: v }));
  return [...known, ...extras];
}

/**
 * What to PRINT for a link — "@lisacollects", not forty characters of
 * https. The last meaningful path segment for profile-shaped URLs, the
 * bare host for everything else. Display only; the tap always opens the
 * canonical URL. Regex, not `new URL` — RN's URL polyfill is partial and
 * a display helper must never be the thing that throws.
 */
export function linkDisplayText(url: string): string {
  const m = /^https?:\/\/([^/?#]+)(\/[^?#]*)?/i.exec(url);
  if (!m?.[1]) return url;
  const host = m[1].replace(/^www\./i, "");
  const segments = (m[2] ?? "").split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && segments.length <= 2) {
    return last.startsWith("@") ? last : `@${last}`;
  }
  return host;
}
