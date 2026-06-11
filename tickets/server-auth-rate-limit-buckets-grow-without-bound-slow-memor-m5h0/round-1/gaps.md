1. Rate-limit sweep timer is started then immediately stopped during `startServer()` — expired buckets are never pruned on a running server.
   Files: game/server/index.js
   Fix: Move `startRateLimitSweep()` to after `clearAllTimers()` and `restartBackgroundTimers()` (or call it from `restartBackgroundTimers()`). Remove the current call at line ~1672 that precedes `clearAllTimers()`.
