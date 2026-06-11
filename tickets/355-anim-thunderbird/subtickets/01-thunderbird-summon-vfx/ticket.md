# Thunderbird summon: storm-bird deploy flourish

Polish `renderThunderbirdSummon` so deploying a Thunderbird reads unmistakably as a storm spirit taking flight — not a generic cyan minion puff. Compose existing 315 VFX primitives into a sky-blue / electric deploy that is visually distinct from Stormwing Drone (`storm_eagle`) and timed to the shared minion summon-in window.

## Acceptance Criteria

- `renderThunderbirdSummon` still early-returns when `data.hits?.length` is truthy or `data.minionId` is missing (attack payloads must not replay the deploy flourish).
- On a summon-only `cardUsed` payload (`minionId` present, `hits: []`), the renderer calls `ctx.spawnMinionSummonInEffect` with a Thunderbird palette (`color: 0x38bdf8`, `emissive: 0x0ea5e9`) and parameters that read larger/brighter than `renderStormEagleSummon` (e.g. `radius ≥ 1.2`, `burstCount ≥ 14`).
- The summon composition adds at least one extra storm-bird cue on top of the shared flourish — e.g. an upward-angled `spawnParticleBurst` (wing lift), a brief `spawnTelegraphRing` pulse, or a second burst at elevated Y — so the deploy is clearly aerial/storm-themed, not just a recolored ground ring.
- All flourish durations passed to primitives use `MINION_SUMMON_IN_MS` (750 ms) so the VFX lifetime matches the minion mesh scale-in driven by `minionSync.js`.
- Thunderbird has **no** `windUpMs` in merged card defs — the summon VFX fires synchronously on `CARD_USED` receipt with no `scheduleAfter` delay gating the initial deploy.
- Every `ctx.*` call is guarded (`if (ctx.spawnTelegraphRing)` etc.) so a missing primitive never throws.
- `thunderbird` registration remains `[renderThunderbirdSummon, …]`; `storm_eagle` summon renderer is unchanged.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Enhance `renderThunderbirdSummon` (~L1143–1153): keep `spawnMinionSummonInEffect` as the base, add 1–2 guarded supplementary primitives at `originOf(data)` using the Thunderbird accent constants. Import/use `MINION_SUMMON_IN_MS` from `./config.js` for any explicit `duration` overrides.
  - Define a small `THUNDERBIRD_SUMMON_STYLE` constant near `CHAIN_LIGHTNING_ARC_STYLE` for shared color/emissive reuse by sub-ticket 02.
  - Do **not** modify `renderStormEagleSummon`, shared `spawnMinionSummonInEffect` internals in `renderer.js`, or server code.
- **Server reference** (read-only): creature deploy emits `cardUsed` with `{ cardId: 'thunderbird', minionId, origin, hits: [] }`; minion hovers at `floorY + 4.5` (`cardEffects.js` sets `flying: true`, `altitude: 4.5`).
- **`game/client/test/cardRenderers.test.js`**: update the existing `thunderbird summon renders a sky-blue flourish distinct from storm_eagle` case to assert the enhanced primitive calls (at minimum: `spawnMinionSummonInEffect` + at least one additional storm cue primitive).

## Verification: code
