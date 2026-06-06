# In-memory run pause on telepipe (no checkpoint snapshot)

Replace checkpoint-based suspend with a simple hub pause: when all players extract through the telepipe, move the squad to the hub lobby while keeping the active run, layout, enemies, loot, telepipe, and player HP/MS in server memory. Redeploy resumes that same run (same `runId`, same `layoutSeed`) without `captureRunCheckpoint` / `restoreRunCheckpoint`.

## Acceptance Criteria

- After the last player enters the telepipe, `gamePhase` is `lobby`, players are at hub spawn, hands/deck are cleared for hub idle (current suspend behavior), but **`run`, `layout`, `enemies`, `loot`, `telepipe`, and `layoutSeed` remain in `_gameState`** (not wiped by `resetTransientRunState`).
- `run.status` becomes `'suspended'` (or equivalent) to gate redeploy, but **no `suspendedCheckpoint` blob is written**.
- `checkAllReady()` redeploy with a suspended in-memory run re-enters the dungeon **without** spawning a new layout or new `run.id`; server log must **not** contain `[run] checkpoint restored`.
- Player `hp` and `magicStones` are unchanged across telepipe-up → hub → redeploy.
- New server test: solo deploy → spend MS / take damage → telepipe extract → ready → redeploy asserts same `run.id`, same `layoutSeed`, preserved `magicStones` and `hp`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**
  - Refactor `suspendRunToLobby()`: stop calling `captureRunCheckpoint()` and `resetTransientRunState()`; do not null out enemies/layout/run.
  - Refactor `checkAllReady()`: when `run.status === 'suspended'`, resume in place (set phase `playing`, clear `extracted`, reposition players at saved dungeon positions or portal-adjacent spawn, re-deal hands) instead of `restoreRunCheckpoint()` or fresh `startDungeonRun()`.
  - Keep `maybeSuspendRun()` / `tryEnterTelepipe()` entry points; only change what happens when the run pauses.
- **`game/server/game-state.js`** — no new checkpoint field; `suspendedCheckpoint` may remain unused until sub-ticket 03 removes it.
- **`game/server/test/server.test.js`** — add telepipe-up → redeploy persistence test; adjust suspend tests that expect checkpoint capture.
- **`game/server/test/integration.test.js`** — update `two-player suspend then resume preserves magic stones…` to assert in-memory resume (no `suspendedCheckpoint`).

## Verification: code
