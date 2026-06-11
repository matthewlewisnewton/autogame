## design.md still says runSpawnSeed is future work

The **Layout & spawn determinism** section in `game/docs/design.md` was written in sub-ticket 01 before implementation landed. It still says `runSpawnSeed` is "to be introduced in sub-ticket 02" and that implementation lives in "follow-up sub-tickets," which is now inaccurate and may confuse future agents.

### Acceptance Criteria

- Update the seed-split bullets to describe `runSpawnSeed` as shipped (minted on fresh deploy via `generateRunSpawnSeed()` in `progression.js`, consumed by `collect_items.spawnQuestEntities`).
- Remove or rephrase "to be introduced" / "follow-up sub-tickets" wording so the doc matches the live codebase.
