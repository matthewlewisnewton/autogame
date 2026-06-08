# Server and client: block key items during card wind-up

Close the remaining commitment gap: players can still activate equipped key
items (especially `dodge_roll`) while a `windUpMs` card is pending, escaping
the intended vulnerability window. Reject key-item use server-authoritatively
when `isPlayerCardCommitted(player)` is true, and gate the client `useKeyItem`
input path the same way movement and card slots are already locked.

## Acceptance Criteria

- `handleUseKeyItem` in `keyItemEffects.js` returns early when
  `isPlayerCardCommitted(player)` is true, emitting
  `KEY_ITEM_USED { ok: false, reason: 'card_commitment' }` (or equivalent
  stable reason string) **before** cooldown checks or any effect branch runs.
- Committed `useKeyItem` for `dodge_roll` does not move the player, set
  `invulnerableUntil`, or start `keyItemCooldownUntil`.
- Committed `useKeyItem` for at least one other key item (e.g. `guard_block` or
  `phase_step`) is likewise rejected with no effect side-effects.
- After `processPendingCardWindups()` clears commitment, the same key item can
  be used successfully again (no permanent lock).
- Client `onUseKeyItem` in `main.js` does not emit `USE_KEY_ITEM` while
  `isLocalPlayerCardCommitted()` is true (mirror the existing `useCard` guard).
- New server regression test in `card_windup_lock.test.js`: start a
  `magma_greatsword` wind-up, emit `useKeyItem` with `dodge_roll` while
  committed, assert rejection and unchanged position/cooldown; resolve wind-up,
  then assert dodge works.
- New client test in `main.test.js`: with mocked `cardUseState: 'windup'`,
  triggering the key-item binding does not emit `useKeyItem`; after commitment
  clears, emit is allowed again.
- Existing wind-up, key-item, and regression tests still pass.

## Technical Specs

- `game/server/keyItemEffects.js` — `require` `isPlayerCardCommitted` from
  `simulation.js`. After the dead/extracted guards (~line 68) and before
  cooldown/item validation, add:
  `if (isPlayerCardCommitted(player)) { emit KEY_ITEM_USED ok:false reason:'card_commitment'; return; }`
- `game/server/socketHandlers/keyItemHandlers.js` — no change expected; the
  guard lives in `handleUseKeyItem` so all socket paths inherit it.
- `game/client/main.js` — in the `initInput({ onUseKeyItem })` callback (~line
  1039), return early when `isLocalPlayerCardCommitted()` is true before any
  `socket.emit(USE_KEY_ITEM, ...)`.
- `game/server/test/card_windup_lock.test.js` — add `useKeyItem` /
  `dodge_roll` rejection case using the existing `magma-windup-ready` debug
  scenario helper; verify position and `keyItemCooldownUntil` unchanged while
  committed, then successful dodge after resolution.
- `game/client/test/main.test.js` — add test(s) that press the default key-item
  key (or call the input hook) while `cardUseState === 'windup'` and assert no
  `useKeyItem` socket emit; optional follow-up assert emit resumes when wind-up
  fields clear.

## Verification: code
