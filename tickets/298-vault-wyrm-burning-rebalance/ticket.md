# 298-vault-wyrm-burning-rebalance

## Difficulty: medium

## Goal

Rebalance the WURM SUMMON minion — card dungeon_drake ("Vault Wyrm", a creature/minion summon). Change its summoned minion to deal a LITTLE LESS damage than today, but its attacks now also inflict the BURNING status (291) on enemies it hits. Net: lower direct damage, added burn DoT. DEPENDS ON 291 (burning).

ACCEPTANCE: the Vault Wyrm (dungeon_drake) minion damage per hit is reduced by a modest amount; its hits call applyBurning on the target enemy; update card stats/description text to reflect the burn; server tests for reduced damage + burn application. SCOPE: game/server (minion/summon logic for dungeon_drake) + game/shared/card*.json (stats/desc) + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
