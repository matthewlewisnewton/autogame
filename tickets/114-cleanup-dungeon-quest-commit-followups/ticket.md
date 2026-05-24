# Cleanup dungeon generation + quest layouts commit followups

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Smaller followups from `d212b52` ("Fix dungeon generation, add quest-specific layouts, and implement crystal collection"). The commit also quietly landed shop tab, gamepad input, knockback, shields, ancient_wyrm/astral_guardian behavior, deck-depletion failure, and 4 evolved card renames — none documented in the commit body. This ticket captures the minor/nit findings; the load-bearing knockback/collision bugs are tracked in 113.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/index.js:81` — `createGameState()` adds `_pendingMinionBreaths` with a leading-underscore convention, but the buffer is broadcast via `io.emit('cardUsed', ...)`. Comment that it is a per-tick queued buffer, not internal-only.
- `game/server/progression.js` `astral_guardian` — `attackIntervalMs: 25` (≈40 attacks/sec). No comment on intent; either lower the rate or document why this minion runs so hot.
- `game/server/index.js:2589` `resetGameState` — uses `Math.random()` for the layout seed while `applyLayoutForQuest` uses deterministic `questLayoutSeed(questId)`. Pick one source.
- `game/server/simulation.js:1387-1389` ancient_wyrm melee — `nearestEnemy.hp -= 5` skips magic-stone/heal hooks other minion paths use; no `cardUsed` event for the 5-damage tick. Either route through the shared damage helper or document the bypass.
- `game/server/simulation.js:1355` — `const lastBreathAt = minion.lastBreathAt ?? now` gates the first breath behind `breathIntervalMs` for any wyrm spawned without `lastBreathAt`. Currently safe because index.js sets `minion.lastBreathAt = now` on spawn, but the fallback to `now` is misleading; `?? 0` lets nullish-init wyrms breathe immediately and matches the typical "spawn ready" pattern.
- `game/server/progression.js` `refreshShopOffer` — `ensureShopOffer` is invoked on every `stateSnapshot()` tick; safe today but no test pins offer stability across a session. Add one.
- `game/server/progression.js` `recordCrystalCollected` — increments then clamps; `index.js:1908-1909` (`recordCrystalCollected(1)` + `checkRunTerminalState()`) is fine. Confirm a clamp regression cannot under-count crystals.
- `game/server/index.js` `_pendingMinionBreaths` — `returnPlayersToLobby` does not clear it. A tick that produces a breath event mid-return leaks into the next playing tick.
- `game/server/index.js` defensive init — `if (!_gameState._pendingMinionBreaths) _gameState._pendingMinionBreaths = []` is redundant with the `createGameState` init. Pick one.
- `game/client/renderer.js:201-202, 215` — silent WASD/camera sign flip; smoke test added (`harness/scripts/smoke-playtest.mjs`) but no inline rationale. Comment why the flip was needed.
- `game/client/test/__mocks__/three.js` and `game/client/test/setup.js` — both define `Group`, `LineSegments`, `BufferGeometry`. Risk of drift; consolidate.
- Commit message hygiene: future commits of this scope should be split (dungeon-gen / quest-layouts / crystal-collection / shop-tab / gamepad / knockback / shield / wyrm+guardian / deck-depletion-fail / card renames). Captured here as a process note; no code change required.

## Acceptance Criteria

- `_pendingMinionBreaths` is documented (one-line comment) and cleared on `returnPlayersToLobby`.
- `resetGameState` and `applyLayoutForQuest` agree on whether layout seeds are random or quest-derived; pick one and remove the other path.
- Ancient_wyrm melee either routes through the shared damage helper (so on-hit hooks fire and `cardUsed` is emitted) or carries a comment explaining the bypass.
- `minion.lastBreathAt` fallback uses `?? 0` (or the wyrm spawn explicitly sets `now - breathIntervalMs` so first breath is immediate), aligned with the documented intent.
- `astral_guardian` attack interval either lowered to something physically meaningful (≥ one tick worth of attacks) or commented in code with a stat-design rationale.
- Three.js test mocks are defined in exactly one place.

## Technical Specs

- Likely files: `game/server/index.js`, `game/server/simulation.js`, `game/server/progression.js`, `game/client/renderer.js`, `game/client/test/setup.js`, `game/client/test/__mocks__/three.js`.

## Verification: code
