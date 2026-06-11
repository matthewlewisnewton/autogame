# Cleanup nits from decision-per-quest-layouts-are-fully-deterministic-every-run-xnu8

> **Staleness note.** This follow-up ticket was written against commit
> `9a9ab826` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `decision-per-quest-layouts-are-fully-deterministic-every-run-xnu8`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## design.md still says runSpawnSeed is future work

The **Layout & spawn determinism** section in `game/docs/design.md` was written in sub-ticket 01 before implementation landed. It still says `runSpawnSeed` is "to be introduced in sub-ticket 02" and that implementation lives in "follow-up sub-tickets," which is now inaccurate and may confuse future agents.

### Acceptance Criteria

- Update the seed-split bullets to describe `runSpawnSeed` as shipped (minted on fresh deploy via `generateRunSpawnSeed()` in `progression.js`, consumed by `collect_items.spawnQuestEntities`).
- Remove or rephrase "to be introduced" / "follow-up sub-tickets" wording so the doc matches the live codebase.
