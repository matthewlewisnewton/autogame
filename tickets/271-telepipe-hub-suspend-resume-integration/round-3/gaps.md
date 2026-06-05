1. Suspended runs resume through the same lobby launch button instead of a distinct hub portal/booth or separate resume entry point.
   Files: game/client/index.html, game/client/main.js, game/client/style.css
   Fix: Show and wire a dedicated resume affordance while `gamePhase === "lobby"` with `suspendedRunSummary` (or an in-world hub portal/booth), keep the new-mission Deploy launch hidden/disabled for fresh starts during suspension, and route the dedicated resume control through the existing `playerReady(true)`/checkpoint restore path.
