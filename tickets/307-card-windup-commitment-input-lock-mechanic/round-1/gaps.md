1. `windUpMs` is only correctly implemented for weapon cards; spell/creature wind-ups double-apply cost/cooldown/hand consumption at resolution, and enchantment wind-ups are ignored and resolve instantly.
   Files: `game/server/cardEffects.js`, `game/server/test/card_windup_*.test.js`
   Fix: Centralize wind-up commit before type-specific resolution, ensure deferred resolution skips cost/cooldown/hand consumption already paid at commit for every card type, wire enchantments through the same path, and add spell/creature/enchantment wind-up tests.

2. Input can resume before the committed card effect resolves after `windUpMs` elapses because lock checks use only wall-clock duration while `pendingCardUse` remains unresolved until a later simulation step.
   Files: `game/server/simulation.js`, `game/server/index.js`, `game/server/cardEffects.js`, `game/server/socketHandlers/runHandlers.js`
   Fix: Keep movement/card-use locked until the pending card is resolved and cleared, or process due card wind-ups before movement/input acceptance; add a regression test for elapsed-but-unresolved wind-up input.
