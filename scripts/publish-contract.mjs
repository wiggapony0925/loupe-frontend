#!/usr/bin/env node
/**
 * Publish this app's consumer contract to the backend, which verifies it in CI.
 *
 * THE POINT. `npm run generate:api-types` pulls types FROM the backend, so the
 * app learns about changes only when someone remembers to re-run it — and the
 * backend never learns anything about us at all. It can delete an endpoint this
 * app calls and its build stays green. This runs the other way: it hands the
 * backend a list of what we depend on, and the backend's CI fails if it stops
 * providing any of it.
 *
 * WHY A FILE AND NOT A PACT BROKER. A broker is a service that stores contracts
 * and answers "can I deploy". With one API and two clients owned by one person,
 * git already stores versioned artifacts and CI already blocks bad merges, so a
 * broker would be infrastructure to host and keep alive for coordination that
 * does not exist yet. If a second team ever owns a consumer, that is the moment
 * this file becomes a `pact-broker publish` call and not before.
 *
 * THE ROT PROBLEM, AND WHAT IS DONE ABOUT IT. A hand-maintained contract slowly
 * stops describing the app: someone adds a call and never adds a contract entry,
 * so the backend can break it freely and the check still passes green. This
 * script therefore refuses to publish silently while that is true — it scans the
 * source for endpoint literals and reports any that the contract does not
 * declare. --strict turns that report into a failure, which is what CI runs.
 *
 * Usage:
 *   node scripts/publish-contract.mjs            # publish, warn about drift
 *   node scripts/publish-contract.mjs --strict   # fail on drift (CI)
 *   node scripts/publish-contract.mjs --check    # verify only, write nothing
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..");
const SRC = join(APP_ROOT, "src");
const CONTRACT = join(APP_ROOT, "contracts", "loupe-frontend.contract.json");
const BACKEND_CONTRACTS = join(APP_ROOT, "..", "loupe-backend", "contracts");

const argv = new Set(process.argv.slice(2));
const STRICT = argv.has("--strict");
// --strict implies --check: CI verifies, it does not write. A CI job that
// republished the contract would rewrite the very artifact it is meant to be
// checking against, and the gate would pass by construction every time.
const CHECK_ONLY = argv.has("--check") || STRICT;

/**
 * Compare paths without caring how the parameter is spelled.
 *
 * The `${...}` pattern allows one level of nesting because interpolations are
 * routinely calls, not bare identifiers — `${encodeURIComponent(handle)}`. A
 * naive `[^}]*` handles that one, but the capture regex below must also allow
 * parentheses inside the literal or it truncates mid-expression and emits a
 * path like "/v1/cards/identify/${encodeURIComponent(identificationId".
 */
/**
 * Replace every `${...}` with `{}`, however deeply nested.
 *
 * Regex cannot do this and the attempts to make it are what produced two
 * separate silent bugs here. Real entries in these registries look like
 *
 *     `${V1}/sets${qs ? `?${qs}` : ""}`
 *
 * — an interpolation containing a NESTED BACKTICK. Any pattern that ends the
 * literal at a backtick truncates that to "/v1/sets${qs", which resolves
 * against nothing, so the endpoint silently vanishes from the contract and the
 * backend is free to delete it. A depth-tracking scan is the only thing that
 * handles it, so paths are collapsed here BEFORE anything looks for them.
 */
function collapseInterpolations(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "$" && text[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
      }
      out += "{}";
      i = j - 1;
      continue;
    }
    out += text[i];
  }
  return out;
}

function normalise(path) {
  let out = collapseInterpolations(path).replace(/\{[^}]*\}/g, "{}");

  // OpenAPI paths carry no query string, but call sites do — "/v1/grades?{}",
  // "/v1/cards/trending?limit=60". Cut at the first '?'.
  out = out.split("?")[0];

  // A trailing "{}" that is NOT its own segment came from an interpolated query
  // string glued straight onto the path ("/v1/app/config${qs}"), not from a path
  // parameter. Left in, it invents an endpoint that does not exist.
  out = out.replace(/([^/])\{\}$/, "$1");

  return out.replace(/\/+$/, "");
}

/**
 * Path-ish literals inside a quoted or backticked string.
 *
 * Two patterns, because the terminator differs. A backticked template may
 * contain spaces and quotes inside its interpolations —
 * `/v1/sets${qs ? "?" + qs : ""}` is real code here — so it must be captured up
 * to its CLOSING BACKTICK rather than up to the first space. Stopping at
 * whitespace truncates it to "/v1/sets${qs", which then resolves against
 * nothing and quietly drops a real dependency from the contract.
 */
