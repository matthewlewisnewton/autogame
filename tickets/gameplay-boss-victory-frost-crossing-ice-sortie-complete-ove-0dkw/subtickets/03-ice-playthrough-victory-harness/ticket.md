# Harness: ice preset full playthrough reaches Sortie Complete overlay

Confirm the end-to-end ice / frost_crossing validation driver passes the victory step and captures the Sortie Complete screenshot after sub-tickets 01–02 land.

## Acceptance Criteria

- From `game/`, `node ../harness/validate/playthrough.mjs --preset ice --steps full --out <dir>` completes without `waitForSortieCompleteOverlay` timing out.
- Output includes `09-boss-defeated.png` **and** `10-victory.png`; `10-victory.png` shows `#run-summary-overlay` visible with `#summary-status` = `Sortie Complete` (not byte-identical to `09-boss-defeated.png`).
- `run-summary.json` reports `assertions.victoryFired: true` and victory probes with `lastRunSummaryStatus: "victory"`.
- Harness probe at victory capture reports `sortieCompleteOverlayVisible: true`.
- `pnpm test:quick` (server + client) passes.

## Technical Specs

- **Primary verification command:** `node ../harness/validate/playthrough.mjs --preset ice --steps full --out game/validation/ice` (or a temp dir under `harness/tmp/`).
- **Reference preset:** `harness/validate/presets/ice.mjs` (`bossLowHpScenario: frost-crossing-boss-low-hp`, `victoryScreenshot: 10-victory`).
- **Reference driver:** `harness/validate/playthrough.mjs` — `waitForSortieCompleteOverlay`, `runVictoryStep`.
- **Only if still failing after 01–02:** adjust harness timing in `playthrough.mjs` or frost debug scenarios — keep changes minimal and frost-scoped.

## Verification: code
