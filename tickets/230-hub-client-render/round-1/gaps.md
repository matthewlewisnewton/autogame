1. The hub scene and local avatar are hidden behind the full-screen opaque lobby overlay, so they are not visible during `gamePhase === 'lobby'`.
   Files: `game/client/style.css`, `game/client/main.js`, `game/client/index.html`
   Fix: make the normal lobby UI reveal the rendered hub canvas while preserving lobby controls, then add a browser/visual check proving the hub avatar is visible in lobby.
