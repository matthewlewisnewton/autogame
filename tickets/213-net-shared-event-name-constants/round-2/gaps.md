1. The captured game run did not load cleanly: `metrics.json` has `"ok": false`, `failure_kind: "capture_failed"`, and `console.log` reports `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/`.
   Files: none - the browser capture failed before producing runnable proof from `game/`.
   Fix: re-run the capture and ensure the Vite client remains reachable through page load; the ticket cannot pass until `metrics.json` is ok and screenshots/probes are captured.
