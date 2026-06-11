# Re-run open-plaza validation and report the console/resource oddities in findings.md

The committed open-plaza validation omits real console/resource oddities: `console.log` contains
`[models] failed to load model "/models/arena-champion.glb"` and repeated `502 (Bad Gateway)`
resource errors, yet `findings.md` claims "None observed" / "No visual glitches recorded." The ticket
requires EVERY bug/glitch/oddity to be listed. Re-run the driver against the current live code and
make `findings.md` honestly report any remaining console/resource oddities (do NOT fake green).

## Acceptance Criteria

- `cd game && pnpm validate:open-plaza` is re-run and regenerates the artifacts under
  `game/validation/open-plaza/` (`run-summary.json`, `console.log`, `probes.json`, screenshots) so
  `console.log` reflects the CURRENT live code rather than the stale prior capture.
- `game/validation/open-plaza/findings.md` accurately reflects the regenerated `console.log`:
  - If the `arena-champion.glb` load warning and/or `502 (Bad Gateway)` resource errors STILL appear
    in the fresh `console.log`, findings.md lists each one under a console/resource-errors section
    (no more "None observed" when the log shows entries).
  - If they no longer appear (e.g. the live `game/client/models.js` already maps `arena_champion` to
    procedural-only so no `.glb` fetch happens, and the 502s were proxy noise that is gone), findings.md
    states that explicitly and the new `console.log` is clean of those entries.
- `findings.md` and `console.log` are mutually consistent: there is no oddity present in the fresh
  `console.log` that findings.md fails to mention.
- The boss model path is correct: confirm `game/client/models.js` does not request
  `/models/arena-champion.glb` for the `arena_champion` enemy in the current live code (it should be
  procedural / `null`). If it still requests a missing `.glb`, fix the mapping so the arena champion
  renders procedurally without a failed network fetch, and note the fix in findings.md.
- All 11 assertion keys remain present in `run-summary.json` with `steps: "full"`, and
  `node harness/validate/verify-open-plaza-artifacts.mjs` exits 0 against the regenerated artifacts.

## Technical Specs

- Run from `game/`: `pnpm validate:open-plaza` (calls
  `node ../harness/validate/playthrough.mjs --preset open-plaza --steps full --out
  game/validation/open-plaza`, booting with `ALLOW_DEV_AUTH=1` + `ALLOW_DEBUG_SCENARIOS=1`).
- Deliverable diff lives under `game/validation/open-plaza/`: `run-summary.json`, `findings.md`,
  `console.log`, `probes.json`, screenshots. The findings.md console/resource section should be
  emitted/augmented via the driver's findings writer (`harness/validate/lib/findings.mjs`) where
  possible rather than hand-faked.
- `game/client/models.js`: only touch this if the live code still maps `arena_champion` to a missing
  `/models/arena-champion.glb`; the correct behaviour is procedural-only (`null`) so no failed model
  fetch is logged. Any such change must be recorded in findings.md under
  `## Game fixes for harness blockers`.
- Do NOT weaken or skip the new-content assertions to chase a clean log; document, do not hide,
  anything that the fresh run surfaces.

## Verification: code
