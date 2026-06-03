1. Dodge Roll cooldown docs say 800ms but server defs use 1200ms after an out-of-scope balance change in commit 5f95516.
   Files: game/server/progression.js, game/server/index.js, game/docs/controls.md, game/docs/gameplay-review.md, game/server/test/dodge_roll.test.js, game/server/test/key-items.test.js
   Fix: Revert `dodge_roll.cooldownMs` (and `def.cooldownMs || …` fallback) to 800; restore server tests to 800. Do not change gameplay for harness convenience — capture already passes with client HUD hooks at 800ms.
