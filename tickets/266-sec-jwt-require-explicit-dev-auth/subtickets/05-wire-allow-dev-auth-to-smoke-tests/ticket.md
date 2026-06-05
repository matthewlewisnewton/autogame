# 05-wire-allow-dev-auth-to-smoke-tests

Add `ALLOW_DEV_AUTH=1` to all smoke test scripts that launch the game server so they start without `initAuth()` throwing.

## Acceptance Criteria

- Each of the 5 smoke test scripts that set `ALLOW_DEBUG_SCENARIOS: '1'` also sets `ALLOW_DEV_AUTH: '1'` in the server spawn environment:
  - `game/client/scripts/test-deck-loadout.mjs`
  - `game/client/scripts/test-card-evolution.mjs`
  - `game/client/scripts/test-quest-completion.mjs`
  - `game/client/scripts/test-telepipe-suspend-resume.mjs`
  - `game/client/scripts/test-world-stage-transition.mjs`
- Running any of these smoke scripts starts the server without a `Missing JWT_SECRET` error.

## Technical Specs

- **Files**: the 5 smoke scripts listed above
- In each script's `child_process.spawn` (or equivalent) env object, add `ALLOW_DEV_AUTH: '1'` alongside the existing `ALLOW_DEBUG_SCENARIOS: '1'`

## Verification: code
