1. Drift guard incorrectly allowlists `heartbeat` and `heartbeat_ack` as lifecycle events, so raw socket call sites for those game events can pass instead of being forced through `EVENTS.*`.
   Files: `game/server/test/event_name_drift.test.js`, `game/shared/events.json`
   Fix: remove `heartbeat` and `heartbeat_ack` from `LIFECYCLE_ALLOWLIST`; keep only true Socket.IO/process lifecycle names and confirm the drift test still passes with current production call sites using `EVENTS.heartbeat` and `EVENTS.heartbeat_ack`.
