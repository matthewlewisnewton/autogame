1. A dropped socket after a successful initial `connect` still has no bounded reconnect failure path.
   Files: `game/client/main.js`, `game/client/test/main.test.js`
   Fix: Start/reset a reconnect watchdog on `disconnect`, `reconnect_attempt`, or repeated non-auth `connect_error`; clear it on `connect`/`reconnect`; add a test that a post-connect reconnect stall surfaces the persistent reload/retry error.
