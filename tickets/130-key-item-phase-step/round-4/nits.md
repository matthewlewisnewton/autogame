## Refresh Key Item Registry Comment

`game/server/progression.js` still says only `dodge_roll` and `summon_recall` are implemented even though the key-item registry and handler now include several implemented items, including `phase_step`. Updating the comment would reduce confusion during future key-item work.

### Acceptance Criteria

- The comment above `KEY_ITEM_DEFS` accurately describes the registry without stale implemented-item status.
