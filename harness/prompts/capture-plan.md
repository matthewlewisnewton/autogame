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
- pressCard: press key 1-4 for a card slot. Fields: player, slot, ms.
- clickSlot: click a card slot. Fields: player, slot, ms.
- wait: bounded wait. Fields: player, ms.
- screenshot: save a screenshot. Fields: player, name, description.
- probe: collect DOM/game-state metrics. Fields: player, description.

Available development scenarios:
- summon-low-mana: start in gameplay with the local player at low Magic Stones.
- summon-ready: start in gameplay with full Magic Stones and nearby enemies.
- combat-damaged-player: start in gameplay with the local player damaged.

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
