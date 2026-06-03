# Extract useKeyItem socket handler into a keyItemEffects module

The `socket.on('useKeyItem')` closure in `game/server/index.js`
(~lines 2913–3423) is a ~510-line handler with a long `keyItemId === …` chain
dispatching every key-item behavior (dodge_roll, summon_recall,
field_medic_kit, guard_block, flare_beacon, loot_magnet, overclock, phase_step,
barrier_dome, purge_charm, echo_strike, rally_cry, smoke_bomb, ground_anchor).
Move that dispatch into a new `game/server/keyItemEffects.js` module. This is a
behavior-preserving refactor only.

## Acceptance Criteria

- A new file `game/server/keyItemEffects.js` exists and contains the per-
  key-item dispatch logic previously inline in `socket.on('useKeyItem')`.
- In `game/server/index.js`, the `socket.on('useKeyItem', …)` registration is a
  thin wrapper that delegates to the new module; the per-`keyItemId` branches no
  longer live inside the socket closure.
- All guard checks and their order are preserved exactly: gamePhase, player
  liveness (`dead`/`extracted`), missing/unknown `keyItemId`, cooldown, and the
  implemented-vs-`not_implemented` allowlist.
- All socket-emitted events (`keyItemUsed`, `cardUsed`, `stateUpdate`, etc.) and
  their payload shapes (`{ ok, reason, remainingMs, … }`) are unchanged.
- Any symbols the test suite imports from `index.js` remain exported from
  `index.js`; the key-item socket contract used by `test/key-items.test.js`,
  `test/field_medic_kit.test.js`, `test/guard_block.test.js`,
  `test/loot_magnet.test.js`, `test/overclock.test.js`, `test/phase_step.test.js`,
  `test/barrier_dome.test.js`, `test/purge_charm.test.js`,
  `test/smoke_bomb.test.js`, `test/ground_anchor.test.js`,
  `test/dodge_roll.test.js` is unchanged.
- `cd game && pnpm test` passes; the game starts and loads cleanly.

## Technical Specs

- New file: `game/server/keyItemEffects.js`.
- Edit: `game/server/index.js` — replace the body of `socket.on('useKeyItem')`
  with a delegating call into `keyItemEffects.js`; keep the registration in
  `index.js`.
- Follow the same module-seam / setter-injection pattern as
  `game/server/simulation.js` (no `require('./index')` cycle).
- Helpers the handler relies on (`getKeyItemDef`, magic-stone / cooldown
  helpers, summon-recall logic, `stateSnapshot`, `io`, etc.) must be supplied
  via injection or import — do not duplicate their logic.
- Do not change key-item definitions, effect semantics, payloads, or any file
  other than `index.js` and the new `keyItemEffects.js`.

## Verification: code
