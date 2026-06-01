# Cleanup nits from 126-key-item-loot-magnet

> **Staleness note.** This follow-up ticket was written against commit
> `f80af31` (2026-06-01). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `126-key-item-loot-magnet`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Loot magnet test name vs behavior

The first test in `loot_magnet.test.js` is titled “moves closer to player” but asserts full snap-and-collect at 6m (expected with instant pull). Wall-blocked test already covers “moves closer without collect.” Renaming or splitting would reduce confusion for future editors.

### Acceptance Criteria
- Test title and comments accurately describe whether the case expects collection or only displacement.
- No change to assertions unless a dedicated open-LOS partial-distance case is added intentionally.

## Optional client feedback on loot magnet use

Other key items get light client feedback (`flashKeyItemIndicator`, heal/shield VFX for medic kit / guard block). Loot magnet only gets the generic success flash via `keyItemUsed`.

### Acceptance Criteria
- On successful `loot_magnet` `keyItemUsed`, show a brief visual hint (e.g. loot shimmer or magnet pulse at player) without new server fields.
- No VFX when `pulled === 0` unless product wants empty-use feedback.
