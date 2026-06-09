# 07 — Restore soul_drain wind-up commitment

Round-1 review reported `card_windup_resolution.test.js` failing because `soul_drain` no longer enters `cardUseState: "windup"` after `useCard`. Restore the deferred wind-up path so Soul Drain commits charges/MS at cast, locks origin, emits a state update, and applies radial damage only after `windUpMs` (700ms) resolves via `processPendingCardWindups` / `runGameLoopTick`.

## Acceptance Criteria

- `cd game && pnpm exec vitest run server/test/card_windup_resolution.test.js -t "soul_drain applies damage"` exits `0`.
- After `useCard` for `soul_drain`, the player has `cardUseState === 'windup'`, `pendingCardUse.cardId === 'soul_drain'`, and `isPlayerCardCommitted(player) === true`; target HP is unchanged until wind-up elapses.
- After wind-up elapses, `cardUsed` fires with hits, commitment clears, and damage matches `getCardDef('soul_drain').damage`.
- `cd game && pnpm test:quick` still passes (no regressions in other wind-up tests such as `magma_greatsword` / `excalibur_photon`).

## Technical Specs

- **Edit:** `game/server/cardEffects.js` — in the spell branch (`cardDef.type === 'spell'`), ensure cards with `windUpMs > 0` (including `soul_drain`, which has no dedicated `effect` and falls through to radial AoE) call `tryBeginCardWindup` **before** instant damage/`CARD_USED`; pay `magicStoneCost` inside wind-up commit; do not consume the slot or apply `collectRadialHits` until `fromWindupResolution`.
- **Edit (if guard blocks commit):** `game/server/cardEffects.js` `handleUseCard` / `executeUseCard` — confirm playing-phase `useCard` reaches the spell wind-up path when the test harness sets `gamePhase: 'playing'` (add `state.run = { status: 'playing' }` in scenario setup only if production deploy always has `run` and the handler guard is correct).
- **Edit (if missing):** initialize `player.pendingSummons` before spell `pendingSummons.has(...)` checks so wind-up spells cannot throw or short-circuit.
- **Reuse:** `tryBeginCardWindup`, `processPendingCardWindups`, `resolvePendingCardUse`, `clearPlayerCardCommitment` in `simulation.js`; stats from `game/shared/cardStats.json` (`soul_drain.windUpMs: 700`).
- **Do not change:** `game/server/test/card_windup_resolution.test.js` unless a test expectation is objectively stale vs design.
- **Scope:** server card resolution only; no client or harness edits.

## Verification: code
