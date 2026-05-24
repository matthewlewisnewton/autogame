# Cleanup multi-lobby smoke tests and docs

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

`7538082` added `docs/lobbies.md` and two manual smoke scripts (socket + Playwright two-browser) but left a few rough edges: the docs reference files that landed in a different commit, the Playwright dependency is missing browser-install docs and is not paired with `@playwright/test`, neither smoke script is wired into CI despite the doc claim, and there is dead/brittle code in both scripts.

## Difficulty: easy

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `docs/lobbies.md` "Files changed (summary)" — references files (`server/lobbies.js`, `client/main.js`, etc.) that are not in `7538082`; they belong to the earlier lobby commit `2fb2825`. Confusing for readers who land here.
- `docs/lobbies.md` — claims smoke tests are "CI-friendly" but no CI configuration was added.
- `game/scripts/test-lobby-dropin.mjs:91` — `enemiesBefore` is read but never used (dead code).
- `game/scripts/test-lobby-dropin.mjs:99` — `rejoined.state.players[p2.init.id || rejoined.id]`; `rejoined.id` is never set on the `lobbyJoined` payload (only `lobbyId`, `lobbyName`, `state`), so the fallback is unreachable.
- `game/client/scripts/test-lobby-browser.mjs:6` — `API = process.env.BASE_URL` shadows a generic env name; rename to `API_URL` / `SERVER_URL`.
- `game/client/scripts/test-lobby-browser.mjs:117` — finds the Drop In button by exact `textContent === 'Drop In'`; brittle to whitespace/icon changes (verified the literal string against `client/main.js:211`).
- Client `package.json` — `playwright` was added without `@playwright/test`; install does not auto-download browsers in all environments. Document `npx playwright install chromium` in `lobbies.md` or pin to `@playwright/test`.

## Acceptance Criteria

- `docs/lobbies.md` either drops the "Files changed" section or limits it to files actually touched by the commit that adds the doc.
- Either wire one of the smoke scripts into CI (`pnpm` script + workflow) or remove the "CI-friendly" wording from the doc.
- Smoke scripts compile cleanly: no unused locals, no unreachable fallbacks, env var names that read sensibly.
- Doc explains how to install browser binaries for the Playwright script, or switch to `@playwright/test` and capture the install in `postinstall` / `pnpm install` docs.
- Drop-In button locator uses a stable selector (data attribute or `getByRole`) rather than exact text matching.

## Technical Specs

- Likely files: `docs/lobbies.md`, `game/scripts/test-lobby-dropin.mjs`, `game/client/scripts/test-lobby-browser.mjs`, `game/client/package.json`, plus a CI workflow if wired in.

## Verification: code
