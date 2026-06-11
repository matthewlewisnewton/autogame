# Client: split main.js bindSocketHandlers (~930 lines) into handler registration groups

## Difficulty: medium

## Goal

bindSocketHandlers (game/client/main.js:1157-2085) binds every socket event in one function; the STATE_UPDATE handler alone does phase transitions, HUD sync, hand reconciliation, prediction reconciliation, dash detection, and cooldown HUD (~200 lines). main.js (5,100 lines) otherwise mixes auth, lobby browser, deck editor, shop, trade, medic, quest board, key items, and settings. Fix: split handlers into registration groups (bindStateHandlers, bindLobbyHandlers, bindCardHandlers, ...) in separate modules taking a shared context object, following the existing cardRenderCtx pattern. Found in code review 2026-06-09.

## Acceptance Criteria

- bindSocketHandlers delegates to per-domain registration modules sharing a context object; no behavior change (existing main/socket tests pass)

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
