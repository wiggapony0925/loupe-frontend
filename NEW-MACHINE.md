# Rebuilding the Loupe dev environment on a new Mac

**Audience: an AI coding agent (Claude Code) running locally on Jeffrey's new
MacBook, with a human at the keyboard who can approve prompts, enter
passwords, and complete 2FA.**

The previous laptop was lost along with everything on it. Every fact in this
document was verified by reading the actual repositories — the directory
layout, version pins, scripts, and env keys are real, not assumed. Follow it
top to bottom. Each phase ends with a **GATE**: a command whose output tells
you whether to continue or stop and fix.

---

## 0. Read this before running anything

### What was NOT lost

Everything that matters is on GitHub or in Google Cloud:

| Thing | Where it lives | Recoverable? |
|---|---|---|
| All three codebases | GitHub (`wiggapony0925/*`) | Yes — clone |
| Shared `packages/*` (7 of them) | inside the `loupe-web` repo | Yes — clone |
| `moderato` | **untracked** in `loupe-web` | Mostly — **see §12** |
| Production runtime secrets | GCP Secret Manager (`loupe-app-56235`) | Yes — see §5 |
| Deploy pipeline + CI | GitHub Actions (already configured) | Yes — nothing to do |
| iOS signing certificates | Apple's servers | Yes — Xcode re-mints them |

### What genuinely may be gone

- **Local `.env` files.** They were gitignored. Production values are in
  Secret Manager (§5); *local dev* values are re-derivable from
  `.env.example` plus a handful of third-party keys only Jeffrey can fetch.
- **`loupe-pipeline/`** — a directory the `loupe-web` repo gitignores but
  which is **not** one of the three GitHub repos. If it was local-only
  tooling, it is lost. Note: `loupe-frontend` has its own
  `scripts/pipeline.mjs` (`npm run pipeline`), which is probably what he
  actually used. **Do not spend time hunting for `loupe-pipeline/`** — ask
  Jeffrey whether he misses it before treating it as a problem.
- **Uncommitted work in progress** from the old machine. Nothing to do.

### Rules for you, the agent

1. **Never print a secret value into the chat.** Write secrets straight to
   `.env` files with a shell redirect. If you must confirm one, print only
   its length or first four characters.
2. **Never commit a `.env`.** They are gitignored; keep it that way.
3. **Stop and ask** at every point marked **ASK JEFFREY** — those need a
   human (Apple ID password, 2FA codes, vendor dashboard logins).
4. Work through phases in order. A later phase assumes the earlier GATE passed.

---

## 1. The target directory layout

This is the single most important fact in this document, and it is
counter-intuitive: **the `loupe-web` repository is the workspace root, and the
other two repos get cloned inside it.**

Proof: `loupe-web/.gitignore` contains `loupe-backend/`, `loupe-frontend/`,
and `loupe-pipeline/` — it expects them as children. And
`loupe-frontend/package.json` has sync scripts like:

```
sync:theme    → cp -R ../packages/theme/src vendor/loupe-theme/src
sync:moderato → cp -R ../moderato/src vendor/moderato/src
```

`../packages` and `../moderato` only resolve if `loupe-frontend` sits beside
them — i.e. inside the `loupe-web` checkout.

Final layout (using `~/Loupe` as the clone target; any name works):

```
~/Loupe/                     ← clone of the `loupe-web` REPO (workspace root)
├── package.json             ← workspaces: ["packages/*", "moderato", "loupe-web"]
├── loupe-web/               ← the actual web app (Vite + React)
├── packages/                ← shared: auth chart core grade marketing theme tokens
│   ├── auth/  chart/  core/  grade/  marketing/  theme/  tokens/
├── moderato/                ← NOT in the clone — gitignored. Rebuild it: §12
├── loupe-frontend/          ← clone of loupe-frontend repo (gitignored by parent)
└── loupe-backend/           ← clone of loupe-backend repo (gitignored by parent)
```

