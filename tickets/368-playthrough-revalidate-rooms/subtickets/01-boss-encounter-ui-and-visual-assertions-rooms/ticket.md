# 01 — Boss encounter UI and distinct boss visual assertions (rooms)

Wire the existing boss-active capture probes (tickets **283** health-bar/encounter UI and **284** distinct boss visuals) into the **rooms** preset assertions and findings. `runBossEncounterStep` already records `bossEncounterUi` and `bossVisualIdentity` probes during `05-boss-active.png`; this sub-ticket makes the rooms driver treat them as first-class pass/fail criteria for `annex_overseer` (Annex Overseer).

## Acceptance Criteria

- `buildAssertions(summary, preset)` returns `bossEncounterUiVisible` and `bossDistinctFromAdds` when `preset` is `rooms` (or `summary.preset === 'rooms'`), using probes already nested under `summary.bossEncounter.probes`:
  - `bossEncounterUiVisible` — `hudVisible === true`, non-empty `bossName` (expect Annex Overseer display name), `encounterLocked === true`, `encounterPhase === 'active'`
  - `bossDistinctFromAdds` — `bossVisualIdentity.bossDistinctFromAdds === true` with `bossType === 'annex_overseer'`
- `buildAssertionFailureDetail` includes probe JSON for these keys when they fail (same pattern as sunken-canyon).
- `harness/validate/lib/findings.mjs` lists the two assertion keys under **Assertions** for `preset === 'rooms'` (mirror sunken-canyon block) and continues rendering **Boss encounter UI** / **Boss visual identity** sections from `run.bossEncounterUi` / `run.bossVisualIdentity` (or nested probe keys passed through `writeFullArtifacts`).
- `writeFullArtifacts` / `probes.json` merge includes `bossEncounterUi` and `bossVisualIdentity` for rooms runs (confirm or add if missing).
- `cd game && pnpm test:quick` passes.
- Do **not** run `pnpm validate:rooms` or overwrite `game/validation/rooms/` in this sub-ticket.

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — extend `buildAssertions` stage-boss branch so `rooms` preset (not only `sunken-canyon`) adds `bossEncounterUiVisible` and `bossDistinctFromAdds`; extend `buildAssertionFailureDetail` if needed.
- **Edit:** `harness/validate/lib/findings.mjs` — rooms-specific assertion lines in `renderFindings` / `renderAssertionSection`.
- **Edit:** `harness/validate/playthrough.mjs` — ensure `writeFullArtifacts` passes `bossEncounterUi` and `bossVisualIdentity` at top level for rooms (same as sunken-canyon).
- **Reuse (no changes unless probe fields missing):** `captureBossEncounterUiProbe`, `captureBossVisualIdentityProbe` in `playthrough.mjs`; DOM ids from `game/client/boss-encounter-hud.js`; harness `__getEnemyRenderScaleForTest` if present.
- **Scope:** `harness/validate/**` only; no gameplay balance changes.

## Verification: code
