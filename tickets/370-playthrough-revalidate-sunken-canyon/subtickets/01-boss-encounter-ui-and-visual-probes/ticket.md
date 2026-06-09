# 01 — Boss encounter UI and distinct boss visual probes

Extend the sunken-canyon boss-active capture step so the playthrough driver records whether ticket **283** boss health-bar/encounter UI and ticket **284** distinct Canyon Warden visuals are present during an active, locked encounter. Probes land in `probes.json` and surface in `findings.md`; no full revalidation run in this sub-ticket.

## Acceptance Criteria

- During the existing boss-active step (`05-boss-active.png`), the driver captures a `bossEncounterUi` probe with at least:
  - `hudVisible` — `#boss-encounter-hud` exists, not `.hidden`, `aria-hidden !== 'true'`
  - `bossName` — non-empty text from `#boss-encounter-name` (expect Canyon Warden display name)
  - `hpFillWidthPct` — numeric width % from `#boss-encounter-hp-fill` style or harness `bossEncounter.hpPct`
  - `encounterLocked` — harness `encounter.locked === true` and `encounter.phase === 'active'`
- During the same step, capture a `bossVisualIdentity` probe with at least:
  - `bossType` — `'miniboss'`
  - `bossEnemyId` matches harness `encounter.bossEnemyId`
  - `nearestAddType` — type of closest live non-boss enemy (grunt/skirmisher)
  - `bossDistinctFromAdds` — `bossType !== nearestAddType` and boss `maxHp` strictly greater than nearest add `maxHp`
  - Optional but preferred: `bossRenderScale` vs `addRenderScale` from a harness-safe renderer hook (e.g. `window.__getEnemyRenderScaleForTest(enemyId)`) showing boss scale > add scale
- `harness/validate/lib/findings.mjs` adds **Boss encounter UI** and **Boss visual identity** sections listing probe values and flagging missing HUD or indistinguishable boss/add types.
- `cd game && pnpm test:quick` passes.
- Do **not** run `pnpm validate:sunken-canyon` or overwrite `game/validation/sunken-canyon/` artifacts in this sub-ticket.

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — add `captureBossEncounterUiProbe(page)` and `captureBossVisualIdentityProbe(page, bossType)`; call from `runBossEncounterStep` after encounter activation, merge into `bossEncounter.probes`.
- **Edit:** `harness/validate/lib/findings.mjs` — render new sections from `run.bossEncounterUi` / `run.bossVisualIdentity` (or nested probe keys).
- **Edit (minimal, if scale hook missing):** `game/client/main.js` and/or `game/client/renderer.js` — expose `window.__getEnemyRenderScaleForTest(id)` returning `{ scale, type }` for harness reads only; mirror in `game/client/test/main.test.js` if added.
- **Reuse:** harness fields `bossEncounter`, `encounter`, `enemyHp` from `__AUTOGAME_HARNESS_STATE__`; DOM ids from `game/client/boss-encounter-hud.js` (`boss-encounter-hud`, `boss-encounter-name`, `boss-encounter-hp-fill`).
- **Scope:** `harness/validate/**` plus optional minimal harness test hooks under `game/client/`; no gameplay balance changes.

## Verification: code
