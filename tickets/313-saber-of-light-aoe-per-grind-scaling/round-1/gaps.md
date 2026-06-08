1. `saber-grind-max` creates an impossible 5-charge Saber of Light when no Saber is already in hand; the real card has 6 charges, so the debug shortcut is not equivalent to normal gameplay.
   Files: `game/server/debugScenarios.js`, `game/shared/cardDefs.json`
   Fix: Build the fabricated Saber from the real card definition or set `charges` and `remainingCharges` to 6 so the +10 debug state matches a normally owned, grinded, deployed Saber of Light.