const PATH_LITERALS = [
  /`(\/(?:v1|health|version|metrics)[^`]*)`/g,
  /"(\/(?:v1|health|version|metrics)[^"]*)"/g,
  /'(\/(?:v1|health|version|metrics)[^']*)'/g,
];

/** Every path-ish literal in a chunk of source. */
function* pathLiterals(text) {
  for (const re of PATH_LITERALS) {
    for (const m of text.matchAll(re)) yield m[1];
  }
}

/**
 * Strip comments before looking for paths.
 *
 * This is not fussiness. The wire/*.ts modules document the endpoint each one
 * models in their header comment ("Market wire types — `/v1/cards/{id}/market`
 * …"), and a plain grep counts those: 86 of the 104 matches in this app are
 * prose, against 18 real call sites. Without this, --strict would fail forever
 * on documentation and the gate would be turned off within a week.
 */
function stripComments(text) {
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return "";
      return line;
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Paths declared in the ENDPOINTS registry — the app's own single source of
 * truth (src/infrastructure/http/endpoints.ts). Entries are template literals
 * built from a `${V1}` prefix, either as constants or as small functions for
 * parameterised routes, so both shapes are matched here.
 */
function endpointsInRegistry() {
  const file = join(SRC, "infrastructure", "http", "endpoints.ts");
  if (!existsSync(file)) return new Map();
  const text = collapseInterpolations(stripComments(readFileSync(file, "utf8")));
  const found = new Map();
  // Capture to the CLOSING BACKTICK, not to whitespace: registry entries
  // interpolate query strings inline — `${V1}/sets${qs ? "?" + qs : ""}` — and
  // stopping at the space yields "/v1/sets${qs", a path that matches nothing
  // and silently drops the endpoint from the contract.
  for (const m of text.matchAll(/`\{\}(\/[^`]*)`/g)) {
    found.set(normalise("/v1" + m[1]), "src/infrastructure/http/endpoints.ts");
  }
  for (const m of text.matchAll(/["`](\/(?:health|version|metrics)[^"`\s]*)/g)) {
    found.set(normalise(m[1]), "src/infrastructure/http/endpoints.ts");
  }
  return found;
}

/** Call sites that bypass the registry and write the path inline. */
function endpointsInlinedElsewhere() {
  let files;
  try {
    files = execSync(
      `grep -rlE '["\`]/v1/' --include='*.ts' --include='*.tsx' ${JSON.stringify(SRC)}`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    return new Map(); // grep exits 1 when nothing matches
  }

  const found = new Map();
  for (const file of files) {
    // Generated types are a copy of the backend's own schema, not a statement
    // about what this app uses.
    if (file.includes("__generated__")) continue;
    // Test fixtures name endpoints they mock, which is not a dependency either.
    if (/\.(test|spec|vitest)\.[tj]sx?$/.test(file)) continue;
    if (file.endsWith("endpoints.ts")) continue; // counted above

    const text = collapseInterpolations(stripComments(readFileSync(file, "utf8")));
    for (const raw of pathLiterals(text)) {
      const key = normalise(raw);
      if (!key || key === "/v1") continue;
      if (!found.has(key)) found.set(key, relative(APP_ROOT, file));
    }
  }
  return found;
}

/** Everything this app calls, from both sources. */
function endpointsInSource() {
  const all = new Map(endpointsInRegistry());
  for (const [path, file] of endpointsInlinedElsewhere()) {
    if (!all.has(path)) all.set(path, file);
  }
  return all;
}

function main() {
  if (!existsSync(CONTRACT)) {
    console.error(`No contract at ${relative(APP_ROOT, CONTRACT)}.`);
    console.error("This file is the app's declaration of what it needs from the API.");
    process.exit(1);
  }

  const contract = JSON.parse(readFileSync(CONTRACT, "utf8"));
  const declared = new Set((contract.endpoints ?? []).map((e) => normalise(e.path)));

  const inRegistry = endpointsInRegistry();
  const inlined = endpointsInlinedElsewhere();
  const inSource = endpointsInSource();
  const undeclared = [...inSource.entries()].filter(([path]) => !declared.has(path));

  console.log(
    `Contract declares ${declared.size} endpoint(s); source references ` +
      `${inSource.size} (${inRegistry.size} via the ENDPOINTS registry, ` +
      `${inlined.size} inlined elsewhere).`,
  );

  // Not a contract problem, but the registry calls itself the single source of
  // truth and these are the places that is not true. Worth a line every run.
  if (inlined.size) {
    const files = [...new Set(inlined.values())];
    console.log(
      `\n${inlined.size} path(s) bypass the ENDPOINTS registry, in ` +
        `${files.length} file(s): ${files.join(", ")}`,
    );
  }

  if (undeclared.length) {
    console.log(
      `\n${undeclared.length} endpoint(s) called in source but NOT in the contract.\n` +
        `The backend is free to break these without failing its build:\n`,
    );
    for (const [path, file] of undeclared.slice(0, 25)) {
      console.log(`  · ${path}   (${file})`);
    }
    if (undeclared.length > 25) console.log(`  … ${undeclared.length - 25} more`);
    if (STRICT) {
      console.error(
        "\n--strict: refusing to publish a contract that does not describe the app.",
      );
      process.exit(1);
    }
  }

  // Stale in the other direction: declared but no longer called. Harmless to the
  // backend's build, but it pins endpoints nobody uses, so it is worth saying.
  const orphaned = [...declared].filter((p) => !inSource.has(p));
  if (orphaned.length) {
    console.log(
      `\n${orphaned.length} endpoint(s) in the contract with no call site left — ` +
        `remove them so the backend is not held to something we stopped using:`,
    );
    for (const p of orphaned.slice(0, 15)) console.log(`  · ${p}`);
  }

  if (CHECK_ONLY) {
    console.log("\n--check: nothing written.");
    return;
  }

  let sha = "unknown";
  try {
    sha = execSync("git rev-parse --short HEAD", { cwd: APP_ROOT, encoding: "utf8" }).trim();
  } catch {
    /* not a git checkout; the contract is still valid, just unversioned */
  }

  const published = {
    ...contract,
    publishedFrom: { consumer: contract.consumer, commit: sha },
  };

  mkdirSync(BACKEND_CONTRACTS, { recursive: true });
  const target = join(BACKEND_CONTRACTS, `${contract.consumer}.json`);
  writeFileSync(target, JSON.stringify(published, null, 2) + "\n");
  console.log(`\nPublished ${contract.consumer}@${sha} -> ${target}`);
  console.log("Commit it in loupe-backend so its CI verifies against it.");
}

main();
