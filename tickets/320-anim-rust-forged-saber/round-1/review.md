# Senior Review — 320-anim-rust-forged-saber

## Runtime health (blocking gate)
- `metrics.json`: `"ok": true`, servers started, URL served at :5177.
- `pageerrors`: `[]` (and `pageerrors.json` empty). No `failure_kind`, no `harness_failure`.
- `console.log`: only `[vite] connecting/connected`, a benign `409 Conflict` resource
  load (known harness lobby-create noise), and normal `[initScene]` / `[launchBooth]`
  logs. No `pageerror`, no `[fatal]`, no game-code exception.
- Screenshot `02-after-w.png` shows the scene rendering correctly with the
  Rust-Forged Saber cards (slots 4 & 5, `5/5`) present in hand.
- **Game starts and loads cleanly.** Gate passes.

## Scope
Diff vs baseline `54d3c96b` touches only `game/client/cardRenderers.js` and
`game/client/test/cardRenderers.test.js` (plus ticket docs) — exactly the
declared scope (this card's render fn + registration + client test). No server,
shared, or other-card changes; no risk of conflict with sibling animation beads.
No `?debugScenario` shortcut added.

## Acceptance criteria

### "Animation visibly matches its name/theme"
PASS. `renderWeaponSwing`'s inline `iron_sword` style was removed and replaced
with a dedicated `renderRustForgedSaber` registered as `CARD_RENDERERS.iron_sword`.
Theme reads as a weathered forged blade: weathered-iron body (`color 0x78716c`,
the stone/iron tone shared with `rusty_shiv`/`bulkhead_mauler`) with oxidized
**rust** emissive accents (`emissive 0xb45309`), distinct from `flame_blade`'s
orange and `steel_claymore`'s cool slate. It composes 315 primitives only:
`spawnAttackEffect` (tight saber arc, `coneAngle π/5`), a metallic spark/rust-flake
`spawnParticleBurst` along the cut, and a scored-metal `spawnImpactDecal` ground
mark — explicitly **no** `spawnProjectileTrail` (a trail would read as fire/energy
on a melee weapon). Every ctx call is guarded so it degrades gracefully if a
primitive is absent. Verified the helpers used (`originOf`, `directionOf`,
`pointAlong`, `getAccentHex`, `PHOTON_BARRAGE_SWING_DELAY_MS`) all exist.

### "Timing synced to server effect resolution"
PASS. The renderer derives reach and placement from the server payload:
`range`/`coneAngle` come from `data.attackRange` / `data.attackConeAngle`
(falling back to style defaults), spark and decal points are computed along that
range, and `swingCount` drives repeats via `scheduleAfter`. `iron_sword` is an
instant melee weapon with no `windUpMs`, so the single swing fires immediately
(no `scheduleAfter` delay) — matching the instant-weapon contract. Tests assert
`CARD_DEFS.iron_sword.windUpMs` is undefined, that range/cone pass through, that
spark/decal placement scales with `attackRange` (≈3× at 9 vs 3), and that a
single swing schedules no delay.

### "No perf regression"
PASS. Pure VFX composition on a single weapon's render path; no new per-frame
work, no added allocations in hot loops. Swing count is server-bounded.

### "Client test where feasible"
PASS. `cardRenderers.test.js` adds renderer-identity assertions
(`resolveRenderers('iron_sword')[0].name === 'renderRustForgedSaber'`), updated
the existing styled-slash test to the new rust palette + spark contract, and adds
a new "iron_sword reach + instant-hit timing" describe block (4 tests). Full
suite runs green: **292 passed**.

## Remaining gaps
None blocking. One nit (see `nits.md`): `getAccentHex('iron_sword') ?? style.color`
is effectively always `style.color` because `iron_sword` has no `CARD_ACCENT_STYLE`
entry — harmless defensive code, but the accent lookup is dead for this card.

VERDICT: PASS
