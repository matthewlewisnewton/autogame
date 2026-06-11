# Necroframe Knight: thematic necrotic summon-in renderer + timing sync

Give the Necroframe Knight (`skeleton_knight`, a taunt "wall" creature) its own
card-specific renderer instead of the bland generic creature default, so its
summon reads unmistakably as an undead bone-knight rising to guard. The summon
VFX must use the shared 315 VFX primitives, carry a bone-white + necrotic-purple
palette consistent with its evolution (`undead_commander`), and be timed to the
minion summon-in window so the effect resolves in sync with the server-spawned
minion mesh.

## Context

- `skeleton_knight` is a `taunt` creature minion (`shared/cardStats.json`:
  `minionHp: 120`, `effect: "skeleton_knight"`, `specialEffect: "taunt"`). It does
  **not** attack or fire projectiles — it tanks aggro (server `simulation.js`
  `findTauntMinionNear`). The **only** player-visible card animation is the
  initial summon, delivered via the `cardUsed` event with `data.minionId` and
  `data.origin` set (server `cardEffects.js` ~line 1395 `CARD_USED` emit).
- Today `resolveRenderers('skeleton_knight')` falls through to the type default
  `renderCreatureSummon` (`cardRenderers.js`), which only calls
  `spawnMinionSummonInEffect` with the generic bone-gray accent (`#d4d4d8`).
- The minion summon-in flourish runs over `MINION_SUMMON_IN_MS = 750`
  (`client/config.js`); `spawnMinionSummonInEffect(origin, style)` is the
  primitive that drives the rise. Its evolved form `undead_commander`
  (`renderUndeadCommander`) uses `UNDEAD_COMMANDER_COLOR = 0xe4e4e7` +
  `UNDEAD_COMMANDER_EMISSIVE = 0xa855f7` — reuse this palette family for visual
  continuity.

## Acceptance Criteria

- A new card-specific renderer function (e.g. `renderNecroframeKnightSummon`)
  exists in `game/client/cardRenderers.js` and is registered in `CARD_RENDERERS`
  under the Creatures section keyed by `skeleton_knight`.
- `resolveRenderers('skeleton_knight')` returns exactly one renderer, and it is
  NOT the generic `creature` type-default renderer (`renderCreatureSummon`).
- The renderer composes the shared 315 primitives only (e.g.
  `spawnMinionSummonInEffect`, plus `spawnTelegraphRing` / `spawnParticleBurst` /
  `spawnSummonEffect`); it must not introduce new Three.js objects directly.
- The summon visuals use a bone-white + necrotic-purple palette (reuse the
  `undead_commander` color family — bone `~0xe4e4e7`/`0xd4d4d8` body with
  necrotic-purple `~0xa855f7` emissive), so it reads as an undead knight and not
  a generic gray puff.
- The summon-in flourish is driven through `spawnMinionSummonInEffect` so it is
  bound to the `MINION_SUMMON_IN_MS` window; any layered burst/ring is emitted at
  the summon origin and (if staggered) scheduled within that window via
  `ctx.scheduleAfter`, never after the minion has finished materializing.
- The renderer only fires its summon VFX on the initial summon (guarded on
  `data.minionId` being present, matching the existing creature-summon contract),
  and degrades gracefully (no throw) when optional ctx helpers are absent.
- A client test in `game/client/test/cardRenderers.test.js` asserts: (a)
  `resolveRenderers('skeleton_knight')` has length 1 and differs from the
  creature default, and (b) invoking the renderer with a `makeCtx()` stub on a
  payload carrying `minionId` + `origin` calls `spawnMinionSummonInEffect` (and
  does not throw when called with `minionId` absent).
- `pnpm test` (vitest server + client) passes with no perf regression; the diff
  stays within the files listed below.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderNecroframeKnightSummon(data, ctx)`. Mirror the structure of
    `renderCreatureSummon` / `renderUndeadCommander`: early-return unless
    `data.minionId && ctx.spawnMinionSummonInEffect`; call
    `spawnMinionSummonInEffect(originOf(data), <necroframe style>)`; then layer a
    necrotic telegraph ring and/or bone-shard particle burst at the origin
    (guard each optional ctx helper). Define module-level color constants
    (e.g. `NECROFRAME_KNIGHT_COLOR` / `NECROFRAME_KNIGHT_EMISSIVE`) near the
    existing `UNDEAD_COMMANDER_*` constants.
  - Register `skeleton_knight: renderNecroframeKnightSummon` in `CARD_RENDERERS`
    under the `// Creatures` block (alongside `undead_commander`).
- `game/client/test/cardRenderers.test.js`: add the assertions described in the
  Acceptance Criteria, reusing the existing `makeCtx()` / `methodsCalled()`
  helpers and the `resolveRenderers` import.
- Do NOT change server code, card stats, or the accent registry beyond what is
  listed; `CARD_ACCENT_STYLE.skeleton_knight` already exists (`#d4d4d8`) and the
  renderer may read it via `getAccentHex('skeleton_knight')`.

## Verification: code
