## Tighten Drift Guard Allowlist

`game/server/test/event_name_drift.test.js` currently allowlists `heartbeat` and `heartbeat_ack` as lifecycle literals even though both are present in `game/shared/events.json`. Current production code still uses `EVENTS.heartbeat` and `EVENTS.heartbeat_ack`, so this does not block the ticket, but tightening the allowlist would make the guard stricter against future drift.

### Acceptance Criteria
- The drift guard fails if any registry-owned event name, including `heartbeat` or `heartbeat_ack`, is reintroduced as a raw production socket event literal.
