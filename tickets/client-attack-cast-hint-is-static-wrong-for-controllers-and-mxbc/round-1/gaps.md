1. Action-based hint dismissal is triggered by input attempts instead of successful attack/cast outcomes, so the hint can persistently disappear before the player has completed a real card cast.
   Files: game/client/main.js, game/client/attackHintDismiss.js, game/client/test/attack-hint-dismiss.test.js, game/client/test/attack-cast-hint.test.js
   Fix: Make card/attack handlers record dismissal progress only after useCard() accepts/emits a valid action or after an authoritative success signal, and add client tests for empty/unusable slot attempts not dismissing the hint.
