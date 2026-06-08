## Runtime health

The captured run is healthy. `metrics.json` reports `"ok": true`, server/client startup succeeded, `pageerrors` is empty, and `console.log` contains no `pageerror` or fatal game-code errors. The only console noise is a 409 auth/resource conflict during harness setup plus normal Vite/Three development output, none of which indicates a broken game load.

Coverage visibility also shows the suite completed: 135 test files passed and 2169 tests passed.

## Acceptance criteria findings

### A card with `windUpMs` locks movement and other card usage for the duration, then resolves

Partially met for the current weapon test cards. The server stores `cardUseState: "windup"`, `cardWindupStartTime`, `cardWindupMs`, and `pendingCardUse`; movement application skips committed players; `useCard` rejects while `isPlayerCardCommitted()` is true; and the deferred weapon effect resolves later from the locked origin/facing.

However, the implementation is not robust for the top-level contract's optional per-card field. `tryBeginCardWindup()` is wired for weapons, spells, and creatures, but the spell/creature resolution paths still run their normal cost, cooldown, and hand-consumption logic after commit even though commit already paid costs and consumed charges. Enchantments do not call `tryBeginCardWindup()` at all, so an enchantment with `windUpMs` resolves instantly instead of committing. That means `windUpMs` is not actually a reliable per-card mechanic across the card system.

There is also a timing/order gap: `isPlayerCardCommitted()` returns false as soon as wall-clock duration elapses, while `pendingCardUse` may still be unresolved until the next simulation pass. The live playing tick applies movement before `updateMinions()` reaches `processPendingCardWindups()`, and `handleUseCard()` only checks `isPlayerCardCommitted()`. In the elapsed-but-not-yet-resolved window, movement or another `useCard` can be accepted before the committed card effect lands, which violates the intended ordering of "wind-up, resolve, then input resumes."

### A normal card with no `windUpMs` remains instant and unaffected

Met. `iron_sword`, `frost_nova`, and `dungeon_drake` regression coverage exercises instant weapon, spell, and creature use with no commitment state, and the changed code preserves the no-`windUpMs` fast path for those cards.

### Client shows wind-up animation and input-lock feedback

Met for server-reported commitment state. The client derives local lock state from `cardUseState === "windup"`, disables hand use through `canUseSlot()`, suppresses local movement emit during commitment, toggles `#card-hand.input-locked`, and renders a player wind-up ring/emissive flash for committed players.

### Server tests cover input-lock during wind-up, end resolution, and normal-card regression

Partially met. The new server tests cover the current weapon wind-up path, duplicate use rejection during the active timer, deferred weapon damage, death cancellation, telepipe cleanup, and normal cards. They do not cover `windUpMs` on spells, creatures, or enchantments, and they do not cover the elapsed-but-unresolved input race.

## Design and requirements consistency

The implementation direction matches the design goal of adding a vulnerability/commitment lever and does not regress the foundation requirements: the captured game renders, connects over WebSockets, shows players, and movement works in normal gameplay.

The remaining issues are within the new mechanic itself: the design says the field is optional per-card and server-authoritative, but the current server behavior is only complete for weapon cards and can resume input before the deferred effect has actually resolved.

## Debug scenarios

This ticket added `?debugScenario=magma-windup-ready` support through the existing debug scenario socket path. It is gated behind the explicit debug scenario entry point, places a real `magma_greatsword` into the hand, and still exercises the normal `useCard` server path. The end state is reachable through normal gameplay by evolving `flame_blade` into `magma_greatsword`; the shortcut does not bypass the actual card-use validation or deferred resolution path being tested.

## Remaining gaps

1. `windUpMs` is not implemented as a robust optional per-card mechanic across card types. Spell and creature wind-ups double-apply cost/cooldown/hand consumption at resolution, while enchantment wind-ups are ignored and resolve instantly.
2. Input can resume before the pending card effect is resolved once the timer has elapsed but before `processPendingCardWindups()` clears `pendingCardUse`, especially because movement runs earlier in the tick than deferred wind-up resolution and `useCard` checks only `isPlayerCardCommitted()`.

VERDICT: FAIL
