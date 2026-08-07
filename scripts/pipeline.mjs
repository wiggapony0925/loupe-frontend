#!/usr/bin/env node
/**
 * Loupe release pipeline — one screen showing every stage the app passes
 * through on its way to your phone, and a hard switch that decides WHERE
 * binaries get built.
 *
 * Why this exists: EAS bills per cloud BUILD (EAS Update is a separate,
 * much cheaper meter). A stray `eas build` costs real money, and most
 * releases don't need a binary at all — if no native input changed, the
 * existing TestFlight build can just download new JS. This tool makes that
 * decision explicit instead of a habit.
 *
 *   npm run pipeline           status: stages, native fingerprint, switch
 *   npm run pipeline:check     run the verification stages (types/lint/tests)
 *   npm run pipeline:ship      verify, then OTA — refuses if native drifted
 *   npm run pipeline:build     build the binary (routes by the switch)
 *   npm run pipeline:cloud on|off   flip the cloud-build switch
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, "pipeline.config.json");
const FINGERPRINT_PATH = join(ROOT, ".pipeline-fingerprint.json");

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  mag: "\x1b[35m",
};

const DEFAULT_CONFIG = {
  /** "local" = build on this Mac (free). "cloud" = EAS build (BILLED). */
  buildTarget: "local",
  /**
   * Master lock. While true, nothing in this pipeline will start a cloud
   * build no matter what buildTarget says. Flip with:
   *   npm run pipeline:cloud on
   */
  cloudBuildsLocked: true,
};

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    return { ...DEFAULT_CONFIG };
  }
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`);
}

function sh(cmd, { capture = true } = {}) {
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      encoding: "utf8",
    });
    return { ok: true, out: (out ?? "").trim() };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
}

/**
 * The native fingerprint: a hash of everything that must be compiled in.
 * If it matches the last shipped build, a new binary buys you NOTHING —
 * ship JS instead and save the build.
 */
function nativeFingerprint(platform = "ios") {
  // The CLI prints a JSON document whose `hash` is the fingerprint; the
  // `sources` array (every native input it hashed) is large, so parse
  // rather than eyeball it.
  const res = sh(
    `npx --no-install expo-updates fingerprint:generate --platform ${platform}`,
  );
  if (!res.ok) return null;
  try {
    const doc = JSON.parse(res.out);
    return typeof doc.hash === "string" ? doc.hash : null;
  } catch {
    return null;
  }
}

function lastShipped() {
  if (!existsSync(FINGERPRINT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(FINGERPRINT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function recordShipped(fingerprint, buildNumber) {
  writeFileSync(
    FINGERPRINT_PATH,
    `${JSON.stringify(
      { fingerprint, buildNumber, at: new Date().toISOString() },
      null,
      2,
    )}\n`,
  );
}

const STAGES = [
  {
    id: "typecheck",
    label: "Types",
    detail: "tsc --noEmit",
    run: () => sh("npm run typecheck"),
  },
  {
    id: "lint",
    label: "Lint",
    detail: "eslint",
    run: () => sh("npx eslint app src --max-warnings=0"),
  },
  {
    id: "test",
    label: "Tests",
    detail: "jest",
    run: () => sh("npx jest --silent"),
  },
  {
    id: "contract",
    label: "API contract",
    detail: "endpoints ↔ backend OpenAPI",
    run: () => sh("npx jest --silent endpoints.contract"),
  },
];

function header(cfg) {
  const locked = cfg.cloudBuildsLocked;
  const target = locked ? "local (LOCKED)" : cfg.buildTarget;
  const color = locked || cfg.buildTarget === "local" ? C.green : C.red;
  console.log(`\n${C.bold}Loupe release pipeline${C.reset}`);
  console.log(
    `${C.dim}────────────────────────────────────────────────────────${C.reset}`,
  );
  console.log(
    `  Build target   ${color}${C.bold}${target}${C.reset}` +
      `${locked ? `  ${C.dim}cloud builds cannot start${C.reset}` : ""}`,
  );
  console.log(
    `  Cost model     ${C.dim}EAS BUILD = billed per build · EAS UPDATE = cheap (per-user meter)${C.reset}`,
  );
}

function fingerprintPanel() {
  const current = nativeFingerprint();
  const prev = lastShipped();
  console.log(`\n${C.bold}Native fingerprint${C.reset}`);
  if (!current) {
    console.log(`  ${C.yellow}unavailable${C.reset} ${C.dim}(expo-updates CLI didn't answer)${C.reset}`);
    return { current, needsBuild: null };
  }
  const short = current.slice(0, 12);
  if (!prev) {
    console.log(`  current ${C.cyan}${short}${C.reset}`);
    console.log(
      `  ${C.dim}no shipped build recorded yet — run pipeline:build once to set the baseline${C.reset}`,
    );
    return { current, needsBuild: null };
  }
  const same = prev.fingerprint === current;
  console.log(`  current ${C.cyan}${short}${C.reset}`);
  console.log(
    `  shipped ${C.cyan}${prev.fingerprint.slice(0, 12)}${C.reset} ${C.dim}(build ${prev.buildNumber ?? "?"}, ${prev.at?.slice(0, 10)})${C.reset}`,
  );
  console.log(
    same
      ? `  ${C.green}✔ unchanged — SHIP JS ONLY. A new binary would cost money and change nothing.${C.reset}`
      : `  ${C.yellow}▲ native code changed — a new binary IS needed (build it locally).${C.reset}`,
  );
  return { current, needsBuild: !same };
}

