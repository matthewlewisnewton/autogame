1. Player airborne support is not end-to-end reusable for the future fly/hover card promised by the ticket.
   Files: game/server/progression.js, game/client/renderer.js, game/client/test/airborne-floor-render.test.js, game/server/test/airborne.test.js
   Fix: expose player `flying`/`altitude` in snapshots, render local and remote flying players from the same floor-aware airborne helper, add player ground shadows, and test a flagged player stays/render airborne instead of floor-snapping.
