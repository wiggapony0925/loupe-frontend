/**
 * Dev-only seeded personas catalog.
 *
 * Mirrors `documentation/test_personas.py` in the backend — 50 seeded
 * accounts that cover every meaningful product state. Used by the
 * `DevPersonaSheet` on the sign-in screen so we can one-tap into any
 * state without typing credentials.
 *
 * Keep this list in sync with the canonical Python registry whenever a
 * persona is added/removed. The shape is intentionally tiny — name,
 * email, blurb, why-unique, tags — so we don't drift on cosmetic
 * fields. Vault/AVG/scanner counts live on the rendered backend page at
 * `/test-users` for the authoritative reference.
 */

export const DEV_DEFAULT_PASSWORD = "Loupe2026!";

export type DevPersonaGroup =
  | "Empty / first-run"
  | "Beginners"
  | "Intermediate"
  | "Power users"
  | "Whales"
  | "Edge cases";

export interface DevPersona {
  /** "#01" .. "#50" — display label, matches backend page. */
  id: string;
  name: string;
  email: string;
  /**
   * `null` for SSO-only accounts that have no password to log in with —
   * those rows render as disabled (the FE can't simulate Apple/Google).
   */
  password: string | null;
  group: DevPersonaGroup;
  /** One-line headline shown directly under the name. */
  headline: string;
  /** Longer "why unique" description. */
  whyUnique: string;
  tags: readonly string[];
}

