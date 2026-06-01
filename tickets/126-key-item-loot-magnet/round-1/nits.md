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