Getting this wrong does not break day-to-day work immediately — it breaks the
`npm run sync:*` scripts, silently, the first time he edits a shared package.
Get it right now.

---

## 2. Prerequisites

Run these in order. Several open GUI prompts; the human must be present.

### 2.1 Xcode (start this FIRST — it is a multi-GB download)

**ASK JEFFREY** to install **Xcode** from the Mac App Store and leave it
downloading while you continue. Then:

```bash
sudo xcodebuild -license accept
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
```

> **The moment Xcode finishes installing, it breaks `git` — and `brew`, and
> `/usr/bin/python3`.** The App Store points `xcode-select` at `Xcode.app`,
> whose license is unaccepted, and every tool routed through the developer
> directory then refuses to run. So **accept the license as soon as Xcode
> lands**, before it blocks you mid-task.
>
> To keep working while waiting on the human, route around it with the
> Command Line Tools, which have no license gate:
> `export DEVELOPER_DIR=/Library/Developer/CommandLineTools`
>
> Do not read `xcodebuild -version` as proof the license is accepted — that
> one command is exempt from the check. Test with `git --version` instead.

### 2.2 Homebrew + CLI tooling

```bash
# Homebrew (skip if `brew --version` already works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Apple Silicon only: put brew on PATH for this and future shells
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

brew install git gh watchman cocoapods python@3.12
brew install --cask docker          # Docker Desktop — backend postgres/redis
brew install --cask google-cloud-sdk
```

### 2.3 Node 20 (via nvm)

`loupe-frontend/package.json` requires `node >=20.10.0`; `.nvmrc` pins `20`.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.zshrc 2>/dev/null || source ~/.nvm/nvm.sh
nvm install 20
nvm alias default 20
```

### 2.4 GATE — prerequisites

```bash
node --version        # v20.x  (must be >= 20.10.0)
npm --version
python3.12 --version  # Python 3.12.x
git --version
pod --version         # CocoaPods
docker --version
gcloud --version
xcodebuild -version   # only after Xcode finishes installing
```

Everything must print a version. Do not continue past a missing tool.

---

## 3. Authenticate the accounts

### 3.1 GitHub

```bash
gh auth login        # HTTPS + browser is fine
git config --global user.name  "Jeffrey"
git config --global user.email "ninjeff06@gmail.com"
```

### 3.2 Google Cloud (needed to recover secrets in §5)

```bash
gcloud auth login
gcloud config set project loupe-app-56235
gcloud config set run/region us-central1
gcloud auth application-default login
```

**ASK JEFFREY** to complete the browser sign-in with the Google account that
owns the `loupe-app-56235` project.

### 3.3 Apple / Xcode signing

**ASK JEFFREY** to open **Xcode → Settings → Accounts → +** and sign in with
his Apple Developer Apple ID (2FA required). Then in the same pane:
**Manage Certificates → + → Apple Distribution**.

Team ID for this project: **`DCU7GHRVUQ`**. Signing is automatic — the repo's
`plugins/withIphoneDistributionSigning.js` switches Release to automatic
signing whenever `EAS_BUILD` is unset, so Xcode mints the App Store profile
itself. Nothing needs to be restored from the old Mac.

### 3.4 Expo / EAS (optional — only for over-the-air updates)

```bash
npm i -g eas-cli
eas login
```

Needed only for `eas update` (pushing JS-only changes to installed builds).
Local Xcode archives do not require it.

---

## 4. Clone and install

### 4.1 Clone, in this order

```bash
git clone https://github.com/wiggapony0925/loupe-web.git ~/Loupe
cd ~/Loupe
git clone https://github.com/wiggapony0925/loupe-frontend.git
git clone https://github.com/wiggapony0925/loupe-backend.git
```

Verify the layout matches §1:

```bash
ls ~/Loupe          # expect: loupe-web packages moderato loupe-frontend loupe-backend + config files
ls ~/Loupe/packages # expect: auth chart core grade marketing theme tokens
```

### 4.2 Workspace + web app

```bash
cd ~/Loupe
npm install          # npm workspaces installs packages/*, moderato, and loupe-web
```

> **STOP if `moderato/` is missing after the clone — it will be.** The root
> `package.json` lists `moderato` as a workspace *and* the web app imports
> `moderato/react` and `moderato/web`, but the directory was untracked from
> the repo (commit `8476ddc`) and never pushed anywhere else. The web app
> cannot install or build until you rebuild it. **Go do §12 now**, then come
> back and re-run `npm install`.

### 4.3 Frontend (React Native / Expo)

```bash
cd ~/Loupe/loupe-frontend
npm install          # .npmrc sets legacy-peer-deps=true — do NOT add --force
```

If you hit peer-dependency errors, the repo's own escape hatch is
`npm run fix-deps` (`expo install --fix -- --legacy-peer-deps`). Do not
hand-edit versions in `package.json`.

### 4.4 Backend (FastAPI / Python 3.12)

```bash
cd ~/Loupe/loupe-backend
make install         # creates .venv (python3.12) + requirements.txt + requirements-dev.txt
```

> Note: a stray `.venv-ci/` may appear in listings — that was a CI-only
> virtualenv used in a cloud session. The canonical local venv is `.venv`,
> which is what the `Makefile` and `dev.sh` use.

### 4.5 GATE — installs

```bash
cd ~/Loupe/loupe-frontend && npx tsc --noEmit && echo "FRONTEND TYPES OK"
cd ~/Loupe/loupe-backend  && .venv/bin/mypy app | tail -1
```

Expect no TypeScript errors, and mypy reporting success across ~417 source
files. Do not continue if either fails.

---

## 5. Environment files and secrets

### 5.1 Frontend — trivial, no real secrets

```bash
cd ~/Loupe/loupe-frontend
cp .env.example .env
```

All frontend vars are `EXPO_PUBLIC_*` (they get inlined into the client
bundle, so none are secret). Defaults point at `http://localhost:8000`, which
is correct for local development.

