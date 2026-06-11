# Open Plaza validation findings

**Outcome:** PASS
**Preset:** open-plaza


## Assertions

- **bossSpawned (arena_champion (Arena Champion))**: PASS
- **encounterActivated**: PASS
- **bossDefeated**: PASS
- **victoryFired**: PASS

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Floor alignment

- **Level entry**: playerY=0.5, floorY=0.5, delta=0.000, profile=open-plaza, band=(none)
- **Mid combat**: playerY=1.6, floorY=1.6, delta=0.000, profile=open-plaza, band=(none)
- **Boss dormant**: playerY=1.6, floorY=1.6, delta=0.000, profile=open-plaza, band=(none)
- **Boss active**: playerY=0.5, floorY=0.5, delta=0.000, profile=open-plaza, band=(none)

## Boss encounter UI

- **hudVisible**: yes
- **bossName**: Trial Warden
- **hpFillWidthPct**: 100
- **encounterLocked / phase**: locked / active

## Boss visual identity

- **bossType**: arena_champion
- **bossEnemyId**: 69e809ce-6778-41cd-911b-81d108347dd5
- **nearestAddType**: grunt
- **bossDistinctFromAdds**: yes
- **bossRenderScale / addRenderScale**: 3 / 1.025014694678903

## Slow / burn mutual exclusivity

- **targetEnemyId**: 67141058-da65-479d-97c4-8b5a0583eabb
- **afterSlow**: slowActive=yes, burnActive=no
- **afterBurn**: slowActive=no, burnActive=yes
- **slowBurnMutuallyExclusive**: yes

## Heal / cleanse (Purifying Pulse)

- **preCast hp**: 40
- **postCast hp**: 60
- **preCast debuffs**: slow=no, burn=yes
- **postCast debuffs**: slow=no, burn=no
- **healCleanseApplied**: yes

## Wind-up telegraph

- **cardId**: magma_greatsword
- **cardUseState**: windup
- **cardWindupCardId**: magma_greatsword
- **inputLocked**: yes
- **telegraphVisible**: yes
- **windupTelegraphActive**: yes

## Telepipe vitals and new-sortie charges

- **preSuspend**: hp=100, magicStones=20, runId=d27b86b0-ec0b-4fc9-a933-683137456524
- **postDeploy**: hp=100, magicStones=20, runId=ce8f036e-3574-470a-9d74-ca34b3d29f72
- **telepipeVitalsPreserved**: yes
- **cardChargesResetOnNewSortie**: yes

## New content exercise

- `08-slow-burn-mutual-exclusive.png` — see Screenshots list (`game/validation/open-plaza/08-slow-burn-mutual-exclusive.png`)
- `09-purifying-pulse.png` — see Screenshots list (`game/validation/open-plaza/09-purifying-pulse.png`)
- `10-windup-charge.png` — see Screenshots list (`game/validation/open-plaza/10-windup-charge.png`)
- `11-telepipe-before.png` — see Screenshots list (`game/validation/open-plaza/11-telepipe-before.png`)
- `12-telepipe-after.png` — see Screenshots list (`game/validation/open-plaza/12-telepipe-after.png`)

## Screenshots

- `game/validation/open-plaza/01-lobby-browser.png`
- `game/validation/open-plaza/01-hub.png`
- `game/validation/open-plaza/02-level-entry.png`
- `game/validation/open-plaza/03-mid-combat.png`
- `game/validation/open-plaza/04-boss-dormant.png`
- `game/validation/open-plaza/05-boss-active.png`
- `game/validation/open-plaza/06-boss-defeated.png`
- `game/validation/open-plaza/07-victory.png`
- `game/validation/open-plaza/08-slow-burn-mutual-exclusive.png`
- `game/validation/open-plaza/09-purifying-pulse.png`
- `game/validation/open-plaza/10-windup-charge.png`
- `game/validation/open-plaza/11-telepipe-before.png`
- `game/validation/open-plaza/12-telepipe-after.png`

## Game fixes for harness blockers

Changes required to make `pnpm validate:open-plaza --steps full` reach a green 11-assertion
run (ticket exception for writable-output / documented harness-blocker scope). The full
new-content pipeline had never actually been executed against the open-plaza preset before
this run, so these blockers only surfaced now.

### `game/` (arena debug scenarios)

