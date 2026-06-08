# 06-show-windup-warning-in-card-hand

Add a wind-up warning badge to the in-run card-hand render for cards that have a `windUpMs` value (Solar Edge and Corebreaker Greatsword), so players can see the commit lockout before playing the card.

## Acceptance Criteria

- Cards in the player hand that have `windUpMs > 0` in their `CARD_DEFS` entry display a visible wind-up warning badge (e.g. `600 ms` or a "⚠ Wind-up" label) within the card slot's rendered content.
- The wind-up badge is present for both **Solar Edge** (`flame_blade`, 600 ms) and **Corebreaker Greatsword** (`magma_greatsword`, 800 ms) when they appear in hand.
- Cards without `windUpMs` (e.g. `iron_sword`, `excalibur_photon`) do NOT show the badge.
- CSS styling exists for the new wind-up badge class (consistent with existing badge styles like `.evolved-badge`, `.echo-badge`).
- Client tests in `game/client/test/main.test.js` verify that the wind-up badge element is rendered for `flame_blade` and `magma_greatsword` hand cards, and absent for a control card without wind-up.

## Technical Specs

- **game/client/main.js** — In `renderHand()`, after building `content.innerHTML`, look up `CARD_DEFS[card.id]?.windUpMs` and inject a `<span class="windup-badge">` element (e.g. showing the ms value or a warning icon with the duration) when `windUpMs > 0`.
- **game/client/style.css** — Add `.card-slot .windup-badge` styling (color, font-size, positioning) matching the visual language of `.evolved-badge` and `.echo-badge`.
- **game/client/test/main.test.js** — Add tests that:
  1. Mock a hand containing a `flame_blade` card, call `renderHand()`, and assert the slot contains an element with `.windup-badge` class referencing the wind-up duration.
  2. Same for `magma_greatsword`.
  3. Control: mock a hand with `iron_sword` and assert no `.windup-badge` is present.

## Verification: code
