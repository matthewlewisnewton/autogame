You are planning a headless browser capture for the autogame harness.

Base URL:
__BASE_URL__

Ticket file:
__TICKET_FILE__

Ticket contents:
__TICKET__

Return STRICT JSON only. Do not use Markdown.

The harness will validate and execute only these actions:
- connectPlayer: open a browser page for player "A", "B", etc. Optional fields:
  - player: one capital letter, default "A"
  - scenario: optional development debug scenario name
  - urlPath: optional local path beginning with "/"
- readyAll: click the ready button on every connected player.
- waitForGame: wait until gameplay is visible. Optional player, timeoutMs.
- move: hold one WASD key. Required-ish fields: player, key, durationMs.
- pressCard: press key 1-4 for a card slot. Fields: player, slot, cardType (optional — card type name to resolve slot dynamically), ms.
- clickSlot: click a card slot. Fields: player, slot, ms.
- wait: bounded wait. Fields: player, ms.
- screenshot: save a screenshot. Fields: player, name, description.
- probe: collect DOM/game-state metrics. Fields: player, description.

Available development scenarios:
- summon-low-mana: start in gameplay with the local player at 0 Magic Stones (full HP).
- summon-ready: start in gameplay with full Magic Stones, a summon card in hand, and nearby enemies.
- combat-damaged-player: start in gameplay with the local player at low HP (25) and full Magic Stones.
- mixed-enemies: start in gameplay with one of each enemy type (grunt, skirmisher, miniboss, spawner) spawned near the player.
- spawner-active: start in gameplay with a spawner enemy ready to spawn its first add on the next tick.
- monster-card: start in gameplay with full Magic Stones and a monster card (Dungeon Drake) guaranteed in hand.
- sloped-dungeon: regenerate the dungeon layout with slopes enabled for visual verification of ramp geometry.

Use a debug scenario only when the ticket needs a hard-to-reach state. Prefer
the normal lobby-to-game flow for tickets about onboarding, lobby readiness,
multiplayer setup, or integration between screens.

Constraints:
- Use at most 12 steps.
- Always include at least one screenshot and one probe.
- Prefer stable names like "01-lobby", "02-gameplay", "03-after-card".
- Do not attempt arbitrary JavaScript, shell commands, URLs outside the app, or
  unsupported actions.

Schema:
{
  "summary": "short description of what this capture verifies",
  "steps": [
    { "action": "connectPlayer", "player": "A" },
    { "action": "screenshot", "player": "A", "name": "01-example", "description": "what QA should look for" }
  ]
}
