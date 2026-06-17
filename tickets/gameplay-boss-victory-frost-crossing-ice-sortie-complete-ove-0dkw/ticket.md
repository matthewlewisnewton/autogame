# gameplay/boss-victory: frost_crossing (ice) Sortie Complete overlay hidden instantly by returnToGuildLobby

## Difficulty: medium

## Goal

PRESET: ice (frost_crossing Tier-1, objectiveType=stage_boss). Real infra (PostgresProvider confirmed in server.log; also repros on PERSISTENCE_BACKEND=memory, so NOT persistence-specific).

REPRO (3/3 deterministic): from game/, export PERSISTENCE_BACKEND + DATABASE_URL + REDIS_URL, run `node ../harness/validate/playthrough.mjs --preset ice --steps full --out <dir>`. Driver fails at waitForSortieCompleteOverlay with 'Sortie Complete overlay not visible'.

EXPECTED: after boss defeat, the run-summary overlay (#run-summary-overlay, status '#summary-status' = 'Sortie Complete') stays visible so the player sees rewards + card choices and can return to hub. Known-good: game/validation/ice/ artifact has 10-victory.png + telepipe steps, i.e. it used to pass.

ACTUAL: server reports victory correctly (lastRunSummary.status=victory, objective.bossDefeated=true, runObjectiveComplete=true), and showRunSummary() DOES run (sets #run-summary-overlay display:flex). But ~6ms later the overlay is forced back to display:none. Harness probe: sortieCompleteOverlayVisible=false, phase=playing, extracted=false, cardHandVisible=true. Player is left standing in the dungeon; never sees Sortie Complete.

ROOT CAUSE (captured via MutationObserver + style.display setter hook injected into the real driver run): the hide is

  CSSStyleDeclaration.set display
    at returnToGuildLobby (client/main.js:686)        // runSummaryOverlay.style.display = 'none'
    at STATE_UPDATE handler (client/socketHandlers/stateHandlers.js:96)  // else if (state.gamePhase === 'lobby') ctx.returnToGuildLobby(...)
    at socket.io onpacket (STATE_UPDATE)

So immediately after RUN_COMPLETE shows the overlay, a STATE_UPDATE with gamePhase==='lobby' arrives and returnToGuildLobby() hides it. The lobby-phase stateUpdate races with / clobbers the RUN_COMPLETE overlay for frost_crossing victory.

SCOPE: reproduces ONLY on ice/frost_crossing. spire-ascent (Tier-2 stage_boss) reached the same victory overlay step and PASSED, so this is frost_crossing-specific server phase emission at victory (the frost-crossing-boss-low-hp / surface-transition flow likely sets the lobby phase) OR a client ordering issue specific to that quest's completion. Fire (defeat_enemies) and spire (stage_boss) victory overlays show fine.

EVIDENCE: harness/tmp/e2e-boss-ice/ , e2e-boss-ice2/ (postgres), e2e-ice-mem/ (memory) — all show 09-boss-defeated.png but NO 10-victory.png; server.log line 3 '[persistence] PostgresProvider initialized'. Diagnostic preload: harness/tmp/inject-observer.mjs.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