function stagePanel(results) {
  console.log(`\n${C.bold}Stages${C.reset}`);
  for (const s of STAGES) {
    const r = results?.[s.id];
    const mark = !r ? `${C.dim}◦${C.reset}` : r.ok ? `${C.green}✔${C.reset}` : `${C.red}✖${C.reset}`;
    const state = !r ? `${C.dim}not run${C.reset}` : r.ok ? "pass" : `${C.red}FAIL${C.reset}`;
    console.log(
      `  ${mark} ${s.label.padEnd(14)}${state.padEnd(16)}${C.dim}${s.detail}${C.reset}`,
    );
  }
  console.log(`\n${C.bold}Delivery${C.reset}`);
  console.log(
    `  ${C.mag}JS${C.reset}     OTA update → channel production   ${C.dim}npm run pipeline:ship${C.reset}`,
  );
  console.log(
    `  ${C.mag}Native${C.reset} local build → TestFlight          ${C.dim}npm run pipeline:build${C.reset}`,
  );
}

function runStages() {
  const results = {};
  for (const s of STAGES) {
    process.stdout.write(`  ${C.dim}running ${s.label}…${C.reset}\r`);
    const r = s.run();
    results[s.id] = r;
    const mark = r.ok ? `${C.green}✔${C.reset}` : `${C.red}✖${C.reset}`;
    console.log(`  ${mark} ${s.label.padEnd(14)}${r.ok ? "pass" : `${C.red}FAIL${C.reset}`}          `);
    if (!r.ok) {
      console.log(`\n${C.red}${r.out.split("\n").slice(-25).join("\n")}${C.reset}`);
      return { results, ok: false };
    }
  }
  return { results, ok: true };
}

function cmdStatus() {
  const cfg = loadConfig();
  header(cfg);
  fingerprintPanel();
  stagePanel(null);
  console.log(
    `\n${C.dim}  npm run pipeline:check  ·  pipeline:ship  ·  pipeline:build  ·  pipeline:cloud on|off${C.reset}\n`,
  );
}

function cmdCheck() {
  const cfg = loadConfig();
  header(cfg);
  console.log(`\n${C.bold}Stages${C.reset}`);
  const { ok } = runStages();
  console.log(
    ok ? `\n${C.green}All stages pass.${C.reset}\n` : `\n${C.red}Pipeline blocked.${C.reset}\n`,
  );
  process.exit(ok ? 0 : 1);
}

