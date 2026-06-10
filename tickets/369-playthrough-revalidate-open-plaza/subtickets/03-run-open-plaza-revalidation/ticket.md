# Run the OPEN-PLAZA new-content re-validation playthrough + write findings

Run the full open-plaza (arena_trials Tier II) playthrough driver now that the new-content pipeline
and arena debug scenarios are wired (sub-tickets 01 + 02), regenerate every artifact under
`game/validation/open-plaza/`, and write a findings.md that lists EVERY bug/glitch/oddity observed
across the basic boss loop AND the new content (boss health-bar/encounter UI 283, distinct boss
visuals 284, slow+burn mutual-exclusivity 301, heal/cleanse 299, wind-up input-lock+telegraph 308,
telepipe vitals persistence 287, card-charge reset on new sortie 289). Do NOT fake green — if an
assertion fails, document the real failure with the relevant screenshot.

## Acceptance Criteria

- Running `cd game && pnpm validate:open-plaza` (the driver invoked from `package.json`) completes
  and writes a fresh `game/validation/open-plaza/run-summary.json` with `steps: "full"`.
- `run-summary.json` contains all 11 assertion keys: `bossSpawned`, `encounterActivated`,
  `bossDefeated`, `victoryFired`, `bossEncounterUiVisible`, `bossDistinctFromAdds`,
  `slowBurnMutuallyExclusive`, `healCleanseApplied`, `windupTelegraphActive`,
  `telepipeVitalsPreserved`, `cardChargesResetOnNewSortie`.
- The stage screenshots exist in `game/validation/open-plaza/`: `01-lobby-browser.png`, `01-hub.png`,
  `02-level-entry.png`, `03-mid-combat.png`, `04-boss-dormant.png`, `05-boss-active.png`,
  `06-boss-defeated.png`, `07-victory.png`, plus the new-content captures
  `08-slow-burn-mutual-exclusive.png`, `09-purifying-pulse.png`, `10-windup-charge.png`,
  `11-telepipe-before.png`, `12-telepipe-after.png`.
- `game/validation/open-plaza/findings.md` is updated (not the stale basic-loop version) and lists
  EVERY bug/glitch/oddity found (visual, functional, timing, new-content interactions), with
  per-assertion PASS/FAIL and the dedicated new-content sections (boss encounter UI, boss visual
  identity, slow/burn, heal/cleanse, wind-up telegraph, telepipe vitals + new-sortie charges) —
  mirroring the structure of `game/validation/sunken-canyon/findings.md`. If everything passes,
  findings.md says so explicitly; if anything fails, findings.md documents the concrete failure and
  names the screenshot evidence (NO faked green).
- `game/validation/open-plaza/console.log` and `probes.json` are refreshed by the run.
- `node harness/validate/verify-open-plaza-artifacts.mjs` exits 0 against the regenerated artifacts.
- Any `game/` change that was strictly required to unblock the run (beyond sub-ticket 01) is recorded
  in a `## Game fixes for harness blockers` section in findings.md, matching the sunken-canyon
  precedent. Prefer zero new game/ changes; document, do not hide, any that were unavoidable.

## Technical Specs

- Run from `game/`: `pnpm validate:open-plaza` (which calls
  `node ../harness/validate/playthrough.mjs --preset open-plaza --steps full --out
  game/validation/open-plaza`). The driver boots the game with `ALLOW_DEV_AUTH=1` and
  `ALLOW_DEBUG_SCENARIOS=1`, god-modes, reaches and defeats the Arena Champion, and captures
  screenshots + probes.
- Generated/updated artifacts (the deliverable diff) live ONLY under
  `game/validation/open-plaza/`: `run-summary.json`, `findings.md`, `console.log`, `probes.json`,
  and `01-*`..`12-*.png`. The findings.md is produced by the driver's findings writer
  (`harness/validate/lib/findings.mjs`); augment/verify its contents rather than hand-faking them.
- If the run exposes a real product bug (e.g. a new-content assertion fails), keep the failing
  artifact, set the failing assertion accordingly, and write the failure up in findings.md — the
  acceptance is "asserts pass OR findings.md documents the real failure with screenshots".
- Do NOT modify the harness driver or game source here except as an unavoidable, documented
  harness-blocker fix (record it in findings.md). Driver wiring belongs to sub-tickets 01/02.

## Verification: code
