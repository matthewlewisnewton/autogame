1. Persistent socket retry loops can keep resetting the watchdog before it fires, leaving only transient retry/reconnecting status instead of the required reload/retry failure state.
   Files: game/client/main.js, game/client/test/main.test.js
   Fix: preserve an absolute timeout window for each connect/reconnect failure episode, or only start the watchdog if no timer is active; add a test that emits repeated non-auth connect_error/reconnect_attempt events faster than CONNECT_WATCHDOG_MS and still expects the persistent error after the original window.
