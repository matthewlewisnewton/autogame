# Wire Aegis Sentinel cast (shield + taunt minion)

Hook `aegis_sentinel` into the existing `astral_guardian` / `astral_shield` cast path so playing the card grants a 30 HP shield (~8s), spawns a durable taunt minion with no offensive burst, and deducts 45 Magic Stones. Depends on sub-ticket 01 (card defs must exist).

## Acceptance Criteria

- Casting `aegis_sentinel` in a dungeon run (via `useCard`) succeeds when the player has ≥45 Magic Stones and an occupied hand slot.
- On cast: `player.shieldHp` is set to 30 and `player.shieldExpiresAt` is ~8000 ms ahead; no radial damage is dealt to enemies (`damage: 0` → empty or zero-damage `hits`).
- A minion is pushed to `state.minions` with `type: 'aegis_sentinel'` (or `data.cardId`), `hp`/`maxHp` 160 (grind-scaled like peers), `ttl`/`maxTtl` 30, `taunt: true`, and `attackDamage: 0` (or omitted with 0 from card def).
- Enemies within detection range prefer the taunt minion over the caster (same behavior as `skeleton_knight` taunt).
- The spawned minion does not reduce enemy HP when it “attacks” (pure wall).
- `cardUsed` payload includes `shieldGranted: 30` and `minionId` consistent with the astral branch.

## Technical Specs

- **`game/server/cardEffects.js`** (~686–742): extend the condition `cardDef.effect === 'astral_guardian' || cardDef.specialEffect === 'astral_shield'` so `aegis_sentinel` is handled (identity `type: 'creature'` currently skips the spell block — either invoke this block for qualifying creatures before the `type === 'creature'` branch, or extract a small shared helper called from both). When building the minion object:
  - Set `type` to `data.cardId` (`'aegis_sentinel'`).
  - Set `minion.taunt = true` when `cardDef.taunt`.
  - Honor `cardDef.shieldHp`, `shieldDurationMs`, `minionHp`, `minionTtl`, `attackDamage` from defs.
- **`game/server/simulation.js`**: extend the `minion.type === 'astral_guardian'` AI block (~1971) to include `'aegis_sentinel'` so the minion uses the astral follow/attack loop with `attackDamage: 0` instead of falling through to the generic minion path (hardcoded 5 damage).
- No changes to `game/shared/cardDefs.json` beyond what 01 already added unless cast routing requires an extra field.

## Verification: code