Two notes:
- The Google iOS client ID for **production** builds is written automatically
  by `scripts/prepare-xcode-archive.sh` into `.env.production` at archive
  time. You do **not** need to create `.env.production` by hand — and it is
  gitignored on purpose.
- `EXPO_PUBLIC_ENABLE_MOCK_BRIDGE=true` is the dev default; leave it.

### 5.2 Backend — recover from Secret Manager

```bash
cd ~/Loupe/loupe-backend
cp .env.example .env
```

**Good news on JWT keys:** `.env.example` says *"Leave these empty in dev to
auto-generate an ephemeral RSA key."* So leave `JWT_PRIVATE_KEY_PEM` and
`JWT_PUBLIC_KEY_PEM` **blank** for local work. No key ceremony required.

`DATABASE_URL` and `REDIS_URL` in `.env` should stay pointed at the **local
Docker** services (the `.env.example` defaults) — `dev.sh` starts postgres 16
and redis 7 in containers. Do **not** point local dev at production.

For the third-party API keys, first see what actually exists in Secret
Manager:

```bash
gcloud secrets list --project loupe-app-56235
```

Then read any one back (this prints a secret — redirect it, never echo it):

```bash
gcloud secrets versions access latest --secret=<NAME> --project loupe-app-56235
```

`.env.example` carries **65 keys** — read the file rather than trusting any
list here. They group roughly as:

- **Card catalog / pricing:** `POKEMON_TCG_API_KEY`, `TCGPLAYER_CLIENT_ID` /
  `_SECRET`, `EBAY_APP_ID` / `EBAY_CERT_ID` / `EBAY_OAUTH_TOKEN`,
  `PRICECHARTING_API_KEY`, `SCI_API_KEY`, `PSA_API_TOKEN`,
  `GOCOLLECT_API_KEY`, `APIFY_API_TOKEN` / `APIFY_FB_MARKETPLACE_ACTOR`
