1. Card text never conveys the wind-up: the `description` field added to
   `flame_blade` and `magma_greatsword` is dead data — no card UI renders it, so
   AC "card text reflects it" is unmet.
   Files: game/server/progression.js (cardChoiceDescription), game/shared/cardDefs.json
   Fix: make `cardChoiceDescription(def)` return `def.description` when present
   (before the specialEffect/type fallbacks) so the reward-choice card text shows
   the wind-up/commit line. Add a test asserting the chosen-card description for
   flame_blade/magma_greatsword reflects the wind-up.
