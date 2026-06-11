1. Bulkhead Mauler deploy/summon VFX never renders in real gameplay, and a wrong
   attack shockwave fires on deploy. The card def stamps `specialEffect:"shockwave_sweep"`
   (cardStats.json) onto the *deploy* CARD_USED event (cardEffects.js:1393-1401),
   so `renderBulkheadMaulerSummon`'s `specialEffect === 'shockwave_sweep'` guard
   early-returns and `renderBulkheadMaulerShockwaveSweep` fires instead.
   Files: game/client/cardRenderers.js (renderBulkheadMaulerSummon ~1361,
   renderBulkheadMaulerShockwaveSweep ~2452)
   Fix: discriminate deploy-vs-attack on an attack-only field, not `specialEffect`.
   The attack event always has `direction`/`hits` (simulation.js:3711-3721); the
   deploy event has neither. Change the summon guard to fire on `data.minionId`
   when `!data.direction` (and drop the `specialEffect` check), and require
   `data.direction` (or `data.hits`) in the shockwave-sweep guard — mirroring the
   wyrm `breathPhase` pattern (renderWyrmSummon ~1931 / renderWyrmAttack ~1979).
2. Add a renderer test using the REAL deploy payload — `{ cardId:'bulkhead_mauler',
   minionId, specialEffect:'shockwave_sweep', origin }` with NO direction/hits —
   asserting the deploy effect + summon flourish fire and the shockwave does NOT;
   and the real attack payload (with direction/hits) asserting the inverse. The
   current summon tests omit `specialEffect`, so they passed while the integration
   was broken. Files: game/client/test/cardRenderers.test.js
