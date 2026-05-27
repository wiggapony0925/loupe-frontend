#!/usr/bin/env node
/**
 * build-phash-manifest.mjs
 *
 * Generates a static perceptual-hash manifest for the Pokémon TCG. The
 * runtime cache (`cardHashCache.ts`) checks this manifest BEFORE
 * calling the backend identify endpoint, so the vast majority of scans
 * of well-known cards never round-trip the network.
 *
 * The hash function deliberately matches the native iOS / Android
 * `computePerceptualHash` implementation:
 *   - Downsample to 9×8 with bilinear (sharp default).
 *   - Use the green channel of the RGBA bitmap as a luminance proxy.
 *   - For each (y in 0..8, x in 0..8), set bit (y*8+x) when
 *     pixel(y,x).green > pixel(y,x+1).green.
 *   - Render as `%016x` zero-padded hex.
 *
 * USAGE
 *   node scripts/build-phash-manifest.mjs                # full catalogue
 *   node scripts/build-phash-manifest.mjs --limit 2000   # top N most relevant
 *   node scripts/build-phash-manifest.mjs --resume       # skip cards already hashed
 *
 * OUTPUT
 *   assets/data/phash-manifest.json
 *   Shape: { generatedAt, version, entries: { [hash]: PhashEntry } }
 *
 * REQUIRES
 *   sharp     (devDependency — `npm i -D sharp`)
 *
 * Free Pokémon TCG API tier covers this easily (~one full pull every
 * few minutes). Set `POKEMONTCG_API_KEY` env to use your authenticated
 * 20k/day quota for faster pulls.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "assets", "data");
const OUT_FILE = join(OUT_DIR, "phash-manifest.json");

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const CONCURRENCY = 8;
const API_KEY = process.env.POKEMONTCG_API_KEY || null;
const PAGE_SIZE = 250;
const BASE = "https://api.pokemontcg.io/v2";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "✗ This script needs `sharp`. Install with:\n    npm install --save-dev sharp\n",
  );
  process.exit(1);
}

function headers() {
  const h = { Accept: "application/json" };
  if (API_KEY) h["X-Api-Key"] = API_KEY;
  return h;
}

async function fetchPage(page) {
  const url = `${BASE}/cards?page=${page}&pageSize=${PAGE_SIZE}&select=id,name,number,set,images,nationalPokedexNumbers,rarity`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`pokemontcg page=${page} → ${res.status}`);
  return res.json();
}

/**
 * Compute a 64-bit dHash over a 9×8 grayscale downsample. The output
 * format and bit ordering MUST match the native iOS / Android impl in
 * `LoupeScannerBridgeModule.{swift,kt}` so cache hits work cross-stack.
 */
async function hashImage(buf) {
  const { data } = await sharp(buf)
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // `data` is RGB (3 bytes per pixel) since we removed alpha.
  // Green channel is at offset (y*9 + x)*3 + 1.
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[(y * 9 + x) * 3 + 1];
      const right = data[(y * 9 + x + 1) * 3 + 1];
      if (left > right) {
        bits |= 1n << BigInt(y * 8 + x);
      }
    }
  }
  return bits.toString(16).padStart(16, "0");
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function runWithConcurrency(items, n, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: n }).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { error: err.message };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Load existing manifest for --resume.
  let existing = { entries: {} };
  if (RESUME && existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(await readFile(OUT_FILE, "utf8"));
      console.log(`→ Resuming from ${Object.keys(existing.entries).length} cached entries.`);
    } catch {
      console.warn("⚠ Could not parse existing manifest; starting fresh.");
    }
  }
  const seenCardIds = new Set(
    Object.values(existing.entries).map((e) => e.cardId),
  );

  // Pull catalogue page-by-page.
  console.log("→ Fetching Pokémon TCG catalogue…");
  const allCards = [];
  let page = 1;
  while (true) {
    const json = await fetchPage(page);
    if (!json.data?.length) break;
    allCards.push(...json.data);
    process.stdout.write(`  page ${page}: ${allCards.length} cards\r`);
    if (allCards.length >= LIMIT) break;
    if (json.data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`\n→ ${allCards.length} cards in catalogue`);

  const todo = allCards
    .filter((c) => c.images?.small && !seenCardIds.has(c.id))
    .slice(0, Number.isFinite(LIMIT) ? LIMIT : allCards.length);

  console.log(`→ ${todo.length} cards to hash (concurrency=${CONCURRENCY})`);

  let done = 0;
  const newEntries = {};
  await runWithConcurrency(todo, CONCURRENCY, async (card) => {
    const buf = await downloadImage(card.images.small);
    const hash = await hashImage(buf);
    newEntries[hash] = {
      cardId: card.id,
      name: card.name,
      number: card.number ?? null,
      setId: card.set?.id ?? null,
      setName: card.set?.name ?? null,
      imageUrl: card.images.large ?? card.images.small,
      rarity: card.rarity ?? null,
      dex: card.nationalPokedexNumbers?.[0] ?? null,
    };
    done++;
    if (done % 25 === 0 || done === todo.length) {
      process.stdout.write(`  hashed ${done}/${todo.length}\r`);
    }
  });

  const merged = {
    generatedAt: new Date().toISOString(),
    version: 1,
    source: "pokemontcg.io v2",
    entries: { ...existing.entries, ...newEntries },
  };
  await writeFile(OUT_FILE, JSON.stringify(merged));
  const kb = (Buffer.byteLength(JSON.stringify(merged)) / 1024).toFixed(0);
  console.log(
    `\n✓ Wrote ${Object.keys(merged.entries).length} entries to ${OUT_FILE} (${kb} KB)`,
  );
}

main().catch((err) => {
  console.error("✗ Build failed:", err);
  process.exit(1);
});
