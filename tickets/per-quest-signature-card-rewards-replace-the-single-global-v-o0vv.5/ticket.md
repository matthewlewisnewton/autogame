# Per-quest signature card rewards: replace the single global victory rotation, surface reward on the quest board

## Difficulty: easy

## Goal

PSO model: rewards were quest-specific and stated upfront, which is what gives a player a reason to pick THIS quest. Currently every quest pulls card rewards from one global list: VICTORY_REWARD_ROTATION (game/server/config.js ~48-51 @ b4a5bb8) and currency differs by only 10-20.

DESIGN
- Add optional rewardCards / signatureCardId to quest tier defs (game/server/quests.js); victory reward selection prefers the quest's own pool and falls back to the global rotation for quests without one.
- Theme assignments, e.g.: frost_crossing -> an ice/slow card; ember_descent -> a burn card; spire_ascent -> a knockback/edge card; crystal_rescue -> a utility/pickup-radius card. (Use existing CARD_DEFS where possible; new cards can be follow-up beads.)
- Quest board UI shows the signature reward next to currency (pairs with autogame-o0vv.3 briefing panel).

ACCEPTANCE
- Winning frost_crossing offers its signature card in the reward choices; winning training_caverns does not offer frost's signature.
- Quest board displays each quest's signature reward before accepting.
- Quests without a signature pool behave exactly as today.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