export const DEV_PERSONAS: readonly DevPersona[] = [
  // ── Empty / first-run ───────────────────────────────────────────────
  {
    id: "#01",
    name: "Ava Newbie",
    email: "test+01@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Empty / first-run",
    headline: "Zero state — brand-new account, nothing scanned.",
    whyUnique:
      "Use for onboarding screenshots: every list is empty, the Command Center shows the welcome state.",
    tags: ["empty", "onboarding"],
  },
  {
    id: "#02",
    name: "Ben Justpaired",
    email: "test+02@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Empty / first-run",
    headline: "Paired a Loupe today, has not scanned anything yet.",
    whyUnique:
      "Tests the post-pair / pre-first-scan moment — scanner widget shows the device but the vault is empty.",
    tags: ["empty", "scanner-only"],
  },
  {
    id: "#03",
    name: "Cleo Onecard",
    email: "test+03@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Empty / first-run",
    headline: "One scanned card, no scanner — pure phone-camera user.",
    whyUnique:
      "Smallest non-empty vault. Verifies single-row layouts (history sparkline of one point, etc.).",
    tags: ["minimal", "phone-only"],
  },
  {
    id: "#04",
    name: "Dax Firstscan",
    email: "test+04@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Empty / first-run",
    headline: "True first-scan flow: 1 scanner + 1 card, paired today.",
    whyUnique: "Perfect for the marketing demo of the very first end-to-end run.",
    tags: ["minimal", "demo"],
  },
  {
    id: "#05",
    name: "Eli Twodevs",
    email: "test+05@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Empty / first-run",
    headline: "Two scanners paired, but no scans yet.",
    whyUnique: "Stress-tests the device picker when no historical data exists.",
    tags: ["empty", "multi-device"],
  },

  // ── Beginners ───────────────────────────────────────────────────────
  {
    id: "#06",
    name: "Faye Genwun",
    email: "test+06@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Three Gen-1 Pokémon, mostly low grades.",
    whyUnique: "Low-grade-leaning vault — the value chart skews cheap.",
    tags: ["beginner", "pokemon"],
  },
  {
    id: "#07",
    name: "Gus Modern",
    email: "test+07@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Five modern Pokémon ultra-rares, clean grades.",
    whyUnique: "Healthy starter portfolio with a tight grade band.",
    tags: ["beginner", "pokemon"],
  },
  {
    id: "#08",
    name: "Hana Magicstart",
    email: "test+08@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Four Reserved-List Magic singles, mid grades.",
    whyUnique:
      "Small vault dominated by very high per-card value — exercises currency formatting on big numbers.",
    tags: ["beginner", "magic", "high-value"],
  },
  {
    id: "#09",
    name: "Ivo Yugihigh",
    email: "test+09@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Six Yu-Gi-Oh LOB classics, mid-to-high grades.",
    whyUnique: "Non-Pokémon non-Magic for TCG filter coverage.",
    tags: ["beginner", "yugioh"],
  },
  {
    id: "#10",
    name: "Joon Rookiehunter",
    email: "test+10@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Five NBA rookies, mostly PSA 9.",
    whyUnique: "Sports-only vault, great for testing sport-vs-TCG filters.",
    tags: ["beginner", "sports"],
  },
  {
    id: "#11",
    name: "Kai Diamonds",
    email: "test+11@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Four MLB stars on Topps Chrome.",
    whyUnique: "Mid-grade baseball-only — counterpart to Joon for sport coverage.",
    tags: ["beginner", "sports"],
  },
  {
    id: "#12",
    name: "Lia Strawhat",
    email: "test+12@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Five One Piece cards from Romance Dawn.",
    whyUnique: "Validates the `onepiece` TCG enum end-to-end.",
    tags: ["beginner", "onepiece"],
  },
  {
    id: "#13",
    name: "Mio Disneyfan",
    email: "test+13@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Four Lorcana TFC cards graded by Loupe.",
    whyUnique:
      "100% first-party (loupe) graded vault — useful for the 'house = loupe' badge UI.",
    tags: ["beginner", "lorcana"],
  },
  {
    id: "#14",
    name: "Nia Sampler",
    email: "test+14@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Six-card sampler across every TCG.",
    whyUnique: "One card per TCG — easiest way to screenshot a multi-TCG vault.",
    tags: ["beginner", "mixed"],
  },
  {
    id: "#15",
    name: "Owen Sportsmix",
    email: "test+15@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Beginners",
    headline: "Mix of basketball + baseball cards.",
    whyUnique: "Sports-leaning mixed bag — exercises TCG=sports filters.",
    tags: ["beginner", "sports", "mixed"],
  },

  // ── Intermediate ────────────────────────────────────────────────────
  {
    id: "#16",
    name: "Pia Holohunter",
    email: "test+16@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Twelve vintage Pokémon holos — mid-tier collector.",
    whyUnique:
      "Original Band-3 reference vault; matches the legacy `vintage_pokemon` profile.",
    tags: ["intermediate", "pokemon"],
  },
  {
    id: "#17",
    name: "Quin Modernset",
    email: "test+17@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Eighteen Crown-Zenith cards, average PSA 9.2.",
    whyUnique: "High-throughput modern grader; lots of recent scan timestamps.",
    tags: ["intermediate", "pokemon"],
  },
  {
    id: "#18",
    name: "Rae Reserved",
    email: "test+18@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Eight Magic Reserved-List singles.",
    whyUnique:
      "Highest per-card mean value of any persona — Black-Lotus territory.",
    tags: ["intermediate", "magic", "high-value"],
  },
  {
    id: "#19",
    name: "Sai Yugiveteran",
    email: "test+19@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Fifteen Yu-Gi-Oh LOB cards, PSA/CGC mix.",
    whyUnique: "Cross-house grade distribution; tests house-filter UI.",
    tags: ["intermediate", "yugioh"],
  },
  {
    id: "#20",
    name: "Tia Hoopshead",
    email: "test+20@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Fourteen Prizm basketball cards.",
    whyUnique:
      "Sports vault with enough scans to make the history chart non-degenerate.",
    tags: ["intermediate", "sports"],
  },
  {
    id: "#21",
    name: "Uri Mound",
    email: "test+21@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Sixteen baseball cards, two paired scanners.",
    whyUnique:
      "First multi-scanner persona in this band — tests device-attribution in scan history.",
    tags: ["intermediate", "sports", "multi-device"],
  },
  {
    id: "#22",
    name: "Vex Cgcsfan",
    email: "test+22@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Twenty modern Pokémon, CGC-leaning.",
    whyUnique:
      "Exercises a third grading house (CGC) heavily; default views skew PSA so this catches missed cases.",
    tags: ["intermediate", "pokemon", "cgc"],
  },
  {
    id: "#23",
    name: "Wyn Sealedplayer",
    email: "test+23@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Ten One Piece leader cards, gem-mint.",
    whyUnique: "Highest concentration of PSA 10s in a small vault.",
    tags: ["intermediate", "onepiece", "gem-mint"],
  },
  {
    id: "#24",
    name: "Xan Disneyvault",
    email: "test+24@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Nine Lorcana cards, Loupe-graded.",
    whyUnique:
      "Pure Loupe-house vault at intermediate size — useful for first-party grading screenshots.",
    tags: ["intermediate", "lorcana"],
  },
  {
    id: "#25",
    name: "Yui Mixedfun",
    email: "test+25@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Intermediate",
    headline: "Twenty-two cards across all TCGs, two devices.",
    whyUnique: "Best 'realistic average user' vault for marketing screenshots.",
    tags: ["intermediate", "mixed"],
  },

  // ── Power users ─────────────────────────────────────────────────────
  {
    id: "#26",
    name: "Zane Grindmaster",
    email: "test+26@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Sixty vintage Pokémon, three scanners.",
    whyUnique:
      "Heavy vintage vault with a fleet of devices — tests pagination on the vault list.",
    tags: ["power", "pokemon", "multi-device"],
  },
  {
    id: "#27",
    name: "Ada Modernpro",
    email: "test+27@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Eighty modern Pokémon scans, three devices.",
    whyUnique: "Largest single-TCG modern vault.",
    tags: ["power", "pokemon"],
  },
  {
    id: "#28",
    name: "Bex Magicwhale",
    email: "test+28@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Forty Reserved-List singles — six-figure vault.",
    whyUnique:
      "Highest total value in this band — exercises the '> $1M' edge case in currency formatting.",
    tags: ["power", "magic", "high-value"],
  },
  {
    id: "#29",
    name: "Cal Yugiarchive",
    email: "test+29@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Fifty-five Yu-Gi-Oh LOB cards.",
    whyUnique: "Deepest Yu-Gi-Oh vault — used to test bulk-house mixes.",
    tags: ["power", "yugioh"],
  },
  {
    id: "#30",
    name: "Dax Hoopslord",
    email: "test+30@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Sixty-five NBA cards across multiple scanners.",
    whyUnique: "Power-user sports vault with three devices.",
    tags: ["power", "sports", "multi-device"],
  },
  {
    id: "#31",
    name: "Eve Diamondking",
    email: "test+31@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Seventy baseball cards.",
    whyUnique: "Largest baseball-only vault.",
    tags: ["power", "sports"],
  },
  {
    id: "#32",
    name: "Finn Onepiecepro",
    email: "test+32@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Forty-five One Piece cards, gem-mint heavy.",
    whyUnique: "Power-user vault on an enum the legacy seeder under-covered.",
    tags: ["power", "onepiece", "gem-mint"],
  },
  {
    id: "#33",
    name: "Gia Castlecourt",
    email: "test+33@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Fifty Lorcana cards across two sets.",
    whyUnique: "Power-user Lorcana — useful for first-party grade ranking demos.",
    tags: ["power", "lorcana"],
  },
  {
    id: "#34",
    name: "Hugo Omnigrader",
    email: "test+34@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "One hundred cards, every TCG, every house.",
    whyUnique: "The widest distribution in the seed — every filter is exercised.",
    tags: ["power", "mixed"],
  },
  {
    id: "#35",
    name: "Ira Fleetowner",
    email: "test+35@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Power users",
    headline: "Five paired scanners (BLE + WiFi mix), 75 cards.",
    whyUnique: "First persona with 5 scanners — tests scanner-list pagination.",
    tags: ["power", "mixed", "fleet"],
  },

  // ── Whales ──────────────────────────────────────────────────────────
  {
    id: "#36",
    name: "Jett Vintagebaron",
    email: "test+36@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Whales",
    headline: "Two hundred vintage Pokémon, five-scanner shop.",
    whyUnique: "Whale-tier; useful for load-testing list endpoints.",
    tags: ["whale", "pokemon"],
  },
  {
    id: "#37",
    name: "Kit Modernshop",
    email: "test+37@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Whales",
    headline: "Three hundred modern Pokémon, five scanners.",
    whyUnique: "Largest single-TCG vault; pagination + summary aggregates.",
    tags: ["whale", "pokemon"],
  },
  {
    id: "#38",
    name: "Liv Reservedqueen",
    email: "test+38@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Whales",
    headline: "A hundred-twenty Reserved List singles — seven-figure vault.",
    whyUnique: "Highest absolute USD value of any persona.",
    tags: ["whale", "magic", "high-value"],
  },
  {
    id: "#39",
    name: "Mox Allcards",
    email: "test+39@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Whales",
    headline: "Five hundred cards across all TCGs — the stress-test account.",
    whyUnique:
      "Biggest vault in the seed. Use to validate the vault list, history aggregation, and summary endpoints perform under load.",
    tags: ["whale", "mixed", "stress"],
  },
  {
    id: "#40",
    name: "Nyx Sportsempire",
    email: "test+40@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Whales",
    headline: "Three-fifty mixed sports cards, five scanners.",
    whyUnique: "Sports-heavy whale; complements Mox for non-TCG load testing.",
    tags: ["whale", "sports"],
  },

  // ── Edge cases ──────────────────────────────────────────────────────
  {
    id: "#41",
    name: "Oz Grailonly",
    email: "test+41@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "Single Black Lotus PSA 10 — the grail holder.",
    whyUnique:
      "Tests the 'single ultra-high-value card' UI — sparklines, summary doughnut, and Top Movers all become 100% one card.",
    tags: ["edge", "grail", "high-value"],
  },
  {
    id: "#42",
    name: "Pax Allgemmint",
    email: "test+42@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "Twenty-five cards, every single one PSA 10.",
    whyUnique:
      "Zero variance in grade — tests grade-distribution charts when there's only one bucket.",
    tags: ["edge", "gem-mint"],
  },
  {
    id: "#43",
    name: "Qua Lowgrades",
    email: "test+43@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "Twenty vintage cards, all PSA 3-5.",
    whyUnique:
      "Opposite of Pax — all low grades. Catches off-by-one bugs in 'PSA 9+' filter logic.",
    tags: ["edge", "low-grade"],
  },
  {
    id: "#44",
    name: "Rio Apple",
    email: "test+44@loupe.app",
    password: null,
    group: "Edge cases",
    headline: "Sign-in with Apple, no password.",
    whyUnique: "Validates `apple_subject` auth path end-to-end.",
    tags: ["edge", "auth", "apple"],
  },
  {
    id: "#45",
    name: "Sky Google",
    email: "test+45@loupe.app",
    password: null,
    group: "Edge cases",
    headline: "Sign-in with Google, no password.",
    whyUnique: "Validates `google_subject` auth path end-to-end.",
    tags: ["edge", "auth", "google"],
  },
  {
    id: "#46",
    name: "Tor Offlinedev",
    email: "test+46@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "One scanner, last seen 30 days ago.",
    whyUnique: "Hardware widget should render the 'stale device' badge.",
    tags: ["edge", "offline"],
  },
  {
    id: "#47",
    name: "Uma Multitrans",
    email: "test+47@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "One BLE + one WiFi + one offline scanner.",
    whyUnique:
      "Every `ScannerTransportEnum` value is represented on one user simultaneously.",
    tags: ["edge", "multi-device", "transport-mix"],
  },
  {
    id: "#48",
    name: "Vic Newaccount",
    email: "test+48@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "Account + scanner created today, 4 scans in last hour.",
    whyUnique:
      "All timestamps within the last day — exercises the 'today' rollup on the activity feed.",
    tags: ["edge", "fresh"],
  },
  {
    id: "#49",
    name: "Wes Veteran",
    email: "test+49@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "Account is 4+ years old, steady moderate activity.",
    whyUnique:
      "Longest tenure in the seed — useful for 'member since' and lifetime-stats endpoints.",
    tags: ["edge", "tenure"],
  },
  {
    id: "#50",
    name: "Zed Burstuser",
    email: "test+50@loupe.app",
    password: DEV_DEFAULT_PASSWORD,
    group: "Edge cases",
    headline: "Created 3 days ago, already scanned 40 cards.",
    whyUnique:
      "Highest scan-velocity persona — tests rate-limit and bulk-write paths.",
    tags: ["edge", "high-velocity"],
  },
];

export const DEV_PERSONA_GROUPS: readonly DevPersonaGroup[] = [
  "Empty / first-run",
  "Beginners",
  "Intermediate",
  "Power users",
  "Whales",
  "Edge cases",
];
