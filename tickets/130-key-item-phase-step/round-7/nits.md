## Share Phase Step Range With The Client Highlight

`game/client/renderer.js` hard-codes `PHASE_STEP_RANGE = 6` to match `KEY_ITEM_DEFS.phase_step.range`. The server remains authoritative, so this is not a gameplay blocker, but future balance tuning could make the highlight disagree with the actual usable range.

### Acceptance Criteria
- Phase Step ally highlighting reads its range from key-item definition data or another shared source instead of a duplicated client constant.
