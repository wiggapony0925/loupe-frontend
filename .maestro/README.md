# E2E tests (Maestro)

End-to-end UI flows for the Loupe app, driven by [Maestro](https://maestro.dev) —
YAML flows that run against a real iOS Simulator / Android Emulator (no native
build wiring required, unlike Detox).

## Install

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

## Run

```bash
# 1. Build + install a dev client on a booted simulator/emulator:
npx expo run:ios        # or: npx expo run:android

# 2. Run the flows:
maestro test .maestro                       # all
maestro test .maestro --include-tags=smoke  # just the smoke flow
maestro test .maestro/flows/sign-in.yaml    # one flow
```

`maestro studio` opens an interactive inspector to discover element selectors on
the running app — the fastest way to fill in the `id:` / `text:` placeholders.

## Flows

| File | Tag | What it checks |
| --- | --- | --- |
| `flows/smoke.yaml` | `smoke` | App launches + renders without crashing. No UI-text assumptions, so it never goes stale. **Ready to run.** |
| `flows/sign-in.yaml` | `auth` | Email/password sign-in → lands authenticated. **Template** — add the `testID`s noted inline. |
| `flows/scan.yaml` | `scan` | Opens the card scanner. **Template** — add the noted `testID`s. |

## Make flows robust

Prefer **stable `testID`s** over visible text. Add them to the key elements,
e.g. `<TextInput testID="auth-email" … />`, then reference `id: auth-email` in
the flow. The smoke flow already avoids this by only asserting the app boots.

## CI

Run on PRs with [Maestro Cloud](https://maestro.dev) (no local devices needed):

```yaml
# .github/workflows/e2e.yml (add to the existing frontend-ci or a new workflow)
- uses: mobile-dev-inc/action-maestro-cloud@v1
  with:
    api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
    app-file: build/app.app      # or .apk from `eas build`
    include-tags: smoke
```

Start with the `smoke` tag in CI (fast, zero-maintenance), then add `auth` /
`scan` once their selectors are filled in.
