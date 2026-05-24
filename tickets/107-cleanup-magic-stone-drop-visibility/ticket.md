# Cleanup magic stone drop visibility followups

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

`4b65204` made magic stone drops visible and pickable by any player. The change introduced a few cosmetic and architectural rough edges worth cleaning up: a double-playing pickup SFX on non-pickup MS gains, a visual drop-before-lift on the collect animation, parallel loot-id sets that mean the same thing, a loosened anti-cheat radius, and possible material leaks on cloned loot meshes.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/client/main.js:1087` — `updateMsBar` plays `playSound('loot')` on any MS gain > 0.5; this will also fire for non-pickup gains (e.g. `divine_grace`), duplicating the existing pickup `playSound('loot')` at roughly `main.js:679`.
- `game/client/renderer.js:154` — `pickedUpLootIds` is described as a "legacy alias for tests" that mirrors `lootPickupAttempts`. Two parallel sets for one concept; either drop the alias or derive `getPickedUpLootIds` from the map.
- `game/client/renderer.js:1869` — magic-stone collect animation sets `mesh.position.y = 0 + t*1.5` (`liftY = 0`), so the gem starts at ground level and rises to 1.5, while non-MS loot starts at 0.5. The gem visually "drops" before lifting; gem idle `baseY` is 0.6.
- `game/client/renderer.js:1842` — `cloneLootMaterial` is invoked per-mesh; `disposeAllLootMeshes` / `disposeMeshMap` must dispose the clones. Confirm `disposeMeshMap` handles cloned materials on group children, otherwise materials leak.
- `game/client/renderer.js:1893–1895` — per-frame `lootMeshes[item.id].position.x/z` reassignment for static loot is wasted work and will jitter if the server ever streams moving loot.
- `game/client/config.js:37` — comment says "keep slightly below server LOOT_PICKUP_RADIUS" with no rationale.
- `game/server/...` `LOOT_PICKUP_RADIUS` loosened 3 → 3.5 (~17%) with no compensating check on player velocity/teleport. Note in code (or unwind) the relaxation.
- `game/server/test/integration.test.js:3645` — assertion uses `toBeLessThan(10 + drop.value + 1)` to express equality; `toBe(10 + drop.value)` is clearer and stricter.

## Acceptance Criteria

- MS pickup SFX plays exactly once per pickup event; non-pickup MS gains (`divine_grace`, regen, etc.) do not trigger the loot sound.
- Magic stone collect animation starts at the gem's idle `baseY` (no visual "drop" before lift).
- `pickedUpLootIds` is either removed in favor of `lootPickupAttempts` or refactored so there is one source of truth.
- Cloned loot materials are disposed when their mesh is disposed; add a focused test or assertion if helpful.
- The widened `LOOT_PICKUP_RADIUS` is either justified with a comment naming the trade-off (round-trip latency vs anti-cheat) or paired with a velocity/teleport sanity check on the server.
- `integration.test.js:3645` asserts with `toBe`.

## Technical Specs

- Likely files: `game/client/main.js`, `game/client/renderer.js`, `game/client/config.js`, `game/server/test/integration.test.js`, plus whichever server module exports `LOOT_PICKUP_RADIUS`.

## Verification: code
