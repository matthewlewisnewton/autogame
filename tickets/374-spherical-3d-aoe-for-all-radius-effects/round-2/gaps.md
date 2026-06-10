1. `sacrificial_altar` still selects sacrifice targets with flat XZ distance, so a minion XZ-inside but vertically outside `sacrificeRadius` can be consumed.
   Files: `game/server/index.js`, `game/server/cardEffects.js`, `game/server/test/spherical_aoe_cards.test.js`
   Fix: pass the cast origin Y into `findSacrificeTarget`, use 3D distance via `getEntityWorldY`/`sphericalDistanceToEntity`, and add elevated in-sphere plus XZ-inside/out-of-sphere tests.
