# Senior review: hoist per-frame allocations in renderer `animate()`

**Ticket:** Client: hoist per-frame allocations in renderer animate() (Object.entries, Sets, template strings)  
**Baseline:** `dcca309171788ffb835e2c0d693d347a12703836`  
**Commits reviewed:** `c282bc38` → `a71eacb0` (4 sub-tickets)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `console.log` pageerror / `[fatal]` | none |
| Harness capture | Full smoke flow: auth → lobby → deploy → movement → dodge; probes show `phase: "playing"`, canvas present, enemies rendered |

The 409 Conflict lines in `console.log` are auth/register noise, not game crashes. Screenshots show a healthy lobby and in-run dungeon state with HUD, card hand, and dodge cooldown working.

## Acceptance criteria

### No per-frame `Set` / `Object.entries` / template-string / literal allocations in `animate()` entity loops; rendering unchanged

**Per-frame `Set` allocations — fixed.** `syncEnemyMeshes` and `syncMinionMeshes` now clear and reuse module-level `_currentEnemyIds` / `_currentMinionIds` instead of `new Set(gs.enemies.map(...))` each frame (`enemySync.js`, `minionSync.js`).

**`Object.entries(gs.players)` — fixed.** Both player loops in `playerSync.js` and `syncPhaseStepAllyHighlight` in `renderer.js` now use `Object.keys` + direct lookup. Grep confirms no remaining `Object.entries(gs.players)` or `new Set(gs.enemies|minions` in `game/client/`.

**Local slow/burn indicator literals — fixed.** `playerSync.js` reuses `_localSlowScratch` and `_localBurnScratch` for the local player's predicted-position indicators instead of allocating `{ slowedUntil, x, z }` / `{ burningUntil, x, z }` every frame.

**`updateDamageNumbers` `Vector3` — fixed.** Module-level `_damageNumberProjVec` replaces `new THREE.Vector3()` inside the per-damage-number loop (`renderer.js`).

**Cosmetic signature template strings — addressed per ticket spec.** `playerSync.js` caches `cosmeticKey` on the avatar mesh and skips `cosmeticSignature()` when `mesh.userData.cosmeticRef === pData.cosmetic`. When the ref differs, signature is recomputed and compared to `cosmeticKey` before rebuilding — same rebuild guard as before, with fewer string builds when the cosmetic object reference is stable (hub presence, unit tests). Note: each Socket.IO `stateUpdate` deserializes fresh player/cosmetic objects, so live multiplayer still recomputes signatures each tick; this matches pre-change behavior and does not regress rendering.

**Rendering behavior — unchanged.** Harness probes show correct player HP, dodge cooldown HUD, enemy positions updating, and card hand state across movement/dodge. Vitest: **49 files, 506 tests passed** (`coverage.log`). Renderer-focused suites (`avatar-cosmetic-render`, `renderer-enemy-emissive-priority`, `renderer-minion-summon`, `renderer-loot`, `renderer-shield-bar`, etc.) all pass.

## Design & requirements consistency

- **design.md:** No gameplay, networking, or combat-rule changes; renderer-only perf refactor aligned with the stated renderer-split module layout (`playerSync.js`, `enemySync.js`, `minionSync.js`).
- **requirements.md:** 3D rendering, WebSocket connectivity, multiplayer visualization, and movement sync all exercised successfully in capture probes. No foundation regressions observed.

## Code quality

- Changes are minimal, localized, and follow existing module patterns (module-level reuse mirrors other renderer scratch state).
- No dead code or broken imports introduced.
- `cosmeticRef` is set on avatar creation/rebuild; `applyLoadedModelCosmetic` still runs every frame for proportion morphs (intentional — proportions are outside `cosmeticSignature`).
- No debug scenarios added or modified; debug-scenario gating not applicable.

## Sub-ticket integration

All four decomposed sub-tickets are present in the commit history and map cleanly to the changed files:

| Sub-ticket | Files |
|------------|-------|
| 01 enemy/minion ID Sets | `enemySync.js`, `minionSync.js` |
| 02 Object.keys player loops | `playerSync.js`, `renderer.js` (`syncPhaseStepAllyHighlight`) |
| 03 cosmetic cache + status scratch | `playerSync.js` |
| 04 damage-number Vector3 | `renderer.js` |

No integration gaps between sub-tickets.

## Remaining gaps

None.

VERDICT: PASS
