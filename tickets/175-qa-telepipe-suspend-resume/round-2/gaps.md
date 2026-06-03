1. Round-2 capture does not verify preserved enemy state: metrics show 5 enemies before suspend but 7 after resume while the objective remains 0/5.
   Files: harness/screenshot.mjs, game/client/scripts/test-telepipe-suspend-resume.mjs, game/server/progression.js
   Fix: make the capture/smoke compare enemy IDs/count/HP at the actual suspend checkpoint against the resumed state and fail on mismatch; if the mismatch reproduces in game code, fix checkpoint/restore so resumed enemies and objective progress match the suspended run.
