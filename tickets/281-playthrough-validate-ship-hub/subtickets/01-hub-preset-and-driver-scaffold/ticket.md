# Hub validation preset and playthrough driver scaffold

Add a `hub` playthrough preset and extend the 277 playthrough driver so hub validation reuses the existing auth/boot stack but writes to `game/validation/hub/` instead of the Rooms combat path. This sub-ticket lands only the preset, CLI wiring, and an `auth` slice that proves register/login plus the 2D lobby-finder menu — no hub walk, booths, or telepipe flow yet.

## Acceptance Criteria

- `harness/validate/presets/hub.mjs` exports hub-specific constants: `hubZones: ['operations', 'commerce', 'salon']`, `telepipeScenario: 'telepipe-ready'`, `currencyScenario: 'hat-shop-currency'`, `hatsScenario: 'hats-unlocked'`, and booth anchor ids matching `generateHub()` (`character`, `hats`, `launch`, etc.).
- `harness/validate/playthrough.mjs` registers preset `hub`, accepts `--out game/validation/hub/` as the hub default when `--preset hub`, and adds step flags `auth`, `hub-walk`, `booth`, `telepipe-reset`, and `full` (stubs for later slices throw a clear error if invoked before implemented).
- `--steps auth` with `--preset hub` runs: isolated game boot (`ALLOW_DEV_AUTH=1`, `ALLOW_DEBUG_SCENARIOS=1`) → register/login → `#lobby-browser` visible.
- Lobby-finder assertion: `#lobby-browser` is visible, `#lobby` is hidden, `hasCanvas` is false or the 3D canvas is not the active full-screen view (hub 3D has not started), and `#lobby-browser` `getComputedStyle(...).position` is not `fixed` over an active playing canvas — the menu is the 2D DOM overlay described in `game/docs/lobbies.md`.
- Screenshot `game/validation/hub/09-lobby-finder.png` is written during the auth slice.
- `game/package.json` adds `"validate:hub": "node ../harness/validate/playthrough.mjs --preset hub --steps auth --out game/validation/hub"` (full pipeline wiring lands in sub-ticket 05).
- `cd game && pnpm test:quick` still passes.
- No changes under `game/server/` or `game/client/` unless a one-line harness-state field is strictly required (prefer DOM reads first).

## Technical Specs

- New: `harness/validate/presets/hub.mjs` — hub preset constants (no boss/combat fields).
- Edit: `harness/validate/playthrough.mjs` — import hub preset; add `runAuthStep` lobby-finder probe + `09-lobby-finder` screenshot when `preset === 'hub'`; stub later hub step functions behind the new `--steps` values.
- Edit: `game/package.json` — add `validate:hub` script pointing at the harness entry with `--preset hub`.
- Reuse unchanged: `harness/validate/lib/auth.mjs`, `gameProcess.mjs`, `harnessState.mjs`, `screenshot.mjs`, `consoleLog.mjs`.
- Reference: `harness/validate/presets/rooms.mjs` and sub-ticket 277 `02-playthrough-driver-skeleton` for CLI patterns.

## Verification: code
