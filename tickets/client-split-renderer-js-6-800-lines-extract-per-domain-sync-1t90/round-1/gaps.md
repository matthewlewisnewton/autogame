1. Top-level renderer split is incomplete: player/enemy/minion/hazard/loot sync remains inside `game/client/renderer.js`, and `syncMeshMap()` only replaces spike-trap and ice-ball reconciliation while core keyed reconcile loops remain hand-rolled.
   Files: `game/client/renderer.js`
   Fix: Move per-domain sync logic into real renderer domain modules imported by `renderer.js`, and apply the shared reconcile helper to the remaining repeated keyed mesh-map create/update/dispose patterns where applicable.
