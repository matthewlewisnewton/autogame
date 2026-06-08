# 03 — Revert soul_drain to HP life drain (server)

`soul_drain` (Soul Drain, evolved from mana_leach) is a radial-damage spell with `magicStoneOnHit: 12`. It should also heal the caster for HP on each hit and on kills — a life-drain effect. Add `healOnHit` and `healOnKill` to the card stats and wire them through `collectRadialHits()`.

## Acceptance Criteria

- `CARD_DEFS.soul_drain.healOnHit` is 12 (HP healed per enemy hit)
- `CARD_DEFS.soul_drain.healOnKill` is 18 (HP healed per enemy killed)
- `collectRadialHits()` accepts `healOnHit` and `healOnKill` options and returns `hpHealed` in its result
- Using `soul_drain` in combat deals radial damage AND heals the caster for `healOnHit` per hit + `healOnKill` per kill (capped at `MAX_HP`)
- `magicStoneOnHit` still works (soul_drain keeps both MS gain AND HP drain)
- Existing server tests pass (updated to expect HP healing alongside MS gain)

## Technical Specs

**`game/shared/cardStats.json`** — For `soul_drain`:
- Add `"healOnHit": 12` and `"healOnKill": 18`
- Keep existing `magicStoneOnHit: 12` and `damage: 42`

**`game/server/simulation.js`** — In `collectRadialHits()`:
- Accept `healOnHit` and `healOnKill` from `options` (default 0)
- Accumulate `hpHealed` alongside `magicStonesGained` inside the enemy loop
- Return `{ hits, magicStonesGained, hpHealed }` in the result object

**`game/server/cardEffects.js`** — In the spell fallthrough (radial AoE at end of spell branch):
- Pass `healOnHit: cardDef.healOnHit` and `healOnKill: cardDef.healOnKill` to `collectRadialHits()`
- After `collectRadialHits()`, call `healPlayer(socket.playerId, radial.hpHealed || 0)` to apply the life drain
- Include `hpHealed` in the `CARD_USED` emit payload

**`game/server/test/server.test.js`** — Update:
- Remove `expect(CARD_DEFS.soul_drain.healOnHit).toBeUndefined()` and `expect(CARD_DEFS.soul_drain.healOnKill).toBeUndefined()`
- Add assertions that `healOnHit` is 12 and `healOnKill` is 18

**`game/server/test/new_card_pack.test.js`** — Update `"Soul Drain radial hits grant magic stones without healing the attacker"`:
- Change to verify BOTH `magicStonesGained` (24) AND `hpHealed` (24 = 2 hits × 12)
- Verify caster HP increases by the healed amount

## Verification: code
