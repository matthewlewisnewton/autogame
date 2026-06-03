# 166-bug-deck-viewer-grid-empty

## Difficulty: medium

## Goal

During QA playthrough, opening the deck viewer (V key) shows the 'Grimoire' panel titled with 'Deck: 5/12' and the close hint, but #deck-viewer-grid (game/client/index.html:77) renders no card tiles -- just empty space. A deck viewer that shows a count but no cards reads as broken/confusing. Confirm whether the grid is supposed to be populated and fix the render path. Relevant: game/client/deck-viewer.js.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: visual`