- **Billing:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY`
- **Email:** `RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL`, `ADMIN_EMAILS`
- **Observability:** `SENTRY_DSN` and its sample-rate pair
- **Storage:** `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`

**`OPENAI_API_KEY` is NOT in `.env.example`** even though the code reads it
(`get_settings().openai_api_key`) — it is what switches content moderation
on. Absent, screening is deliberately OFF rather than failing, which is the
correct dev default. Add the key by hand only when working on moderation.

**Important:** most of these are optional for local development — the code
degrades gracefully when a key is absent (moderation, for example,
deliberately treats "no key" as "screening switched off" rather than as a
failure). **Get the app running with keys blank first**, then fill in only
what a feature Jeffrey is actually working on requires. Do not block setup on
hunting down an eBay token.

Anything not in Secret Manager must be re-issued from the vendor's dashboard
— **ASK JEFFREY**, do not attempt this yourself.

### 5.3 Web

Check whether the web app needs env vars:

```bash
ls -a ~/Loupe/loupe-web/ | grep -i env
```

If a `.env.example` exists there, copy it to `.env` the same way. The web app
talks to the API through a `/v1` proxy, so local defaults generally work.

---

## 6. Run everything locally

### 6.1 Backend

Start Docker Desktop first (the human may need to approve its privileged
helper on first launch), then:

```bash
cd ~/Loupe/loupe-backend
./dev.sh
```

`dev.sh` is a one-command bootstrap: it ensures Docker is running, starts
postgres + redis via compose, waits for postgres to accept connections, runs
`alembic` migrations, and starts the FastAPI dev server. `./dev.sh --down`
tears the services down while keeping the data volumes.

Background worker (separate terminal, only if needed):

```bash
make worker
```

### 6.2 Frontend

```bash
cd ~/Loupe/loupe-frontend
npm run ios          # boots the Simulator; `npm start` for the dev menu
```

`prestart` kills stale Metro ports automatically. If Metro serves stale
files, `npm run start:clean`.

### 6.3 Web

```bash
cd ~/Loupe/loupe-web
npm run dev          # Vite
```

### 6.4 GATE — the full test suites

Run all three. These numbers were verified green on the current `main`:

```bash
cd ~/Loupe/loupe-frontend && npm test          # expect: 476 passed, 44 suites
cd ~/Loupe/loupe-backend  && .venv/bin/pytest -q   # expect: 1369 passed (~6 min)
cd ~/Loupe/loupe-web      && npm test          # vitest — record the count you get
```

Also verify the linters, since CI enforces them:

```bash
cd ~/Loupe/loupe-frontend && npm run lint
cd ~/Loupe/loupe-backend  && .venv/bin/ruff check app tests && .venv/bin/ruff format --check app tests
```

If the frontend count differs from 476, that is fine **if** it is higher and
everything passes — work has continued. Failures are not fine; stop and
report them.

---

## 7. Shipping to TestFlight

The repo supports two paths; both are documented under "Shipping to
TestFlight" in `loupe-frontend/README.md`.

**Xcode GUI path (the one Jeffrey uses):**

```bash
cd ~/Loupe/loupe-frontend
npm run archive:xcode
```

That script does the four things Xcode will not do for you: generates the
set-logo registry, writes `.env.production` (Xcode's bundle phase cannot read
`eas.json`, and `EXPO_PUBLIC_*` values are inlined at bundle time), bumps the
iOS build number, and runs `expo prebuild` + `pod install`. It then opens
`ios/Loupe.xcworkspace` and prints the remaining steps:

1. Scheme **Loupe**
2. Device **Any iOS Device (arm64)** — Archive is greyed out on a Simulator
3. **Product ▸ Archive**
4. Organizer ▸ **Distribute App ▸ TestFlight & App Store ▸ Upload**

Useful flags: `-- --clean` (wipe and regenerate `ios/`), `-- --no-bump` (retry
the same build number), `-- --no-open`.

**Headless path** (hands you an `.ipa` for Transporter): `npm run build:ios`.

**Over-the-air**, for JavaScript-only changes — no Xcode, no review:

```bash
eas update --channel production
```

---

## 8. Known gotchas (learned the hard way — do not rediscover these)

- **`git pull` aborting on `package.json`.** If a pull refuses because of
  local changes to `package.json`, that is usually a build-number bump from
  `archive:xcode`. `git stash` → pull → `git stash pop`; on conflict, keep
  **both** sides' script lines.
- **A stale `build/Loupe.xcarchive`.** Opening an old archive in the
  Organizer ships old code. Always archive fresh after `npm run
  archive:xcode`; `npm run clean:ios` clears `ios/build`, `build`, and
  DerivedData.
- **CocoaPods and locale.** `pod install` can crash on an ASCII-8BIT locale.
  `prepare-xcode-archive.sh` already exports `LANG`/`LC_ALL` as UTF-8; if you
  run `pod install` by hand, do the same.
- **Disk space.** The archive script refuses to run under 15 GB free, because
  running out mid-archive corrupts DerivedData in a way that fails the *next*
  build confusingly.
- **Never add `--force` to npm install.** `.npmrc` already sets
  `legacy-peer-deps=true`; forcing produces a subtly broken tree.
- **Backend deploys are gated on CI.** `deploy.yml` runs only when the `CI`
  workflow succeeds on `main`. A red CI silently means *production never
  updated* — this exact failure mode once left prod running pre-social-links
  code for a day. After any push to `main`, confirm CI is green.
- **Ruff is part of CI.** `ruff check` **and** `ruff format --check` both
  gate the deploy. Run them before pushing backend changes.
- **Branch convention.** Feature work goes on a `claude/<slug>` branch, then
  fast-forwards into `main`. Both get pushed.

---

## 9. Reference card

| Fact | Value |
|---|---|
| GitHub owner | `wiggapony0925` |
| Repos | `loupe-frontend`, `loupe-backend`, `loupe-web` |
| Workspace root | the `loupe-web` repo (other two clone inside it) |
| Node | 20 (`>=20.10.0`), nvm, `.nvmrc` = `20` |
| Python | 3.12 |
| Local services | postgres 16, redis 7 (Docker, via `dev.sh`) |
| Apple Team ID | `DCU7GHRVUQ` |
| GCP project / region | `loupe-app-56235` / `us-central1` |
| Cloud Run services | `loupe-api`, `loupe-worker` |
| Cloud Run jobs | `loupe-migrate`, `loupe-ingest` |
| Production API | `https://loupe-api-wrrcqaayra-uc.a.run.app` |
| Test baselines | frontend 476 jest · backend 1369 pytest · web vitest |

