# Run the full spire-ascent re-validation and author findings.md

Run the extended spire-ascent playthrough driver end-to-end to regenerate all
artifacts in `game/validation/spire-ascent/`, tighten the artifact verifier to
require the new-content probes, and write `findings.md` listing EVERY bug, glitch,
oddity, or timing issue observed across the new-content probes (283/284/301/299/
308/287/289). Asserts pass OR findings.md documents the real failure with the
relevant screenshot — do NOT fake green.

## Acceptance Criteria

- `pnpm validate:spire-ascent` (steps `full`) is run and regenerates, in
  `game/validation/spire-ascent/`: the base screenshots (`01`–`07`), the new
  probe screenshots (`05a`–`05c`, `08`, `09`), `probes.json`, `console.log`, and
  `run-summary.json` with the base assertions plus the new probe sections
  (`bossUi`, `bossVisuals`, `statusCards`, `healCleanse`, `windUp`,
  `telepipePersistence`, `cardChargeReset`).
- `findings.md` documents the outcome of EACH new-content feature exercised:
  boss health-bar/encounter UI (283), distinct boss visuals (284), slow+burn
  mutual exclusivity (301), heal/cleanse (299), wind-up input-lock + telegraph
  (308), telepipe vitals persistence (287), card-charge reset on new sortie
  (289). For each: PASS with the observed probe value, or a concrete description
  of the bug/glitch/oddity (visual, functional, timing, or new-content
  interaction) with the screenshot filename. The `bossSpawned` line must
  reference `spire_warden` / Summit Warden (not another level's boss).
- `findings.md` records actual probe values (real numbers/flags from
  `run-summary.json`), not a hand-asserted "green" — if the driver run failed or
  a probe assertion tripped, that failure is documented honestly with the
  screenshot, and the run is NOT reported as PASS.
- `harness/validate/verify-spire-ascent-artifacts.mjs` passes and is extended to
  require the new probe screenshots and the new `run-summary.json` probe-section
  keys, so a future run without the new-content probes fails verification.
- `pnpm test:quick` (vitest server+client) passes, or any failure is a
  pre-existing/unrelated one documented in findings.md.

## Technical Specs

- Run `pnpm validate:spire-ascent` then `pnpm validate:spire-ascent:check` from
  `game/` (driver: `harness/validate/playthrough.mjs --preset spire-ascent
  --steps full --out game/validation/spire-ascent`).
- `game/validation/spire-ascent/findings.md` — author per the criteria above;
  follow the structure of the existing `findings.md` and the sunken-canyon
  sibling (`game/validation/sunken-canyon/findings.md`): Outcome, Assertions,
  per-feature new-content results, Console/page errors, Screenshots, Follow-ups.
- `game/validation/spire-ascent/` — committed regenerated artifacts (screenshots,
  `probes.json`, `console.log`, `run-summary.json`).
- `harness/validate/verify-spire-ascent-artifacts.mjs` — add the new required
  PNGs (`05a`/`05b`/`05c`/`08`/`09`) and assert `run-summary.json` contains the
  new probe-section keys.

## Verification: code
