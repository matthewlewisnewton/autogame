# Docs: fix stale sections in design.md

Correct clearly outdated or incorrect statements in `game/docs/design.md` so the
document matches how the game actually works today. Targeted touch-ups only.

## Difficulty: easy

## Goal

Make surgical corrections to `game/docs/design.md` where it is factually wrong
versus the current code — outdated mechanics, removed/renamed features, or wrong
values/labels. This is a quick accuracy pass, **not** a rewrite, restructure, or
full audit, and **not** new content. The only file changed is the design doc; no
runtime code is touched.

## Acceptance Criteria

- Only `game/docs/design.md` is modified (no changes under `game/server/` or
  `game/client/`).
- At least one genuinely stale/incorrect statement is corrected to match current
  behavior (verify against the actual code before changing).
- The doc's existing structure and headings are preserved — corrections are
  surgical, not a wholesale rewrite, and no sections are deleted.
- Every edit reflects real current code/behavior (no speculative or aspirational
  claims).

## Technical Specs

- Edit only `game/docs/design.md`. Diff is limited to that one file.
- Cross-check claims against the relevant code under `game/server/` and
  `game/client/` before editing.

## Verification

`Verification: code`
