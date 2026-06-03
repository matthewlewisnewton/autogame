# Extract useCard socket handler into a cardEffects module

The `socket.on('useCard')` closure in `game/server/index.js` (~lines 1798–2682)
is a single ~885-line handler with ~36 inline `cardDef.type === …` /
`cardDef.effect === …` branches dispatching every card behavior. Move that
dispatch logic into a new `game/server/cardEffects.js` module so adding a card
no longer means editing the middle of an 800-line closure. This is a
behavior-preserving refactor only.

## Acceptance Criteria

- A new file `game/server/cardEffects.js` exists and contains the card-use
  dispatch logic (the weapon / spell / creature / enchantment branches and the
  per-`effect` handling) previously inline in `socket.on('useCard')`.
- In `game/server/index.js`, the `socket.on('useCard', …)` registration is a
  thin wrapper that delegates to the new module; the ~36 inline effect/type
  branches no longer live inside the socket closure.
- Branch evaluation order is preserved exactly (it is load-bearing): the same
  guard checks (gamePhase, run status, card lookup, player liveness, hand
  validation, cooldown/overclock) and the same weapon→spell→creature→
  enchantment / per-effect resolution run in the same order as before.
- All socket-emitted events (`cardUsed`, `cardError`, `stateUpdate`, etc.) and
  their payload shapes are unchanged.
- Any symbols the test suite imports from `index.js` remain exported from
  `index.js` (re-export from the new module where needed) — do not break the
  public import surface used by `test/*.test.js`.
- `cd game && pnpm test` passes (including astral_guardian, overclock,
  card_sync, enchantment, creature_minions, minion_damage and the other
  per-effect suites); the game starts and loads cleanly.

## Technical Specs

- New file: `game/server/cardEffects.js`.
- Edit: `game/server/index.js` — replace the body of `socket.on('useCard')`
  with a delegating call into `cardEffects.js`; keep the registration itself
  in `index.js`.
- Follow the existing module-seam pattern used by `game/server/simulation.js`:
  resolve the circular dependency on `index.js` via setter injection
  (`setGameState(...)` / `setCallbacks(...)`) rather than `require('./index')`,
  and have `index.js` wire the module up after both are loaded.
- Helpers the handler relies on (`getCardDef`, `resolveAttackRotation`,
  `collectConeHits`, `collectProjectileHits`, `collectReturningProjectileHits`,
  `applyKnockback`, `validateUseCardHand`, `applySlotCooldown`,
  `exhaustHandSlot`, `drawCardIntoHand`, `canDrawIntoHand`,
  `ensurePassiveDrawScheduled`, `stateSnapshot`, summon/enchantment helpers,
  `io`, etc.) must be supplied to the module via injection or import — do not
  duplicate their logic.
- Do not change card definitions, effect semantics, payloads, or any file other
  than `index.js` and the new `cardEffects.js`.

## Verification: code
