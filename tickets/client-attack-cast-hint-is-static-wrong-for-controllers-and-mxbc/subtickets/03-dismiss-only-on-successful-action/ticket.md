# Dismiss the attack/cast hint only after a successful attack/cast, not on rejected attempts

The attack/cast hint's action-based dismissal currently records progress on every input attempt, even when `useCard()` rejects it client-side (empty slot, cooldown, active minion, hand full, insufficient magic stones, or no usable basic-attack slot). This can permanently mark a profile "hint seen" after attempts that never produced a real action. Gate dismissal progress on `useCard()` actually accepting and emitting the action.

## Acceptance Criteria

- A click/slot activation on an empty or otherwise unusable slot (cooldown, active minion, hand full, insufficient magic stones) does NOT record any attack/cast progress toward dismissing the hint.
- A canvas basic-attack `pointerdown` when there is no usable slot (`pickBasicAttackSlot()` returns -1, or the chosen slot is rejected by `useCard()`) does NOT record attack progress.
- The gamepad `onUseSlot` path records progress only when its `useCard()` actually emits the action — a rejected gamepad activation does not count.
- Dismissal progress (and therefore the persisted `attackHintSeen:<playerId>` flag) is only advanced after `useCard()` accepts and emits a `USE_CARD` action (or, for a basic attack, after the routed `useCard()` succeeds).
- The timeout dismissal path and the existing keyboard/gamepad hint-text behavior are unchanged.
- Client tests cover: an empty/unusable-slot click NOT dismissing the hint, a no-usable-slot basic attack NOT dismissing, and that a genuine successful attack AND successful cast still dismiss + persist as before.

## Technical Specs

- `game/client/main.js`:
  - Change `useCard(slotIndex)` (main.js:4029–4085) to return a boolean success signal: `false` on every early-return rejection path (`slotIndex` out of range, no card, `!canUseSlot`, `card.activeMinionId`, `draw_card` with full hand, insufficient magic stones) and `true` on each path that reaches `socket.emit(CLIENT_TO_SERVER.USE_CARD, …)` and returns after `playActivationEffect`. Do not change what `useCard` emits or its side effects — only add the return value.
  - Click handler (main.js:4103–4108): only call `attackHintDismisser.noteProgress({ casted: true })` when `useCard(...)` returned `true`.
  - Canvas basic-attack `pointerdown` (main.js:4137–4147): only call `attackHintDismisser.noteProgress({ attacked: true })` when `slot >= 0` AND `useCard(slot)` returned `true`.
  - Gamepad `onUseSlot` (main.js:1127): gate `noteAttackHintSlotAction(slot)` on the `useCard(slot)` result; update `noteAttackHintSlotAction` (main.js:296–299) so it is only invoked after a successful `useCard`, preserving the slot-0-is-attack-on-gamepad framing.
  - Keep `useCard` exported as `window.__useCardForTest` (main.js:5197) so the return value is testable.
- `game/client/attackHintDismiss.js`: no behavior change required (its `noteProgress` already gates on `phase === 'active'`); only touch if a helper return type is needed.
- Add/extend a client test (e.g. `game/client/test/attack-hint-dismiss.test.js` or a new `attack-hint-dismiss-action.test.js`) that drives the dismisser through a `useCard`-style success/failure shim to assert rejected attempts do not advance `_state()` and that an attack+cast of accepted actions still dismisses and persists the seen flag.

## Verification: code
