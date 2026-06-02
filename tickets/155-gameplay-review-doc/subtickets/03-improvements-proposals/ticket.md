# Gameplay Improvements Proposals

Add a **Improvements** section to `game/docs/gameplay-review.md` with at least six concrete, game-specific proposals to make the existing build more fun. Each proposal must tie to a real system already described in **Current gameplay**.

## Acceptance Criteria

- `game/docs/gameplay-review.md` includes `## Improvements` immediately after `## Current gameplay` (parent order: Current → Improvements → Simplifications → Shortlist).
- At least **6** numbered or bulleted proposals.
- Every proposal includes:
  - **Idea** — what to change or add.
  - **Why** — player-facing benefit.
  - **Touches** — at least one specific file, module, or mechanic name from this repo (not “the combat system” alone).
  - **Effort** — `S`, `M`, or `L`.
- No proposal is generic advice that could apply to any RPG without naming this game’s cards, lobby flow, telepipe, lock-on, loot, etc.
- Still no edits to `game/server/` or `game/client/` runtime sources.

## Technical Specs

- **Edit only:** `game/docs/gameplay-review.md`.
- Base proposals on the completed **Current gameplay** text plus targeted re-reads where needed:
  - Friction points: `game/client/settings.js`, `game/client/deck-loadout.js`, `game/client/questBoard.js`, `game/server/progression.js` (shop, rewards, hand rules), `game/server/simulation.js` (enemy pacing, loot), `game/docs/requirements.md` if present.
- Prefer actionable changes (tune constant, UX copy, merge overlapping card roles per design.md playtesting note) over greenfield features unless grounded in existing stubs/tests.

## Verification: code