---

## 10. Final checklist

Report each line to Jeffrey as done or blocked:

- [ ] Xcode installed, license accepted, Apple ID signed in, Apple
      Distribution certificate present
- [ ] Homebrew, git, gh, watchman, cocoapods, python@3.12, Docker Desktop,
      gcloud installed
- [ ] Node 20 active and set as nvm default
- [ ] `gh auth login` and `gcloud auth login` complete
- [ ] `~/Loupe` layout matches §1 exactly (frontend and backend nested inside)
- [ ] `npm install` clean in workspace root and in `loupe-frontend`
- [ ] `make install` clean in `loupe-backend`
- [ ] `.env` created in frontend and backend (secrets left blank where
      optional; recovered from Secret Manager where needed)
- [ ] `./dev.sh` brings the API up and migrations run
- [ ] Simulator boots the app via `npm run ios`
- [ ] Web dev server serves via `npm run dev`
- [ ] All three test suites pass; both linters pass
- [ ] `npm run archive:xcode` completes and opens the workspace
- [ ] Anything still blocked is listed explicitly for Jeffrey, with the exact
      error text

---

## 12. Rebuilding `moderato` (the one real gap)

### What happened

`moderato` was a **nested git repo** inside the workspace with its own
history, intended to ship to npm. Commit `8476ddc` — *"chore: untrack
moderato/ — it's a nested repo (own git history, ships to npm)"* — removed it
from `loupe-web`'s index. Its own repo lived only on the lost laptop, and it
was **never published** (`registry.npmjs.org/moderato` → `{"error":"Not
found"}`). So a fresh clone gives you no `moderato/` directory at all.

