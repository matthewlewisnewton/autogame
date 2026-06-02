## Align Purge Charm Description With Behavior

The `purge_charm` key item description still says "Remove all negative effects", but the ticketed and implemented behavior removes only the oldest active debuff or grants a one-hit shield when there are none. Updating the player-facing description will prevent confusion when multiple debuffs are present.

### Acceptance Criteria
- `purge_charm` description text clearly says it removes one debuff, or grants a one-hit shield if no debuff is present.
- Any key item UI using the description reflects the corrected behavior without changing the server mechanic.
