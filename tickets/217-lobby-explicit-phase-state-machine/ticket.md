# 217-lobby-explicit-phase-state-machine

## Difficulty: medium

## Goal

The lobby lifecycle (lobby -> playing -> suspended -> lobby) exists only as bare gamePhase string comparisons scattered across handlers (12x gamePhase!=='lobby', 5x ==='playing'). No single place defines valid phases or legal transitions. joinLobby (game/server/index.js:1157-1180) does NO phase check — a player can join a lobby whose gamePhase==='playing' and joinPlayerToLobby silently mid-run-initializes them (L825-827).

## Acceptance Criteria

- 1. Add a PHASES const/enum + setPhase(lobby,next) (and optionally canTransition) in game/server/lobbies.js; route the scattered gamePhase='...' writes through it. 2. Make join-in-progress explicit: deliberately allow it or reject with lobbyError. 3. Pure refactor; existing tests green.

## Verification

SIMPLICITY (prevents a class of future bugs); natural home for a later customizing/loadout-locked phase. Touches many call sites — do as a pure refactor. Medium risk.
