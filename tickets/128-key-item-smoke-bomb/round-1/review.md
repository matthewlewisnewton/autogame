# Senior Review — 128-key-item-smoke-bomb (Smoke Veil)

## Runtime health (blocking pre-check)

- `metrics.json`: `"ok": true`, `capturePlanValid: true`, `pageerrors: []`. Servers started, scene
  initialized, both players reached `phase: "playing"` with a live canvas.
- `console.log`: clean (6 lines, no `pageerror`/`[fatal]`/uncaught exceptions).
- No `harness_failure` block.

The captured run is healthy — the game starts and loads cleanly.

## Acceptance criteria

### Cooldown ~8s
PASS. `KEY_ITEM_DEFS.smoke_bomb.cooldownMs` changed from 18000 → 8000
(`game/server/progression.js`). The `useKeyItem` handler sets
`player.keyItemCooldownUntil = now + (def.cooldownMs || 8000)` and the prior cooldown gate rejects
re-use with `on_cooldown`. Covered by tests: cooldown window asserted within `[before+8000, after+8000]`,
and a second immediate use returns `on_cooldown` with `remainingMs ≈ 8000` and no new zone.

### Zone follows player or stays fixed (document choice)
PASS. Choice = **fixed at cast point**, documented in the handler comment ("spawn a short-lived fog
zone fixed at the caster's cast position") and the simulation helper. Zone is stored as
`{ ownerId, x, z, radius, expiry }` captured at cast time and never re-positioned. `isInSmokeZone`
does a radius test against the player's live position, so leaving the cloud ends the protection — the
intended "stand in the fog" behavior.

### Client smoke VFX
PASS (with one multiplayer nit, see below). `triggerSmokeVFX` (`game/client/renderer.js`) spawns a
ground-hugging translucent gray disc sized to the zone radius, fades in (~250 ms), holds, then fades
out over the back ~45% of the duration before disposing geometry/material and removing itself from
the scene. Wired in `main.js` on the `keyItemUsed` handler for `smoke_bomb`, using the server-sent
`x/z/radius/durationMs` (with a sensible fallback to the local player position). No leaks — the
instance is spliced out of `smokeVFX` on teardown.

### Tests: enemy miss rate up while in zone
PASS. `game/server/test/smoke_bomb.test.js` (6 tests, all passing locally in 27s). The key test fires
400 phase beams through the player: control (no zone) lands 100% (0 smoke misses); with an active zone
the in-zone miss rate is asserted `> 0.5` (missChance 0.75). Also covers the def shape, the broadcast
snapshot containing `smokeZones`, cooldown rejection, and zone pruning after `durationMs`. The
accuracy debuff is applied at both attack sites — ranged `collectPhaseBeamHits` and melee
`updateEnemies` windup resolution — via `Math.random() >= smokeMissChance(target)`.

## Integration / quality checks

- `smokeZones` lifecycle is sound: initialized in `resetTransientRunState`, filtered for expiry in
  `stateSnapshot`, and pruned each tick in `updateEnemies`. No unbounded growth.
- `key-items.test.js` correctly updated — its "not_implemented" probe was switched from `smoke_bomb`
  (now implemented) to `ground_anchor` (still unimplemented). Good housekeeping, keeps the negative
  test meaningful.
- Debug scenario `smoke-veil-ready`: added to the `DEBUG_SCENARIOS` allow-set and gated behind
  `debugScenarioAllowed` (`ALLOW_DEBUG_SCENARIOS=1` or non-production). It only sets up state — equips
  `smoke_bomb`, clears cooldown, clears `smokeZones`, spawns two adjacent melee enemies. It does NOT
  spawn a zone or bypass any invariant: the actual fog/accuracy mechanic still runs through the real
  `useKeyItem` → simulation path. The same end-state is reachable in normal play (smoke_bomb is a
  normal equippable key item, used via the standard handler). Meets the debug-scenario rules.
- `def` is in scope in the handler; cooldown gate precedes the smoke_bomb branch; `persistenceDirty`
  is flagged. No dead/broken code spotted in the diff.

## Remaining gaps

None blocking. One non-blocking nit (filed to `nits.md`): the smoke VFX is event-driven off the
caster's own `keyItemUsed`, so teammates standing in an ally's smoke see no fog — the renderer never
reads `snapshot.smokeZones`. The server mechanic already affects all players in the zone; only the
visual is caster-local. Cosmetic, does not affect any acceptance criterion.

VERDICT: PASS
