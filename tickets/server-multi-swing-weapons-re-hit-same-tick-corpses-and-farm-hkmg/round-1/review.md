# Senior Review: Server multi-swing weapons re-hit same-tick corpses and farm magicStoneOnHit

**Ticket:** `server-multi-swing-weapons-re-hit-same-tick-corpses-and-farm-hkmg`  
**Baseline:** `7abdf4a404135153ff585f7364bc3b80c11b8b45`  
**Implementation commit:** `e2640454` — skip dead enemies in cone/radial hit collectors  
**Reviewer scope:** Holistic acceptance-criteria check against live working tree, capture artifacts, tests, and design alignment.

---

## Runtime health (capture proof)

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes |
| `pageerrors` | Empty `[]` |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` `pageerror` / `[fatal]` | None |
| Game phase in probes | `playing`, scene initialized, canvas present |

The captured run on `http://localhost:5176/` completed the fallback smoke flow (auth, lobby, deploy, movement, dodge). Console noise is limited to Vite connect lines and HTTP 409 on registration (duplicate username during harness replay) — neither is a game defect. **The game starts and loads cleanly.**

---

## Per-criterion findings

### Cone/radial hit collection skips enemies with `hp <= 0`

**Met.** `collectConeHits` and `collectRadialHits` in `game/server/simulation.js` each gained an early-loop guard:

```1705:1706:game/server/simulation.js
  for (const enemy of _gameState.enemies) {
    if (enemy.hp <= 0) continue;
```

```1743:1744:game/server/simulation.js
  for (const enemy of _gameState.enemies) {
    if (enemy.hp <= 0) continue;
```

This matches the established pattern in `collectChainLightningHits` (`enemy.hp <= 0` alongside `hitEnemyIds`). Corpses are skipped before range/cone/distance checks, damage application, and any `magicStoneOnHit` / kill-reward accounting.

### Multi-swing weapon kill grants on-hit stones only for swings on a living target

**Met.** The only production card with `swingsPerUse > 1` is `excalibur_photon` (`swingsPerUse: 2` in `game/shared/cardStats.json`), which routes through the cone collector inside `cardEffects.js`'s per-swing loop. With the new guard, swing 1 can kill and award `magicStoneOnHit`; swing 2 sees `hp <= 0` and contributes zero hits and zero stones before `cleanupAfterDamage` removes the enemy.

Integration coverage elsewhere (`card_windup_resolution.test.js`) confirms two cone hits land on a living target when HP is sufficient for both swings; the new unit tests cover the low-HP one-kill case that was the actual exploit.

### Regression test covers the corpse re-hit case

**Met.** New file `game/server/test/collect_hit_corpse_rehit.test.js` exercises both collectors:

- **Cone:** enemy at `hp === damage`, two `collectConeHits` calls with `magicStoneOnHit: 5` → total stones `5`, second call `hits.length === 0`.
- **Radial:** same pattern with `magicStoneOnHit: 8` → total stones `8`, second call zero hits.

Tests mirror the `swingsPerUse` loop in `cardEffects.js` and follow the `createGameState` / `beforeEach` reset pattern used elsewhere.

### Harness verification (vitest server+client)

**Met.** `round-1/coverage.log` shows `collect_hit_corpse_rehit.test.js` passing (2 tests). Independent `pnpm test:quick` run: **272 files, 3995 tests passed**. No regressions in existing `collectConeHits` / `collectRadialHits` callers.

---

## Design and foundation alignment

- **design.md:** Server-authoritative combat fix; no client or loot-loop changes. Consistent with Magic Stones as a combat economy resource.
- **requirements.md:** No regression to 3D render, WebSocket connectivity, multiplayer presence, or movement sync. Capture probes confirm connected gameplay.

---

## Debug scenarios

No new or modified `?debugScenario=` shortcuts in this ticket. Nothing to gate-check.

---

## Code quality

- **Scope:** Minimal — two `continue` guards plus focused regression tests. No dead code or unrelated churn.
- **Integration:** `cardEffects.js` `swingsPerUse` loop unchanged (correct per sub-ticket spec); fix lives at the collector layer where chain-lightning already rejected corpses.
- **Risk:** Low. Guards are idempotent for living enemies and align with `damageEnemy` / `cleanupAfterDamage` lifecycle.

---

## Remaining gaps

None. All acceptance criteria are satisfied; runtime capture is clean; tests pass.

---

VERDICT: PASS
