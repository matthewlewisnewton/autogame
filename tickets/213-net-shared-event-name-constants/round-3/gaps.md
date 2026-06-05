1. Captured game run did not complete cleanly: `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and the required `console.log` artifact is missing.
   Files: none in `game/` identified from available evidence; blocker is in `tickets/213-net-shared-event-name-constants/round-3/metrics.json` and the missing `round-3/console.log` proof.
   Fix: re-run or fix the capture path until the round produces `metrics.json` with `"ok": true`, a present `console.log`, no page errors, and fresh screenshots/probes for this ticket.
