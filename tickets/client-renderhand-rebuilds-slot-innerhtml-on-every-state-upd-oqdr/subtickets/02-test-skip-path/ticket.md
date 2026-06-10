# 02 — Add test covering renderHand skip-when-unchanged path

## Description

Add a unit test to `game/client/test/main.test.js` that verifies `renderHand()` skips DOM writes when slot signatures are unchanged. The test should call `renderHand()` twice with identical hand state and confirm that `innerHTML` is not reassigned on the second call (by spying on `Element.prototype.innerHTML` setter or checking that `content.children.length` is unchanged after the second call).

## Acceptance Criteria

- A new test in `game/client/test/main.test.js` (under the `renderHand()` describe block) calls `renderHand()` twice with the same hand state
- The test verifies that on the second call, the slot's `content.innerHTML` is not rebuilt (e.g., by spying on `Element.prototype.appendChild` or `Node.prototype.insertBefore`, or by checking that `content.childNodes.length` stays the same)
- The test also verifies that `--charge-pct` is still updated on the second call even when the signature matches
- All existing `renderHand()` tests continue to pass

## Technical Specs

- **File**: `game/client/test/main.test.js`
- Add test: `'skips DOM rebuild when slot signature is unchanged'` — populate `hand[0]` with a card, call `renderHand()` twice, assert that the second call does not trigger `innerHTML` assignment (e.g., by wrapping `Object.defineProperty` on `HTMLElement.prototype.innerHTML` or by checking child node count stability)
- Add test: `'still updates --charge-pct on consecutive calls with same card'` — call `renderHand()`, record `--charge-pct`, mutate `gameState.minions` to change TTL, call `renderHand()` again, assert `--charge-pct` changed despite signature match on structural fields

## Verification: code
