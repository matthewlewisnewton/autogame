# Senior review — 286-playthrough-driver-output-quality-findings-victory-path

## Runtime health (gate)

The captured run is clean:

- `metrics.json`: `ok: true`, no `failure_kind`, no `harness_failure`, `pageerrors: []`.
- `pageerrors.json`: `[]`.
- `console.log`: only benign noise — Vite connect, two `409 Conflict` resource
  loads (pre-existing persistence noise), `initScene`, `launchBooth ready-up`,
  and `[debugScenario] applied sunken-canyon-stage` (the harness's own QA
  capture scenario). No `pageerror`/`[fatal]` lines.
- `client.log`: only `THREE.Clock` deprecation warnings and `ws proxy` EPIPE on
  socket close — all explicitly benign.

Game starts and loads cleanly. Gate passes.

## Per-criterion findings

### AC1 — findings.md parameterized per level

PASS. `harness/validate/lib/findings.mjs` dropped the hard-coded
`PRESET_FINDINGS` map and now derives the title from `run.findingsTitle` (or a
title-cased preset name) and the boss label from `run.bossSpawnLabel ||
run.bossType`. `presets/open-plaza.mjs` now supplies
`findingsTitle: 'Open Plaza validation findings'` and
`bossSpawnLabel: 'arena_champion (Arena Champion)'`, and `playthrough.mjs`
threads `bossType` into the findings render. The regenerated
`game/validation/open-plaza/findings.md` is correctly headed
`# Open Plaza validation findings` and asserts
`bossSpawned (arena_champion (Arena Champion))` — the original rooms/annex_overseer
copy-paste bug is gone. Covered by new `server/test/findings-render.test.js`.

### AC2 — genuinely distinct victory screenshot

PASS. `06-boss-defeated.png` (md5 `dc92be05…`) and `07-victory.png`
(md5 `79a2c3f7…`) are now byte-distinct (originally byte-identical). The driver
adds `waitForSortieCompleteOverlay()`, which blocks on the run-summary overlay
being visible with `summary-status` text equal to the theme's `sortieComplete`
label before capturing `07-victory`. `main.js` reorders `showRunSummary` so the
overlay is displayed first and exposes a `sortieCompleteOverlayVisible` harness
probe. A reusable `assertDistinctVictoryScreenshots` md5 guard was added to all
three preset verifiers (open-plaza/rooms/sunken-canyon), so this regression
can't silently return. Both screenshots render the "Sortie Complete" overlay
cleanly (verified visually). See nit re: the boss-defeated frame.

### AC3 — standardized artifact location

PASS. `playthrough.mjs` now defaults `--out` to `game/validation/<preset>/`
when omitted (explicit `--out` still overrides). The repo-root
`validation/open-plaza/` tree is deleted (the diff removes all of its PNGs,
findings.md, probes.json, run-summary.json, console.log), and the regenerated
artifacts live under `game/validation/open-plaza/`. A dedicated
`verify-open-plaza-artifacts.mjs` enforces `steps: "full"`, the four assertion
keys, the required files, and distinct victory PNGs — it exits 0 on the current
artifacts.

### Debug scenarios (section 4 check)

The ticket added three arena_trials scenarios
(`arena-trials-near-adds`, `arena-trials-boss-approach`,
`arena-trials-boss-low-hp`) needed because the open-plaza preset previously had
no shortcuts. Reviewed against the debug-scenario rules:

- **Gated behind debug path** — registered in `DEBUG_SCENARIOS` /
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN`; reachable only via the scenario
  request path, and each guards on `gamePhase === 'playing'`,
  `selectedQuestId === 'arena_trials'`, `selectedQuestTier === 2`, and a live
  `run.encounter`. Normal gameplay does not touch them.
- **Normal path still reaches the same end-state** — the scenarios only
  reposition / weaken *live* run entities; victory still fires through real
  combat (`defeatBoss` lands the killing blow, server validates, encounter
  activate/lock go through the normal helpers). The end state is reachable by
  actually clearing adds and fighting the boss. Mirrors the existing
  training-caverns / canyon-descent scenario patterns.
- **No invariant short-circuit** — no server validation, persistence, or
  replication is skipped; the boss-low-hp scenario sets HP to 1 but the kill,
  victory detection and run-summary still run normally.
  Covered by new `server/test/debug-scenarios.test.js`.

## Validation

- `vitest run server/` — 98 files, 1668 tests passed.
- `findings-render` + `debug-scenarios` + client `main.test.js` — 186 passed.
- `node harness/validate/verify-open-plaza-artifacts.mjs` — exit 0.
- Visual: `06`/`07` PNGs both show a clean Sortie Complete overlay.

## Remaining gaps

None blocking. All three acceptance criteria are fully and robustly met, the
new debug scenarios are correctly gated and tested, and the captured run is
healthy. One non-blocking nit recorded in `nits.md` (06-boss-defeated frame
now shows the summary overlay rather than a mid-combat defeat frame for the
instakill boss-low-hp path).

VERDICT: PASS
