# Saber of Light: small AoE-per-grind scaling

Buff `saber_of_light` by giving it a gentle, conservative per-grind increase to
its AoE / hit reach (the cone attack range), so each grind level very slightly
widens how far the swing reaches. Keep it FAST and leave base damage and
cooldown exactly as they are.

## Acceptance Criteria
- `saber_of_light` in `game/shared/cardStats.json` keeps `damage: 12` and
  `cooldownMs: 400` unchanged (still faster than the default `COOLDOWN_MS`).
- `saber_of_light` gains an explicit base attack reach plus a small,
  conservative per-grind AoE scaling factor (e.g. ~2–4% per grind level), so
  its effective hit reach grows as grind level increases.
- The effective attack reach is strictly larger at a higher grind level than at
  a lower one (grind 0 < grind 5), but the per-level growth is small (no large
  jumps), so the weapon stays gentle/conservative.
- The per-grind AoE scaling applies ONLY to `saber_of_light` (opt-in via a card
  field); other weapons' attack reach is unchanged.
- The same effective reach is used both for hit detection and for the
  `CARD_USED` payload (`attackRange`), so the visual swing matches the hits.
- Base/per-charge damage still scales via `scaledGrindStat` as before; nothing
  about damage or cooldown changes.
- A test in `game/server/test/` covers the new behavior: effective AoE reach
  increases with grind for `saber_of_light`, and `damage`/`cooldownMs` are
  unchanged.
- `pnpm test:quick` (from `game/`) passes.

## Technical Specs
- `game/shared/cardStats.json`: under `saber_of_light`, add an explicit
  `attackRange` base value equal to the current effective default (`5`, i.e.
  `ATTACK_RANGE` from `game/server/config.js`) and a new opt-in field for the
  AoE-per-grind factor, e.g. `aoeGrindScale: 0.03` (small/conservative). Do NOT
  change `damage` (12) or `cooldownMs` (400).
- `game/server/cardEffects.js`: in the weapon attack handler (the cone branch
  around lines 328–366, where `attackRange = cardDef.attackRange || ATTACK_RANGE`
  and `grind = handCard.grind || 0`), compute an effective attack reach that,
  when `cardDef.aoeGrindScale` is set, multiplies the base `attackRange` by
  `(1 + grind * cardDef.aoeGrindScale)`. Keep it as a float (do NOT round) so the
  growth is smooth and very small. Use this effective reach for
  `collectConeHits(...)` AND for the `attackRange` field in the `CARD_USED`
  emit (around line 469). Cards without `aoeGrindScale` keep their existing
  behavior. Consider extracting a tiny helper (e.g.
  `effectiveAttackRange(cardDef, grind)`) and exporting it so it can be
  unit-tested.
- `game/server/test/`: add/extend a test (e.g. a new
  `saber_aoe_grind.test.js` or within `new_card_pack.test.js`) asserting that
  the effective AoE reach for `saber_of_light` at grind 5 is greater than at
  grind 0, that the per-level growth is small, that the scaling does NOT apply
  to a control weapon lacking `aoeGrindScale`, and that `damage` (12) and
  `cooldownMs` (400) remain unchanged.

## Verification: code
