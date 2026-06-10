# Senior Review: quest-objective crystals despawn after LOOT_LIFETIME_MS

**Ticket:** `server-quest-objective-crystals-despawn-after-loot-lifetime-19vg`  
**Baseline:** `93fb8513a59939c04c4ae40b11b926b593df0f87`  
**Commits:** `1c27adf2` (mark crystals quest-critical + skip lifetime filter), `cdaaa9d0` (regression test)

## Runtime health

Captured run is clean:

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`, no `failure_kind`
- `console.log`: Vite connect + scene init only; no `pageerror` or `[fatal]` lines
- Game reached `playing` phase with canvas, card hand, and socket connected (Initiate Vault fallback smoke)

The game starts and loads without browser defects.

## Per-criterion findings

### Quest-objective items never expire

**Met.** The loot lifetime purge in `game/server/index.js` now exempts `questCritical` entries:

```1538:1538:game/server/index.js
          state.loot = state.loot.filter(l => l.questCritical || (now - l.createdAt) < LOOT_LIFETIME_MS);
```

Every quest crystal is spawned through the single `spawnCrystals()` path in `game/server/progression.js`, which now sets `questCritical: true`:

```2539:2547:game/server/progression.js
    _gameState.loot.push({
      id,
      x: pos.x,
      z: pos.z,
      value: 0,
      kind: 'crystal',
      questCritical: true,
      createdAt: Date.now(),
    });
```

`collect_items` objectives (`crystal_rescue` tier 1 and tier 2) route through `objectives.js` → `ctx.spawnCrystals()`, so all prism salvage crystals get the flag. Grep confirms `kind: 'crystal'` is only pushed in `spawnCrystals()` — no alternate spawn path bypasses the fix.

Ordinary loot (gold, magic stones, card drops) still expires after `LOOT_LIFETIME_MS` (120 000 ms); the regression test covers both removal and retention cases.

### A >2-minute `crystal_rescue` run can still be completed

**Met (by code + unit test).** The root cause was crystals being removed from `state.loot` after 2 minutes, making pickup impossible. With `questCritical` exempt from the filter, remaining prisms persist indefinitely until collected. Pickup logic (`runHandlers.js`, `keyItemEffects.js`) is unchanged and still keys off `kind === 'crystal'`.

The harness capture used the deterministic Initiate Vault fallback smoke (not `crystal_rescue`), so browser proof of a >2-minute prism run was not captured. The new `crystal_lifetime.test.js` exercises the exact filter predicate past `LOOT_LIFETIME_MS` and asserts quest-critical crystals survive while expired ordinary loot is removed. Combined with the single spawn path, this is sufficient for this small, targeted fix.

### Regression test past LOOT_LIFETIME_MS

**Met.** `game/server/test/crystal_lifetime.test.js` adds five cases: constant sanity, ordinary expiry, ordinary retention, quest-critical survival, and mixed-array filtering. All five pass; harness `coverage.log` reports `113` test files / `1569` tests passed including this file.

### Consistency with design.md and requirements.md

**No regressions.** The change preserves the loot economy (ordinary drops still despawn) while fixing an unwinnable `collect_items` state for Prism Salvage — aligned with the quest-identity section in `design.md`. Foundation requirements (3D render, server-client socket, movement) remain satisfied per capture probes.

### Code quality

**Good.** Minimal two-file production change plus focused test. The `questCritical` flag is more extensible than hard-coding `kind === 'crystal'` in the filter (future non-crystal quest items could reuse it). Telepipe suspend/resume deep-clones loot (`captureCardCheckpoint`), so `questCritical` survives checkpoint round-trips.

No new debug scenarios were added; existing crystal debug shortcuts deploy through normal quest spawn and inherit the flag.

### Debug scenarios

**N/A — no new or changed debug scenarios in this ticket's diff.**

## Test and coverage notes

- Harness vitest run: all server tests green (`1569` passed).
- Changed-file coverage snapshot includes `index.js` at ~72% lines; the one-line filter change is exercised indirectly across the suite. `progression.js` `spawnCrystals` is covered by existing spawn/integration tests (crystal count assertions) though none newly assert `questCritical: true` on output.

## Remaining gaps

None blocking. All acceptance criteria are satisfied; runtime capture is clean.

VERDICT: PASS
