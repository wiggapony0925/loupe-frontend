#!/usr/bin/env node
/**
 * fetch-set-logos.mjs
 *
 * Pulls set logos / symbols from the three permissive public TCG APIs:
 *   - Pokémon TCG API   (https://api.pokemontcg.io/v2/sets)   → logo + symbol PNG
 *   - Scryfall          (https://api.scryfall.com/sets)        → symbol SVG
 *   - YGOPRODeck        (https://db.ygoprodeck.com/api/v7/cardsets.php) → set names only (no logos)
 *
 * Output tree:
 *   assets/sets/pokemon/<set_id>.{logo,symbol}.png
 *   assets/sets/magic/<set_code>.svg
 *   assets/sets/_index.json  (manifest mapping franchise+id → file paths + metadata)
 *
 * USAGE
 *   node scripts/fetch-set-logos.mjs            # fetch everything
 *   node scripts/fetch-set-logos.mjs --pokemon  # only one source
 *   node scripts/fetch-set-logos.mjs --limit 5  # smoke test
 *
 * LICENSING NOTE
 *   Each upstream API has its own terms — Scryfall asks for attribution,
 *   Pokémon TCG API permits app use, YGOPRODeck requires attribution.
 *   Review their ToS before shipping anything sourced here.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "assets", "sets");

const args = process.argv.slice(2);
const only = {
  pokemon: args.includes("--pokemon") || (!args.includes("--magic") && !args.includes("--yugioh")),
  magic: args.includes("--magic") || (!args.includes("--pokemon") && !args.includes("--yugioh")),
  yugioh: args.includes("--yugioh") || (!args.includes("--pokemon") && !args.includes("--magic")),
};
// If user passed any explicit --xxx flag, restrict to just those.
if (args.some((a) => a === "--pokemon" || a === "--magic" || a === "--yugioh")) {
  only.pokemon = args.includes("--pokemon");
  only.magic = args.includes("--magic");
  only.yugioh = args.includes("--yugioh");
}
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

const manifest = { pokemon: [], magic: [], yugioh: [], fetchedAt: new Date().toISOString() };

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "loupe-set-logo-fetcher/1.0 (+local-dev)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} :: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

/* ------------------------------ Pokémon TCG ------------------------------ */
async function fetchPokemon() {
  console.log("\n── Pokémon TCG API ──");
  const dir = join(OUT_DIR, "pokemon");
  await ensureDir(dir);
  const res = await fetch("https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate", {
    headers: { "User-Agent": "loupe-set-logo-fetcher/1.0" },
  });
  if (!res.ok) throw new Error(`Pokémon API failed: ${res.status}`);
  const json = await res.json();
  const sets = (json.data ?? []).slice(0, LIMIT);
  console.log(`  ${sets.length} sets available`);

  for (const s of sets) {
    const id = s.id;
    const entry = { id, name: s.name, series: s.series, releaseDate: s.releaseDate, files: {} };
    try {
      if (s.images?.logo) {
        const path = join(dir, `${id}.logo.png`);
        const size = await download(s.images.logo, path);
        entry.files.logo = `assets/sets/pokemon/${id}.logo.png`;
        entry.logoBytes = size;
      }
      if (s.images?.symbol) {
        const path = join(dir, `${id}.symbol.png`);
        const size = await download(s.images.symbol, path);
        entry.files.symbol = `assets/sets/pokemon/${id}.symbol.png`;
        entry.symbolBytes = size;
      }
      console.log(`  ✓ ${id.padEnd(10)} ${s.name}`);
    } catch (e) {
      console.warn(`  ✗ ${id} — ${e.message}`);
    }
    manifest.pokemon.push(entry);
  }
}

/* --------------------------------- Magic --------------------------------- */
async function fetchMagic() {
  console.log("\n── Scryfall (Magic: The Gathering) ──");
  const dir = join(OUT_DIR, "magic");
  await ensureDir(dir);
  const res = await fetch("https://api.scryfall.com/sets", {
    headers: { "User-Agent": "loupe-set-logo-fetcher/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Scryfall failed: ${res.status}`);
  const json = await res.json();
  // Filter to "real" sets — skip tokens/memorabilia/promos to keep the list tractable.
  const realTypes = new Set(["core", "expansion", "masters", "draft_innovation", "commander", "starter"]);
  const sets = (json.data ?? [])
    .filter((s) => realTypes.has(s.set_type))
    .slice(0, LIMIT);
  console.log(`  ${sets.length} sets available`);

  for (const s of sets) {
    const code = s.code;
    const entry = { code, name: s.name, set_type: s.set_type, releaseDate: s.released_at, files: {} };
    try {
      if (s.icon_svg_uri) {
        const path = join(dir, `${code}.svg`);
        const size = await download(s.icon_svg_uri, path);
        entry.files.symbol = `assets/sets/magic/${code}.svg`;
        entry.symbolBytes = size;
      }
      console.log(`  ✓ ${code.padEnd(6)} ${s.name}`);
    } catch (e) {
      console.warn(`  ✗ ${code} — ${e.message}`);
    }
    manifest.magic.push(entry);
  }
}

/* -------------------------------- Yu-Gi-Oh ------------------------------- */
async function fetchYugioh() {
  console.log("\n── YGOPRODeck ──");
  // YGOPRODeck's cardsets.php endpoint returns set names + card counts but
  // NOT logo URLs. Per-set logos aren't part of the public API; we still
  // capture the manifest so callers can fall back to TcgMark glyphs and
  // know which set names are canonical.
  const res = await fetch("https://db.ygoprodeck.com/api/v7/cardsets.php", {
    headers: { "User-Agent": "loupe-set-logo-fetcher/1.0" },
  });
  if (!res.ok) throw new Error(`YGOPRODeck failed: ${res.status}`);
  const data = await res.json();
  const sets = data.slice(0, LIMIT);
  console.log(`  ${sets.length} sets (metadata only — no logo URLs in public API)`);
  for (const s of sets) {
    manifest.yugioh.push({
      code: s.set_code,
      name: s.set_name,
      releaseDate: s.tcg_date,
      cardCount: s.num_of_cards,
      files: {},
    });
  }
}

/* ---------------------------------- main --------------------------------- */
(async () => {
  await ensureDir(OUT_DIR);
  if (only.pokemon) await fetchPokemon();
  if (only.magic) await fetchMagic();
  if (only.yugioh) await fetchYugioh();

  const manifestPath = join(OUT_DIR, "_index.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log("\n── done ──");
  console.log(`manifest: ${manifestPath}`);
  console.log(
    `counts → pokemon:${manifest.pokemon.length}  magic:${manifest.magic.length}  yugioh:${manifest.yugioh.length}`,
  );
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