This blocks the web app specifically: root `package.json` has `"moderato"` in
`workspaces` and `"moderato": "*"` in dependencies, and these import from it:

```
loupe-web/src/features/social/Feed/Composer.tsx          → moderato/react, moderato/web
loupe-web/src/features/social/Feed/EditPostModal.tsx     → moderato/react
loupe-web/src/features/social/Feed/CommentsModal.tsx     → moderato/react
loupe-web/src/features/social/EditProfile/EditProfileModal.tsx → moderato/react, moderato/web
```

The **native app is unaffected** — `loupe-frontend` vendors its own copy at
`vendor/moderato/`, fully tracked, and imports through that.

### Do NOT recover from the parent commit alone

`8476ddc~1` only ever tracked **10 files**, and its `src/` had just four:
`policy.ts`, `types.ts`, `media/image.ts`, `media/video.ts`. That is a strict
*subset* — it cannot satisfy `moderato/react`. The richest surviving copy of
the source is **`loupe-frontend/vendor/moderato/`** (19 tracked files).

Neither source is complete on its own. **Take the union:**

| Piece | Recover from |
|---|---|
| `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `LICENSE`, `.gitignore` | `git show 8476ddc~1:moderato/<file>` |
| `src/engine.ts`, `src/index.ts`, `src/normalize.ts`, `src/refusal.ts`, `src/policy.ts`, `src/types.ts`, `src/media/*`, `src/providers/*`, `src/react/*`, `src/vocab/en.ts` | `loupe-frontend/vendor/moderato/src/` |
| `src/web/index.tsx` | **Nowhere — must be rewritten. See below.** |

Use the **historical** `package.json`, not the vendored one: the vendored copy
points its exports at `./dist/*` (published-package shape), while the
historical one points at source — `"./web": "./src/web/index.tsx"` — which is
what a local workspace needs.

```bash
cd ~/Loupe
mkdir -p moderato/src
for f in package.json tsconfig.json tsup.config.ts vitest.config.ts LICENSE .gitignore; do
  git show 8476ddc~1:moderato/$f > moderato/$f
done
cp -R loupe-frontend/vendor/moderato/src/. moderato/src/
ls moderato/src   # engine index normalize policy refusal types media providers react vocab
```

### The one file that must be written from scratch

`moderato/src/web/index.tsx`, exporting **`ModeratedUpload`** — a render-prop
file-picker wrapper. `sync:moderato` deliberately deletes `src/web` from the
native vendored copy (`rm -rf vendor/moderato/src/web`), which is why it
survives nowhere.

Its API, read off the real call sites:

```tsx
<ModeratedUpload
  accept="image/jpeg,image/png,image/webp"
  multiple
  remaining={MAX_IMAGES - images.length}
  onAccept={(files: File[]) => { /* caller appends */ }}
>
  {({ open }) => <Button onClick={open}>Add photos</Button>}
