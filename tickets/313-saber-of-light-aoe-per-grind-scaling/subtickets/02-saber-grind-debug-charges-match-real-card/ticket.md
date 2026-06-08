# Fix saber-grind-max debug scenario to use the real card's charge count

The `saber-grind-max` debug scenario fabricates a `saber_of_light` with `charges: 5` / `remainingCharges: 5` when the player does not already hold one, but the real card definition in `cardDefs.json` gives Saber of Light 6 charges. This makes the debug shortcut an impossible, non-reachable gameplay state. Make the fabricated/normalized Saber match the real card's charge count so the +10 debug state mirrors a normally owned, grinded, deployed Saber of Light.

## Acceptance Criteria

- The `saber-grind-max` scenario fabricates a `saber_of_light` with `charges` and `remainingCharges` equal to the real card definition's charge count (6), not 5.
- The charge count is derived from the real card definition (`cardDefs.json`) rather than a hardcoded literal that can drift, OR is explicitly set to 6 to match it.
- When the player already holds a `saber_of_light` in hand, the existing-card branch refills `remainingCharges` to that card's own `charges` (falling back to the real card def's 6, not 5) and sets `grind = 10`.
- The fabricated Saber still has `grind: 10`, correct `id`, `name`, and `type: 'weapon'`.
- No other debug scenario or unrelated logic is changed.

## Technical Specs

- `game/server/debugScenarios.js`: in the `name === 'saber-grind-max'` branch (around line 1378), change the fabricated `saberCard` to use 6 charges. Prefer sourcing the count from the real card definition — `cardDefs.json` is already required by sibling modules (`config.js`: `const CARD_DEFS = require('../shared/cardDefs.json')`); add a require for it (or reuse one if present) and read `CARD_DEFS.saber_of_light.charges`. Update both the fabricated `saberCard` literal and the existing-card fallback `player.hand[saberSlot].charges || 5` so the fallback resolves to 6.
- `game/shared/cardDefs.json`: read-only reference for the authoritative `saber_of_light.charges` value (6). Do not change it.
- Keep the change minimal and contained to the `saber-grind-max` branch.

## Verification: code