function cmdShip() {
  const cfg = loadConfig();
  header(cfg);
  console.log(`\n${C.bold}Stages${C.reset}`);
  const { ok } = runStages();
  if (!ok) {
    console.log(`\n${C.red}Not shipping — fix the failing stage first.${C.reset}\n`);
    process.exit(1);
  }
  const { needsBuild } = fingerprintPanel();
  if (needsBuild) {
    console.log(
      `\n${C.yellow}Heads up:${C.reset} native code changed since the last build, so this OTA`,
    );
    console.log(
      `  won't reach anyone until a new binary ships. Run ${C.bold}npm run pipeline:build${C.reset} after.`,
    );
  }
  console.log(`\n${C.bold}Publishing OTA…${C.reset}\n`);
  const msg = process.argv.slice(3).join(" ") || "Pipeline release";
  const res = spawnSync(
    "npx",
    [
      "eas",
      "update",
      "--channel",
      "production",
      "--environment",
      "production",
      "--message",
      msg,
      "--non-interactive",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  process.exit(res.status ?? 1);
}

function cmdBuild() {
  const cfg = loadConfig();
  header(cfg);

  if (cfg.cloudBuildsLocked || cfg.buildTarget === "local") {
    const script = join(ROOT, "scripts", "build-ios-local.sh");
    if (!existsSync(script)) {
      console.log(`\n${C.red}Local build script missing: ${script}${C.reset}\n`);
      process.exit(1);
    }
    console.log(`\n${C.bold}Building locally (free)…${C.reset}\n`);
    const res = spawnSync("bash", [script], { cwd: ROOT, stdio: "inherit" });
    if (res.status === 0) {
      const fp = nativeFingerprint();
      let buildNumber = null;
      try {
        buildNumber = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")).expo
          ?.ios?.buildNumber;
      } catch {
        /* best effort */
      }
      if (fp) recordShipped(fp, buildNumber);
      console.log(
        `\n${C.green}Built locally. Fingerprint baseline recorded${C.reset}` +
          `${buildNumber ? ` ${C.dim}(build ${buildNumber})${C.reset}` : ""}\n`,
      );
    }
    process.exit(res.status ?? 1);
  }

  // Cloud path — only reachable with the lock explicitly off.
  console.log(
    `\n${C.red}${C.bold}This would start a BILLED EAS cloud build.${C.reset}`,
  );
  console.log(
    `  The lock is off (${C.bold}cloudBuildsLocked: false${C.reset}). Re-lock with:`,
  );
  console.log(`    ${C.bold}npm run pipeline:cloud off${C.reset}`);
  console.log(
    `\n  To proceed anyway, run the EAS command yourself — this tool won't spend for you.\n`,
  );
  process.exit(1);
}

function cmdCloud(arg) {
  const cfg = loadConfig();
  if (arg === "on") {
    cfg.cloudBuildsLocked = false;
    cfg.buildTarget = "cloud";
    saveConfig(cfg);
    console.log(
      `\n${C.red}Cloud builds UNLOCKED.${C.reset} Builds are billed per job.`,
    );
    console.log(`${C.dim}Re-lock: npm run pipeline:cloud off${C.reset}\n`);
  } else if (arg === "off") {
    cfg.cloudBuildsLocked = true;
    cfg.buildTarget = "local";
    saveConfig(cfg);
    console.log(
      `\n${C.green}Cloud builds LOCKED.${C.reset} Binaries build on this Mac (free).\n`,
    );
  } else {
    console.log(`\nUsage: npm run pipeline:cloud on|off\n`);
    process.exit(1);
  }
}

const [, , cmd, arg] = process.argv;
switch (cmd) {
  case "check":
    cmdCheck();
    break;
  case "ship":
    cmdShip();
    break;
  case "build":
    cmdBuild();
    break;
  case "cloud":
    cmdCloud(arg);
    break;
  default:
    cmdStatus();
}
