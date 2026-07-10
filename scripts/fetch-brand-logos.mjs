#!/usr/bin/env node
/**
 * Fetch official TCG wordmarks into assets/brands/.
 * Run: node scripts/fetch-brand-logos.mjs
 *
 * Uses direct CDN URLs (not Wikimedia thumbnails — those 400 on non-standard
 * sizes). Bundled locally so React Native never hits hotlink blocks at runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../assets/brands");

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** Direct PNG URLs known to serve real image bytes (not HTML error pages). */
const SOURCES = {
  pokemon:
    "https://raw.githubusercontent.com/canocalir/pokedex-typescript/master/src/assets/pokemon-logo.png",
  magic:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Magicthegathering-logo.svg/330px-Magicthegathering-logo.svg.png",
  yugioh:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Yu-Gi-Oh%21.png/330px-Yu-Gi-Oh%21.png",
  onepiece: "https://en.onepiece-cardgame.com/images/common/header/logo.png",
  digimon: "https://world.digimoncard.com/images/common/header/logo.png",
  // Lorcana has no stable public CDN — drop a wordmark at assets/brands/lorcana.png manually.
  sports: "https://cdn-icons-png.flaticon.com/512/854/854045.png",
};

async function download(key, url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("image") && buf.length < 500) {
    throw new Error(`not an image (${ct}, ${buf.length} bytes)`);
  }
  // Reject HTML error pages masquerading as PNGs.
  if (buf.slice(0, 15).toString("utf8").includes("<!DOCTYPE")) {
    throw new Error("got HTML instead of image");
  }
  if (buf.length < 800) throw new Error(`too small (${buf.length} bytes)`);
  const target = path.join(OUT, `${key}.png`);
  fs.writeFileSync(target, buf);
  console.log(`✓ ${key} → ${target} (${buf.length.toLocaleString()} bytes)`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0;
  for (const [key, url] of Object.entries(SOURCES)) {
    try {
      await download(key, url);
      ok++;
    } catch (e) {
      console.warn(`✗ ${key}: ${e.message}`);
    }
  }
  console.log(`\nDone — ${ok}/${Object.keys(SOURCES).length} logos saved.`);
  if (ok === 0) process.exit(1);
}

main();