</ModeratedUpload>
```

Derive the complete prop set from **both** importers (`Composer.tsx` and
`EditProfileModal.tsx`) before writing it — the profile one is the
single-file avatar case and may pass different props. It is a hidden
`<input type="file">` plus a render prop exposing `open()`, clamped to
`remaining`, handing `File[]` to `onAccept`. Screening stays
server-authoritative, exactly as `useModeratedSubmit` documents — this
component must not implement moderation policy itself.

If a faithful reproduction matters more than a clean rewrite, the compiled
component still exists in the **deployed** web bundle and in the last web
image in Artifact Registry. Reverse-engineering minified JS is slower than
rewriting ~60 lines; try the rewrite first.

### Then make this unlosable

Once it builds, **commit `moderato/` into a repo** — either track it inside
`loupe-web` again (delete the nested `.git` first) or push it as its own
GitHub repo and depend on it properly. It was lost precisely because it was
a nested repo that was never pushed. **ASK JEFFREY** which he prefers; do not
choose for him.

Verify:

```bash
cd ~/Loupe && npm install
cd ~/Loupe/loupe-web && npm run typecheck && npm test
```

---

## 13. What the root `.gitignore` hides (the "what did I lose" inventory)

The workspace root's `.gitignore` is the authoritative list of what lives
only on the machine. After a loss, this is the whole answer:

| Excluded by `.gitignore` | Status after a rebuild |
|---|---|
| `node_modules/`, `**/dist/`, `**/build/`, `*.tsbuildinfo` | Regenerated — nothing to do |
| `loupe-frontend/`, `loupe-backend/` | Separate GitHub repos — cloned in §4.1 |
| `moderato/` | Rebuild per §12 |
| `.env`, `.env.*` (`.env.example` kept) | Recover per §5 |
| `*.pem`, `*.key` | Dev auto-generates; prod keys in Secret Manager |
| `tools/` | **Local-only. Gone.** |
| `PLAN.md`, `DEVELOPER_PORTAL.md` | **Local-only. Gone.** |
| `.claude/` (at the workspace root) | **Local-only. Gone** — see below |
| `loupe-pipeline/` | **Local-only. Gone.** |
| `.vscode/`, `.idea/`, `*.log`, `.DS_Store` | Noise |

**Nothing in any tracked file references `tools/`, `PLAN.md`,
`DEVELOPER_PORTAL.md`, or `loupe-pipeline/`** — verified by grep across all
three repos. Nothing that builds, tests, or deploys depends on them, so do
not try to reconstruct them speculatively. In particular,
`loupe-frontend/scripts/pipeline.mjs` is tracked and self-contained
(`npm run pipeline`, `:ship`, `:build`, `:cloud`), and is almost certainly
what `loupe-pipeline/` became. Ask before rebuilding any of them.

**`.claude/` is only gitignored at the workspace root** — it is *not*
ignored inside `loupe-frontend` or `loupe-backend`, so both now carry a
tracked `.claude/settings.json` with a permission allowlist for that repo's
routine commands (tests, typecheck, lint, read-only git). Those survive a
machine loss. Anything workspace-root-level has to be recreated by hand.

## 14. Backend pre-flight (already verified remotely)

Checked against the current `main`, so the backend should come up without
surprises once Homebrew lands:

- **`alembic heads` → a single head** (`0055_social_links`). Multiple heads
  would make `dev.sh`'s migration step fail; there is no such conflict.
- **The full suite passes on Python 3.12** — 1369 tests — as do `ruff
  check`, `ruff format --check`, and `mypy app` (417 source files).
- **Compiled dependencies to watch on Apple Silicon:** `lxml`, `Pillow`,
  `cryptography`, `numpy`, `onnxruntime`. All ship arm64 wheels for 3.12, so
  `make install` should not need a compiler. If one *does* try to build from
  source, that is the signal that Xcode Command Line Tools are missing or
  the license is still unaccepted (§2.1) — not that the pin is wrong. Do not
  "fix" it by loosening a version.

## 11. If something in this document is wrong

It was written from the repositories as they stood at the time, and repos
move. Trust the repo over this document: `loupe-frontend/README.md`
(stack, run, TestFlight, layout), `loupe-backend/README.md` and
`DEPLOY.md` (deployment, Secret Manager, Cloud SQL), `loupe-web/README.md`
(stack, layout, getting started), the `Makefile`, and `dev.sh`. Then tell
Jeffrey which part of this document drifted so it can be corrected.
