# Purifying Pulse single-status cleanse probe

Fix the `purifying-pulse-ready` debug scenario and fire cleanse validation so they never seed burn and slow simultaneously. Burn and slow are mutually exclusive in normal play (ticket 301); the cleanse probe must stage a **reachable** single-debuff state.

## Acceptance Criteria

- `purifying-pulse-ready` in `game/server/debugScenarios.js` seeds low HP and **exactly one** negative movement/combat status — burning **or** slowed, not both. Remove the impossible simultaneous `burningUntil` + `slowedUntil` + matching `debuffs` combo.
- The fire preset cleanse probe in `harness/validate/lib/cardMechanics.mjs` records which status was seeded (`seededStatus: 'burn' | 'slow'`) and asserts only that status was active before cast; after `purifying_pulse`, that status is cleared and HP increased.
- `harness/validate/presets/fire.mjs` `cardMechanicsScenarios.cleanse` still points at the updated scenario name (change only if the scenario is split/renamed).
- `game/server/test/purifying_pulse.test.js` expectations match the single-status setup (no longer require both `isSlowed` and `isBurning` true before cast).
- `summary.cardMechanics.probes.cleanse` in a fresh `pnpm validate:fire` run shows at most one of `burningUntil` / `slowedUntil` active in `before`, and `cleanse.ok === true`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/debugScenarios.js` — `purifying-pulse-ready` branch: keep low HP + `purifying_pulse` in hand; set **only** `burningUntil`/`lastBurnTickAt` **or** only `slowedUntil`/`slowFactor` (pick burn-only as the default fire-level probe state); drop the other status fields and conflicting `debuffs` entry.
- **Edit:** `harness/validate/lib/cardMechanics.mjs` — cleanse probe `before` snapshot asserts mutual exclusion (`!(burning && slowed)`); store `seededStatus`; post-cast assertions require the seeded status cleared plus HP gain.
- **Read/edit if renamed:** `harness/validate/presets/fire.mjs` — `cardMechanicsScenarios.cleanse`.
- **Edit:** `game/server/test/purifying_pulse.test.js` — align integration test with single-status scenario.
- **Optional (only if burn-only is insufficient):** add a second debug scenario (e.g. `purifying-pulse-slow-ready`) and a `slowCleanse` key in `cardMechanicsScenarios`; keep each probe single-status. Do not reintroduce dual-status seeding.
- **Regenerate:** `game/validation/fire/findings.md` and `run-summary.json` via `cd game && pnpm validate:fire`.

## Verification: code
