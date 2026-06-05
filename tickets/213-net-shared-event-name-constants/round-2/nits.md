## Clarify Heartbeat Event Allowlisting

`event_name_drift.test.js` includes `heartbeat` and `heartbeat_ack` in the lifecycle allowlist even though both are also registry entries used through `EVENTS.*`. This is non-blocking because the current production call sites use the shared constants, but tightening or documenting the distinction would make the drift guard easier to reason about.

### Acceptance Criteria
- Either remove `heartbeat` and `heartbeat_ack` from the raw-literal allowlist, or add a short comment explaining why raw heartbeat literals should remain allowed despite being registry entries.
