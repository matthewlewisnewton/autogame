# Capture a distinct victory screenshot after Sortie Complete

The playthrough driver currently snapshots `07-victory.png` as soon as harness victory state is true — the same frame as `06-boss-defeated.png` when the Sortie Complete overlay has not yet painted. Wait for the visible run-summary UI before the victory capture, and add a verifier guard so duplicate PNGs fail fast.

## Acceptance Criteria

- `runVictoryStep` in `harness/validate/playthrough.mjs` captures `06-boss-defeated.png` immediately after `defeatBoss` (unchanged timing).
- Before writing `07-victory.png`, the driver waits for the Sortie Complete overlay: `#run-summary-overlay` is visible (`display` not `none`) and `#summary-status` text equals `Sortie Complete` (from `game/shared/theme.json` / client `showRunSummary`).
- Harness victory assertions (`waitForVictoryState`, `buildAssertions`, `victoryFired`) remain satisfied; only the screenshot timing changes.
- `harness/validate/verify-rooms-artifacts.mjs`, `verify-sunken-canyon-artifacts.mjs`, and the new open-plaza verifier (sub-ticket 03) reject artifacts when `06-boss-defeated.png` and `07-victory.png` are byte-identical (compare md5 or file buffers).
- Existing committed `game/validation/rooms/` and `game/validation/sunken-canyon/` trees still pass `:check` scripts (their PNGs are already distinct).
- `cd game && pnpm test:quick` still passes.

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — add `waitForSortieCompleteOverlay(page, { timeoutMs })` (Playwright `page.waitForFunction` checking `#run-summary-overlay` + `#summary-status`); call it after `waitForVictoryState` and before `writeScreenshot(..., '07-victory')`.
- **Edit:** `harness/validate/verify-rooms-artifacts.mjs` and `verify-sunken-canyon-artifacts.mjs` — shared helper or inline check that both PNGs exist and `md5(06) !== md5(07)`; emit a clear stderr message on duplicate.
- **Reference DOM:** `game/client/index.html` (`#run-summary-overlay`, `#summary-status`); overlay shown in `game/client/main.js` `showRunSummary`.
- **Scope:** `harness/validate/**` only. Do not re-run playthroughs or mutate `game/validation/**` PNGs here.

## Verification: code
