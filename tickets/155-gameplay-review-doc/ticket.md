# Gameplay Review: Improvements & Simplifications Doc

Exercise the current game, analyze its mechanics, and write a review document
proposing gameplay **improvements** and **simplifications** for human review.

## Difficulty: hard

## Goal

Produce a single grounded design document — `game/docs/gameplay-review.md` — that
captures how the game currently plays and proposes concrete ways to make it more
fun and/or simpler. This is an **analysis deliverable for a human to review
later**, NOT a gameplay change. The only file added is the review document; no
runtime game code is modified.

To "play" the game, study the running game and the codebase: read
`game/docs/design.md`, the server systems under `game/server/`, the client under
`game/client/`, and observe the running game (the harness starts the servers and
captures screenshots during verification). Ground every proposal in mechanics
that actually exist (movement, combat, key items, co-op, stages, lobby/HUD,
enemies, loot) — cite the specific system or file each proposal touches.

## Acceptance Criteria

- A new file `game/docs/gameplay-review.md` exists and is the only added/changed
  file (no edits to runtime code under `game/server/` or `game/client/`).
- It contains these sections, in order:
  - **Current gameplay** — a concise summary of the core loop and the main
    systems as they exist today (grounded in the code, not generic).
  - **Improvements** — at least **6** concrete, actionable proposals to make the
    game more fun. Each: the idea, why it helps, the specific system/file it
    touches, and a rough effort tag (S/M/L).
  - **Simplifications** — at least **4** concrete proposals to reduce complexity
    or friction (mechanics, controls, UI, or systems to cut/merge). Each: what to
    simplify, why, and what is lost/gained.
  - **Prioritized shortlist** — the top 5 proposals overall, ordered, with a
    one-line justification each.
- Every proposal names a real mechanic/system in this game (generic
  game-design advice that could apply to any game does not count).
- The document is self-contained and readable on its own.

## Technical Specs

- Create only `game/docs/gameplay-review.md`. Do NOT modify any `.js`/`.ts`/
  runtime files. The diff for this ticket is exactly one new markdown file.
- Source material to read: `game/docs/design.md`, `game/server/` (combat, key
  items, movement, enemies, loot, run/lobby flow), `game/client/` (controls, HUD,
  rendering), and the running game's behavior/screenshots.

## Verification

`Verification: code`
