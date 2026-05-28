# Project Context

## Tech Stack
- **Backend**: Node.js + Express + Socket.IO (in `game/server/`)
- **Frontend**: Vite + Three.js + Socket.IO client (in `game/client/`)
- **Language**: Vanilla JavaScript (ES modules)
- **Harness**: Bash agent loop + Python rewrite (`python -m harness`)

## Directory Layout
```
autogame/
├── TASKS.md                  ← Task index (authoritative completion status)
├── LOGBOOK.md                ← Historical progress log (may lag TASKS.md)
├── CONTEXT.md                ← This file (prepended to all agent prompts)
├── harness/                  ← Orchestration scripts
│   ├── supervisor.sh         ← Top-level supervisor loop
│   ├── run_backlog.sh        ← Process ticket backlog
│   ├── run_ticket.sh         ← Run one ticket
│   ├── run_subtask.sh        ← Run one sub-ticket (coder + QA loop)
│   ├── lib.sh                ← Shared bash helpers
│   ├── screenshot.mjs        ← Playwright screenshot helper
│   ├── cli.py                ← Python harness entry (`python -m harness`)
│   └── pyproject.toml
├── tickets/                  ← One folder per ticket (ticket.md + accumulated context)
└── game/                     ← All game source code
    ├── client/               ← Vite + Three.js frontend
    │   ├── main.js, renderer.js, index.html
    │   ├── scripts/          ← Playwright smoke tests
    │   └── package.json
    ├── server/               ← Express + Socket.IO backend
    │   ├── index.js, simulation.js, progression.js, lobbies.js
    │   └── package.json
    ├── shared/               ← theme.json, constants.json
    ├── scripts/              ← vitest runner, smoke tests, dep checks
    ├── docs/                 ← design.md, lobbies.md, controls.md, …
    ├── package.json          ← Root (concurrently runs client + server)
    └── pnpm-workspace.yaml
```

## How to Run
```bash
cd game
pnpm install
pnpm run dev
# Server: http://localhost:3000
# Client: http://localhost:5173
```

Register or log in via the auth overlay before playing. Socket connections require a JWT from `/api/register` or `/api/login`.

## Testing
```bash
cd game
pnpm test              # full suite with coverage
pnpm test:quick        # fast CI-style run
pnpm test:smoke:lobby-dropin   # socket lobby smoke test
pnpm test:smoke:lobby-browser  # Playwright two-browser lobby test
pnpm test:smoke:lock-on        # Playwright lock-on settings test
```

## Supply-chain checks
Run `pnpm run check:deps` (from `game/`) to flag dependencies newer than the configured minimum age.
A CI workflow (`.github/workflows/check-deps.yml`) runs the same check on PRs that touch `pnpm-lock.yaml`.

## Game Summary
A 3D multiplayer action-RPG combining Phantasy Star Online's lobby/dungeon/loot loop with Lost Kingdoms' card-based combat. Players hold a hand of up to 4 cards (Spells, Weapons, Creatures, Enchantments) and use them to fight enemies in procedurally generated dungeons. Multi-lobby support: players browse lobbies, join channels, and deploy together.
