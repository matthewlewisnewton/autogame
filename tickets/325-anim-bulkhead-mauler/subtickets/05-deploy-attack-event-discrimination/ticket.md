# Bulkhead Mauler — deploy vs attack event discrimination

Fix the `CARD_USED` renderer guards so deploy and attack events route correctly when both carry `specialEffect: 'shockwave_sweep'`. The server stamps `cardDef.specialEffect` onto the deploy emit (`cardEffects.js` ~1393–1401), so keying on `specialEffect` blocks summon VFX and mis-fires the shockwave on deploy. Mirror the wyrm `breathPhase` pattern: discriminate on attack-only fields (`direction` / `hits`) that the deploy payload never includes.

## Acceptance Criteria

- `renderBulkheadMaulerSummon` no longer checks `data.specialEffect === 'shockwave_sweep'`; it early-returns only when `data.minionId` is absent **or** `data.direction` is present (attack events always include `direction` from `simulation.js` ~3716).
- On a real deploy payload shape — `{ minionId, specialEffect: 'shockwave_sweep', origin }` with **no** `direction` — the summon renderer calls `spawnBulkheadMaulerDeployEffect` and `spawnMinionSummonInEffect`.
- `renderBulkheadMaulerShockwaveSweep` early-returns unless `data.specialEffect === 'shockwave_sweep'`, `data.origin` is present, **and** `data.direction` is present (or `data.hits` is a non-empty array).
- On the real deploy payload (no `direction`, no `hits`), the shockwave renderer does **not** call `spawnBulkheadMaulerShockwaveEffect`.
- On the real attack payload (`direction`, `hits`, `attackRange`, `attackConeAngle`, `specialEffect`, and `minionId` per `simulation.js` ~3711–3721), the shockwave renderer **does** call `spawnBulkheadMaulerShockwaveEffect` with server-reported range/cone.
- No changes to `CARD_RENDERERS` registration, VFX primitives, `main.js` wiring, `enemySync.js`, or server code.
- `cd game && pnpm test:quick` passes (existing tests may still use idealized payloads; sub-ticket 06 adds real-payload coverage).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - `renderBulkheadMaulerSummon` (~1360): replace guard `if (!data.minionId || data.specialEffect === 'shockwave_sweep') return;` with `if (!data.minionId || data.direction) return;` (or equivalent that treats any truthy `direction` as attack-only).
  - `renderBulkheadMaulerShockwaveSweep` (~2437): extend guard from `if (data.specialEffect !== 'shockwave_sweep' || !data.origin) return;` to also require `data.direction` (preferred) or a non-empty `data.hits` array — e.g. `if (data.specialEffect !== 'shockwave_sweep' || !data.origin || !data.direction) return;`.
  - Reference pattern: `renderWyrmSummon` (~1931, guards on `data.breathPhase`) and `renderWyrmAttack` (~1979, requires `breathPhase` for attack path).
- **Server reference** (read-only): deploy emit at `game/server/cardEffects.js` ~1393–1401; attack queue at `game/server/simulation.js` ~3711–3721.
- Do **not** modify tests in this sub-ticket (owned by sub-ticket 06).

## Verification: code