- **`arena-trials-telepipe-ready`** (`debugScenarios.js`): now seeds the already-depleted
  pre-suspend state directly (magic stones `20` < `STARTING_MAGIC_STONES` 49, a partially-spent
  `ice_ball`, a full-charge Telepipe, plus the existing `_msRegenGraceUntil` grace), instead of
  relying on the harness to deplete by casting. On the single-room open plaza the boss sits at the
  centre dais, so the driver's god-moded depletion attacks reached and killed it — ending the run
  in victory before any mana was spent. Seeding the depleted state is not a green-fake: the
  telepipe assertions still genuinely verify that suspend → abandon → fresh redeploy **preserves**
  the depleted vitals (287) and **resets** card charges on the new sortie (289).
- **`setupArenaTrialsTier2StageBossDebug`** (`debugScenarios.js`): preserves the player's current
  HP / magic stones on deploy (defaulting to MAX only when unset), mirroring
  `canyon-descent-tier-2`. The previous unconditional MAX reset wiped the depleted mana on the
  telepipe new-sortie redeploy, failing the vitals-preservation check.
- **`arena-trials-near-adds`** (`debugScenarios.js`): clusters the adds (and the player) in the
  room corner farthest from the boss. Open-plaza is one room with the boss near its centre, so
  clustering at the room centre left the player inside `ENCOUNTER_TRIGGER_RADIUS` when the last add
  died and auto-activated the encounter before the approach step (`Expected dormant encounter, got
  active`).

(`arena-trials-encounter-trigger` and the other arena scenarios from sub-ticket 01 were already
correct — the trigger scenario already spawns the visual add the `bossDistinctFromAdds` probe
needs; it simply was not being invoked for this preset. See harness wiring below.)

### Console / resource oddities (sub-ticket 05)

The `## Console / page errors` section above ("None observed") is now accurate against the
freshly regenerated `console.log` — it contains only `[console:debug]`/`[console:log]` lines, with
no `[console:error]`, `[console:warning]`, or `[pageerror]` entries. The two oddities the prior
capture surfaced are gone, for concrete reasons rather than by hiding them:

- **`[models] failed to load model "/models/arena-champion.glb"`** no longer occurs. The live
  `game/client/models.js` already maps `arena_champion: null` (procedural-only), so
  `modelPathFor('arena_champion')` returns `null` and `loadModel(null)` resolves without any
  network fetch — there is no `.glb` to 404/HTML-fallback into a GLTFLoader parse warning. No code
  change to `models.js` was needed; the prior warning was emitted by an earlier run captured before
  that mapping landed.
- **Repeated `Failed to load resource: 502 (Bad Gateway)`** no longer occurs. These were transient
  Vite dev-proxy noise from a run whose game server had not finished booting when the page issued
  its first requests; with the server up before the page loads, the fresh run logs zero 502s.

Root cause of the stale/inconsistent capture: `console.log`
(`harness/validate/lib/consoleLog.mjs` → `appendFileSync`) and `server.log`
(`harness/validate/lib/gameProcess.mjs` → `createWriteStream({ flags: 'a' })`) are both opened in
**append** mode and were never truncated between runs, so they accumulated entries from older,
pre-fix runs while `findings.md` was regenerated each run from only the current run's console
entries — hence "None observed" alongside a `console.log` still showing old warnings/502s. Fix
(in `game/`): **`game/scripts/reset-open-plaza-validation.mjs`** removes these two append-only logs
before the playthrough, wired as the first step of `validate:open-plaza` in `game/package.json`.
Every run now writes a `console.log` that reflects only that run, keeping it consistent with
`findings.md`.

### Harness-side wiring (outside `game/`, documented per ticket)

- **`harness/validate/lib/cardExercise.mjs`**: the slow/burn, heal-cleanse and wind-up card
  exercises hard-required `layout.profile === 'sunken-canyon'`, so they could never start on
  open-plaza. Generalized to a shared `waitForPlayingOnProfile(page, layoutProfile)` helper driven
  by `preset.layoutProfile` (sunken-canyon keeps its strict guard).
- **`harness/validate/playthrough.mjs`**: threads `preset.layoutProfile` into the card exercises,
  and generalizes the encounter-activation branch to use `preset.encounterTriggerScenario` (the
  scenario that activates the boss AND leaves a live add for `bossDistinctFromAdds`) instead of a
  hard-coded canyon-only special case.
- **`harness/validate/presets/open-plaza.mjs`**: adds
  `encounterTriggerScenario: 'arena-trials-encounter-trigger'`.

## Follow-ups

None — green run.
