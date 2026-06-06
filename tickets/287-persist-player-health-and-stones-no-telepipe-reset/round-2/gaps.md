1. Non-Medic healing is still available during normal gameplay, so the owner decision "health is restored ONLY at the med booth" is not fully implemented.
   Files: game/server/cardEffects.js, game/server/simulation.js, game/server/keyItemEffects.js, game/shared/cardStats.json
   Fix: Remove or redesign HP restoration from `healing_font`, `divine_grace`, `healOnHit`/`healOnKill`, and `field_medic_kit` so only `healAtMedic()` can increase player HP; update affected tests/client copy as needed.
