## Emit Thermal Column DoT Interval In The Card Event

The Thermal Column renderer currently falls back to the known 500 ms DoT interval, which matches the current shared card stats. Emitting `dotIntervalMs` alongside `dotTicks` in the server `CARD_USED` payload would remove the duplicated timing assumption and keep future balance changes automatically synced.

### Acceptance Criteria
- `inferno_pillar` `CARD_USED` events include `dotIntervalMs` from the server card definition.
- The client renderer test covers a non-default `dotIntervalMs` value and verifies scheduled pulse timing follows the event payload.
