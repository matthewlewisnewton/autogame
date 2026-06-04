# AGENTS.md

Project overview and commands live in `CONTEXT.md`. This file adds notes for Cursor Cloud agents.

## Cursor Cloud specific instructions

### Products in this repo

| Area | Path | Purpose |
|------|------|---------|
| **autogame** (game) | `game/` | 3D multiplayer game — Express + Socket.IO server, Vite + Three.js client |
| **autogame-harness** | `harness/` | Ticket backlog orchestrator (bash + Python rewrite) |

### Automatic dependency refresh (VM startup)

The VM `update_script` runs `pnpm install` in `game/` and `harness/`, plus `pip install -e '.[test]'` in `harness/`. It does **not** start servers, install Playwright browsers, or run tests.

### Node / Python versions

CI uses **Node 20** (`.github/workflows/lobby-smoke.yml`). Cloud VMs may ship a newer Node (e.g. 22); the game workspace works on both. Python harness targets **3.10+**; use `python3 -m pytest` from `harness/` (pytest may install under `~/.local/bin`).

### Running the game stack

From `game/`:

```bash
export PERSISTENCE_BACKEND=memory   # recommended for ephemeral cloud runs
pnpm run dev
```

- Server: http://localhost:3000 (auth: `/api/register`, `/api/login`; JWT required for Socket.IO)
- Client: http://localhost:5173 (proxies `/api` and `/socket.io` to the server)

Use a **tmux** session for long-running `pnpm run dev` (see system tmux instructions). Register or log in via the client auth overlay before playing.

### Testing (no separate DB)

| Command | Where | Notes |
|---------|-------|--------|
| `pnpm test:quick` | `game/` | Vitest; in-process server + jsdom — no dev servers needed |
| `pnpm test` | `game/` | Full suite + coverage (heavier memory use) |
| `pnpm run test:smoke:lobby-dropin` | `game/` | Needs server on :3000 |
| `pnpm run test:smoke:lobby-browser` | `game/` | Needs server :3000 + client :5173 |
| `python3 -m pytest` | `harness/` | No game services required |
| `pnpm run check:deps` | `game/` | Supply-chain age check |

Playwright browser smokes need Chromium once per VM:

```bash
cd harness && npx playwright install chromium
```

(`game/client` also lists Playwright; harness install is sufficient for existing smokes.)

### Lint

There is no ESLint for `game/`. Optional harness shell lint: `harness/lint.sh` (requires `shellcheck`, often not installed on cloud VMs). Python harness is gated by `pytest` in CI.

### Harness / LLM tooling

Full backlog loops (`harness/supervisor.sh`, ticket agents) need external LLM CLIs and are optional for game development. Optional progress UI: `pnpm -C harness run progress` (port **8787**).

### Gotchas

- **`PERSISTENCE_BACKEND=memory`** avoids writing under `game/data/` and matches CI lobby smoke.
- Vitest can report all tests passed then exit **137** during teardown on tight memory; re-run `pnpm test:quick` if unsure.
- Socket smokes assume default ports **3000** (server) and **5173** (client).
