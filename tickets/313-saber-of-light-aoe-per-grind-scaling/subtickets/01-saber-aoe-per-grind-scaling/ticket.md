# Saber of Light: small per-grind AoE/reach scaling

Buff `saber_of_light` via gentle scaling rather than raw damage: give its
attack hit area (reach) a very small, conservative increase per grind level,
while keeping it FAST. Base damage (12) and cooldown (400ms) stay unchanged.

## Acceptance Criteria
- `saber_of_light`'s effective attack reach (the `attackRange` used for cone hit
  detection) increases with the card's grind level.
- At grind 0 the reach equals its base value — behavior is unchanged from the
  current default (i.e. no regression for an un-ground saber).
- The per-level growth is very small / conservative — strictly smaller than the
  standard `GRIND_STAT_SCALE` (0.05) damage grind rate (target ~0.02 per level
  or less).
- Saber's base `damage` (12) and `cooldownMs` (400) in
  `game/shared/cardStats.json` are unchanged; the card remains fast.
- The scaling is opt-in / saber-specific: other weapons' reach is NOT affected
  by this change.
- The `CARD_USED` event for the swing emits the scaled `attackRange` so the
  client swing visual matches the actual (grind-widened) hit area.
- Tests verify: reach at grind 0 equals base; reach at a higher grind (e.g. 5)
  is larger than at grind 0; and saber's `damage`/`cooldownMs` are unchanged.

## Technical Specs
- `game/shared/cardStats.json` — `saber_of_light`: keep `damage: 12`,
  `cooldownMs: 400`, `specialEffect: "swift_slash"`. Add an explicit base
  `attackRange` set to the current default (`5`, the server `ATTACK_RANGE`) so
  grind-0 behavior is identical, plus an opt-in scaling field
  (e.g. `"grindAreaScale": 0.02`) that flags this card for per-grind reach
  growth. Do NOT add this field to any other card.
- `game/server/cardEffects.js` — in the weapon attack path (around line 328
  where `const attackRange = cardDef.attackRange || ATTACK_RANGE`), when
  `cardDef.grindAreaScale` is set, multiply the effective `attackRange` by
  `(1 + grindLevel * cardDef.grindAreaScale)` where
  `grindLevel = Math.max(0, Math.floor(handCard.grind || 0))`. Keep the result
  a float (do NOT round — radius growth should be smooth/tiny). Apply this
  before `collectConeHits(...)` and ensure the same scaled `attackRange` is the
  value emitted in the `CARD_USED` payload (line ~469) so the visual matches.
  `grind` is already read at line 330; reuse it.
- Optionally factor the multiplier into a small helper (mirroring
  `getStatMultiplier`/`scaledGrindStat` in `game/server/progression.js`), but
  keep the change minimal and saber-scoped.
- Tests — add/extend a server test (e.g. new
  `game/server/test/saber_grind_aoe.test.js`, or extend
  `game/server/test/new_card_pack.test.js`) asserting the scaled reach behavior
  and that `damage`/`cooldownMs` are unchanged. Prefer a unit-level assertion on
  the computed reach (base * multiplier) over a full socket round-trip.

## Verification: code
