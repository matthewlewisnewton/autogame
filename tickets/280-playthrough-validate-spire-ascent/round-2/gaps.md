1. Latest round-2 capture does not load cleanly: `metrics.json` is `ok:false` / `capture_failed`, `server.log` shows `SIGTERM received`, and Vite then reports `ECONNREFUSED 127.0.0.1:3004`.
   Files: `harness/steps/capture_run.py`, `harness/steps/game.py`, `game/server/index.js`
   Fix: keep the game server alive for the full capture, then rerun the round-2 capture until `metrics.json` is `ok:true` and round screenshots are present.

2. Spire Ascent findings report the wrong boss type: `findings.md` says `bossSpawned (annex_overseer)` even though this ticket must confirm Summit Warden / `spire_warden`.
   Files: `harness/validate/lib/findings.mjs`, `harness/validate/playthrough.mjs`, `game/validation/spire-ascent/findings.md`
   Fix: pass the preset boss type/display name into `renderFindings`, regenerate `game/validation/spire-ascent/`, and verify findings name `spire_warden` or Summit Warden.
