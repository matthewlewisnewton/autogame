# Current Gameplay: Lobby & Meta Loop

Create `game/docs/gameplay-review.md` and write the first half of the **Current gameplay** section: how players move from login through lobby browser, squad lobby, ready/deploy, mid-run drop-in, and Telepipe suspend/resume. Ground every claim in existing code and docs—no generic MMO descriptions.

## Acceptance Criteria

- `game/docs/gameplay-review.md` exists; no files under `game/server/` or `game/client/` are added or modified.
- The document opens with a `#` title and a `## Current gameplay` section (additional subsections under it are fine).
- That section accurately describes, in prose:
  - Auth → lobby browser (not auto-placed into a game on connect).
  - Create/join lobby, drop-in on in-run lobbies, and per-lobby isolated state.
  - In-lobby squad flow: deck/loadout, quest selection, ready-up, `startGame` when all ready with valid decks.
  - Mid-run leave/persist vs empty-lobby teardown.
  - Telepipe placement, per-player extraction, run suspend when the dungeon is empty, checkpoint restore on redeploy, and abandon suspended run.
- At least **five** inline references to real paths (e.g. `game/server/lobbies.js`, `game/docs/lobbies.md`) or named exports/handlers.
- **Improvements**, **Simplifications**, and **Prioritized shortlist** sections are not required yet (may be absent or stubbed).

## Technical Specs

- **Create only:** `game/docs/gameplay-review.md`.
- **Read (do not edit):**
  - `game/docs/design.md`, `game/docs/lobbies.md`, `game/docs/telepipe-tier2-context.md`
  - `game/server/lobbies.js`, `game/server/index.js` (socket handlers: join/create lobby, ready, leave, telepipe events)
  - `game/server/progression.js` (`checkAllReady`, `startGame`, suspend/checkpoint helpers, drop-in init)
  - `game/client/main.js` (lobby browser UI, ready button, deploy/suspended-run UI)
- Summarize player-visible flow and server authority; note `withLobbyContext` / per-lobby `state` only if it clarifies behavior for reviewers.

## Verification: code
