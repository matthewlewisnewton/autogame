# Server: deferred card resolution at wind-up end

Complete the server wind-up loop: on each simulation tick, when a committed
player's `windUpMs` elapses, execute the stored `pendingCardUse` through the
existing card-effect branches and emit `CARD_USED` exactly as today's instant
path does. Clear commitment state after resolution. Mirror
`processPendingEchoes()` / enemy wind-up strike resolution timing.

## Acceptance Criteria

- `simulation.js` exports `processPendingCardWindups()` (or equivalent) called
  from the main tick loop alongside `processPendingEchoes()` (~line 3033).
- When `Date.now() - player.cardWindupStartTime >= player.cardWindupMs`, the
  server runs the deferred card effect (weapon cone, spell AoE, creature
  summon, enchantment, etc.) using the stored `pendingCardUse` payload and the
  player's position/rotation **at resolution time** (or the locked values
  captured at commit — pick one, document in code, and test consistently).
- After resolution: commitment fields and `pendingCardUse` are cleared;
  `CARD_USED` is broadcast with the same payload shape the instant path uses
  today; `STATE_UPDATE` reflects cleared commitment.
- If the player dies or is extracted during wind-up, pending resolution is
  cancelled (no `CARD_USED`, charges already spent at commit per 01).
- A `magma_greatsword` (or whichever exemplar has `windUpMs`) integration test
  shows: enemy HP unchanged during wind-up, damage applied only after
  `windUpMs`, and `CARD_USED` arrives after the delay.
- `iron_sword` and other zero-`windUpMs` cards remain instant with no added
  latency; existing `useCard` integration tests still pass.

## Technical Specs

- `game/server/cardEffects.js` — extract the body of `handleUseCard` into an
  internal `executeUseCard(socket, state, lobby, data, options)` (or similar)
  callable from both the instant path and the deferred resolver. The `windUpMs >
  0` entry path (from sub-ticket 01) only queues; this ticket wires the resolver
  to call `executeUseCard` when the timer elapses.
- `game/server/simulation.js` — implement `processPendingCardWindups()`:
  iterate committed players, resolve due entries, clear state. Register in the
  tick function next to `processPendingEchoes()`.
- `game/server/game-state.js` — if `pendingCardUse` needs documenting in state
  shape comments, add a note (optional).
- `game/server/test/card_windup_resolution.test.js` (new) — timed resolution
  tests using manual clock advancement or pre-set `cardWindupStartTime` in the
  past; socket integration test for the exemplar wind-up weapon; regression
  spot-check on `iron_sword` instant behavior.

## Verification: code
