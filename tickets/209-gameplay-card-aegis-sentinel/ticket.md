# 209-gameplay-card-aegis-sentinel

## Difficulty: medium

## Goal

New evolved defensive creature 'Aegis Sentinel' — a taunt body that also shields the caster, bridging skeleton_knight (free taunt) and astral_guardian (offensive). Reuses the astral_guardian/astral_shield branch; no new engine feature.

## Acceptance Criteria

- 1. Add aegis_sentinel to CARD_DEFS reusing the astral_guardian / astral_shield effect path with damage 0 (no offensive burst), shieldHp 30, shieldDurationMs 8000, taunt minion minionHp 160 / minionTtl 30, attackDamage 0; magicStoneCost 45; isEvolved true.
- 2. Add identity stub to game/shared/cardDefs.json (type:creature, charges:1).
- 3. Add the id to SHOP_CARD_POOL so it is obtainable.
- 4. On cast: grant the player a 30hp shield (~8s) and spawn a durable taunt minion that draws aggro but deals no damage.
- 5. Add/extend a test; full vitest green.

## Verification

Reuse effect:\047astral_guardian\047 (or specialEffect:\047astral_shield\047) branch at game/server/cardEffects.js:686-742; damage:0 neutralizes its radial nuke, attackDamage:0 makes the minion a pure wall. If the minion spawn is not part of that branch, wire it via the existing creature/taunt summon path.
