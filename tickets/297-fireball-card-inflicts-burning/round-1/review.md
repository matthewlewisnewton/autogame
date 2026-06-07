## Runtime health

PASS. The captured run loaded cleanly: `metrics.json` has `"ok": true`, no harness failure, and an empty `pageerrors` array. `console.log` contains only normal Vite connection, scene initialization, and ready-up messages; there are no page errors or fatal game-code errors. Server/client logs show the dev servers started, gameplay reached the dungeon, and teardown was clean aside from benign development warnings.

## Acceptance criteria

PASS. Fireball is defined as a reward-obtainable weapon card in the shared card definitions with charges, impact damage, projectile range, piercing projectile metadata, a sell value, and a position in the victory reward rotation. The client imports the same shared definition source, so deck/card UI and server validation stay aligned.

PASS. Casting flows through the authoritative `useCard` weapon branch in `game/server/cardEffects.js`: `effect: "fireball"` uses `collectProjectileHits`, applies impact damage, preserves projectile render data in the `cardUsed` payload, consumes charges/cooldowns through the existing weapon path, and emits state updates normally.

PASS. Burning-on-hit is implemented on the server by resolving each hit enemy and calling `applyBurning(enemy, burningDurationMs)`. This reuses the existing Burning status implementation from ticket 291, including mutual exclusion with Slow and ticking fire damage. State snapshots expose enemies directly, so `burningUntil` reaches clients for visual status rendering.

PASS. Client visuals are covered on both sides of the requirement: `game/client/cardRenderers.js` registers a Fireball-specific renderer that spawns a warm `effect: "fireball"` projectile, and `game/client/renderer.js` has a matching sphere projectile branch. Burning on enemies is rendered via the existing `burningUntil`-driven flame markers.

PASS. Server and client tests cover the new behavior: `game/server/test/fireball_card.test.js` verifies the definition, reward obtainability, cast payload, impact damage, and Burning status on struck enemies; `game/client/test/cardRenderers.test.js` verifies the Fireball projectile renderer; `game/client/test/cards.test.js` verifies Fireball is in weapon card sets. The coverage run reports `112 passed` test files and `1745 passed` tests.

## Design and requirements fit

PASS. The change fits the design document's card-combat model: Fireball is a multi-charge weapon projectile in the active deck/hand system, and it adds a status-based combat effect without changing the lobby, dungeon, loot, multiplayer, movement, or rendering foundations required by `game/docs/requirements.md`.

## Debug scenario review

PASS. The added `fireball-ready` scenario is only reachable through the debug-scenario URL/socket path guarded by `isDebugScenarioAllowed`; normal gameplay does not call it. It is a deterministic QA shortcut into a state that remains reachable normally by earning the reward card, putting it in a deck, deploying, and fighting enemies. The scenario still uses normal `useCard` server validation and combat resolution; it only seeds the hand and enemies for repeatable testing.

## Remaining gaps

None.

VERDICT: PASS
