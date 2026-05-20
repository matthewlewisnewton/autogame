# Project Context

## Tech Stack
- **Backend**: Node.js + Express + Socket.IO (in `game/server/`)
- **Frontend**: Vite + Three.js + Socket.IO client (in `game/client/`)
- **Language**: Vanilla JavaScript (ES modules)

## Directory Layout
```
autogame/
├── TASKS.md                  ← Task index
├── CONTEXT.md                ← This file (prepended to all agent prompts)
├── harness/                  ← Orchestration scripts
│   ├── run_task.sh           ← Main agent loop
│   └── screenshot.js         ← Playwright screenshot helper
├── tickets/                  ← One folder per ticket (ticket.md + accumulated context)
└── game/                     ← All game source code
    ├── client/               ← Vite + Three.js frontend
    │   ├── index.html
    │   ├── main.js
    │   ├── style.css
    │   └── package.json
    ├── server/               ← Express + Socket.IO backend
    │   ├── index.js
    │   └── package.json
    ├── docs/
    │   ├── design.md
    │   └── requirements.md
    └── package.json          ← Root (concurrently runs client + server)
```

## How to Run
```bash
cd game
pnpm run install:all
pnpm run dev
# Server: http://localhost:3000
# Client: http://localhost:5173
```

## Supply-chain checks
Run `pnpm run check:deps` (from `game/`) to flag dependencies newer than the configured minimum age.
A CI workflow (`.github/workflows/check-deps.yml`) runs the same check on PRs that touch `pnpm-lock.yaml`.

## Game Summary
A 3D multiplayer action-RPG combining Phantasy Star Online's lobby/dungeon/loot loop with Lost Kingdoms' card-based combat. Players hold a hand of up to 4 cards (Summons, Weapon/Support, Independent Monsters) and use them to fight enemies in procedurally generated dungeons.
