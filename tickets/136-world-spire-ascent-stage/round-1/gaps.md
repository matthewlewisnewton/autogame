1. Captured game run did not load: `metrics.json` has `"ok": false` / `capture_failed`, and `console.log` shows `502` for `/api/register` and `/api/login`.
   Files: `game/client/vite.config.js`, `game/server/index.js`
   Fix: Make the Vite proxy target the actual backend port used by the harness (server listened on `3001` in this capture), then rerun capture until `metrics.json` is healthy.

2. Elevated spire tiers are not rendered at their server-side heights because uniform room floors always use `FLOOR_Y`.
   Files: `game/client/dungeon.js`
   Fix: Render uniform elevated room floors and treasure markers at the room's `floorCorners`/sampled height using the same elevation convention as sloped floors; add a client test for an elevated flat tier.

3. The final tier is not a required objective or exit; `spire_ascent` is `defeat_enemies`, enemies spawn only on lower combat tiers, and the top-tier marker is visual-only.
   Files: `game/server/quests.js`, `game/server/progression.js`, `game/server/dungeon.js`, `game/client/dungeon.js`
   Fix: Put an actual required objective/exit on the final tier and gate run completion on reaching/completing it while preserving enemy distribution along the climb.
