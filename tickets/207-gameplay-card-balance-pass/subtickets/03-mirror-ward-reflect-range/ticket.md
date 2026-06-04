# Mirror Ward: widen reflect radius

Raise `mirror_ward` `reflectRange` from 8 to 11 so area deterrence matches the enchantment tier floor (single-attacker spite → nearby-enemy reflect). Assert the new stat in server tests. No changes to `triggerMirrorWard` logic beyond reading the updated def.

## Acceptance Criteria

- `CARD_DEFS.mirror_ward.reflectRange` is `11` in `game/server/progression.js` (was `8`).
- `game/server/test/enchantment.test.js` includes an assertion that `CARD_DEFS.mirror_ward.reflectRange === 11` (new `it` or added to an existing mirror_ward block).
- Existing mirror_ward reflect and TTL tests still pass unchanged in behavior.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/server/progression.js`: in the `mirror_ward` entry (~L444–454), change `reflectRange: 8` to `reflectRange: 11`. Leave `damageScale`, `minReflectDamage`, `ttlMs`, and `target` unchanged.
- `game/server/test/enchantment.test.js`: add a focused stat test (e.g. `'mirror_ward reflectRange matches balance target'`) importing `CARD_DEFS` from `progression.js` and expecting `reflectRange: 11`.
- Do **not** change the `reflectRange: cardDef.reflectRange || 8` fallback in `simulation.js` unless required for tests (prefer data-only per parent ticket).

## Verification: code
