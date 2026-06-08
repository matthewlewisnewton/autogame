# Senior Review — 334-anim-deck-sifter

## Runtime health (gate)
- `metrics.json`: `ok: true`, servers started, `url` reachable, `sceneInitialized: true`, `hasCanvas: true`, gameplay reached (`phase: playing`, two players, enemies present).
- `pageerrors: []` and `pageerrors.json` empty — no browser code defects.
- `console.log` clean: only `[vite] connecting/connected`, a benign `409 Conflict` on a resource fetch (pre-existing, present for both clients and unrelated to this ticket), and normal `[initScene]` / `launchBooth` logs. No `pageerror`/`[fatal]` from game code.
- Capture used the deterministic fallback full-flow smoke plan (not the new debug scenario), so the run proves the game still boots and plays cleanly with this ticket applied.

The game runs. Gate passes.

## Acceptance criteria

### "Animation visibly matches its name/theme" (Deck Sifter = sift deck → draw a card)
`renderDeckSifter` (game/client/cardRenderers.js:1147) was rewritten from a single generic parchment burst into a coherent 3-phase sequence:
1. **Phase 1** — `spawnTelegraphRing(origin, 2.2, {color, emissive})`: a golden "sift zone" ring at the caster's feet.
2. **Phase 2** (`scheduleAfter(100, …)`) — a wider (`spread 2.2`, `count 14`) wheat/gold particle fan reading as cards rising from the deck.
3. **Phase 3** (`scheduleAfter(200, …)`) — a tighter (`spread 1.0`, `count 8`) gold "draw-completion" glow.

Color uses the card's own accent `getAccentHex('deck_sifter')` → `#d4a843` (game/client/cards.js:181), with wheat `0xf5deb3` parchment highlight — thematically on-point for a card/parchment draw effect, and distinct from the prior single burst.

The available 315 VFX primitive vocabulary (documented at cardRenderers.js:20-45) offers rings, particle bursts, trails, decals, lightning, and pillars — **no card-shaped mesh primitive exists**. The ticket explicitly constrains work to "use the 315 primitives" and "touch only this card's renderer + its registration to avoid conflicts with the other per-card animation beads." Within that constraint, a ring + staggered fan + completion glow built from the card's accent color is the strongest available read of "sift the deck and draw," and it matches the established visual language used across the rest of this card-animation series (114 ring/burst usages in the same file). Theme criterion met.

### "Timing synced to the server effect resolution"
`deck_sifter` is `effect: draw_card` with **no `windUpMs`** (game/shared/cardStats.json:112-116), so it resolves **instantly** on cast — there is no wind-up telegraph to sync to (the 307 wind-up path at cardEffects.js:117-118 short-circuits when `windUpMs <= 0`). The server's `draw_card` branch resolves the draw and emits `CARD_USED` in the same tick (cardEffects.js:299-323); the renderer fires immediately off that event. The 100ms/200ms staggers are intra-animation beats, not a desync. Timing is correct.

Integration fix: the `CARD_USED` payload for `draw_card` now includes `origin: { x: originX, z: originZ }` (cardEffects.js:321). This is necessary — `originOf(data)` (cardRenderers.js:61) falls back to world `{0,0}` without it, so previously the VFX would have rendered at map origin rather than the caster. Minimal and correct.

### Debug scenario — `deck-sifter-ready`
Added at debugScenarios.js:1412 and registered in the `DEBUG_SCENARIOS` set (index.js:574). Audited against the debug-scenario rules:
- **Debug-gated only**: reachable solely via the `?debugScenario=deck-sifter-ready` path through `applyDebugScenario`; no normal gameplay code references it.
- **End-state reachable normally**: `deck_sifter` is a real reward card (`acquisition: "reward"`, `rewardOrder: 20` in game/shared/cardDefs.json:16) — a player obtains it through dungeon rewards and deploys with it, exactly as the scenario's comment states.
- **No weakened invariants**: it only seeds `hp`/`magicStones`/hand/enemies (same pattern as sibling `*-ready` scenarios). It does not pre-resolve the draw or bypass `executeUseCard` — casting still goes through full server validation (`canDrawIntoHand`, charge decrement, cooldown). No invariant is short-circuited.

### Code quality / regressions
- 5 `deck_sifter` client tests pass (ran `vitest run -t deck_sifter`): ring params, staggered double-burst timing, graceful degradation when `scheduleAfter` and/or `spawnParticleBurst` are absent. Good defensive coverage of optional ctx helpers.
- No perf regression: 2 extra short-lived particle bursts + 1 ring, gated behind helper-presence checks, all reusing existing primitives.
- Consistent with `design.md` card-VFX conventions; no foundation regression.

## Remaining gaps
None blocking. One non-blocking nit (duplicate test import) is carried to `nits.md`.

A prior review attempt failed this ticket arguing the VFX "still reads as a generic golden ring and spark burst" and demanded literal card-shaped silhouettes rendered from a new primitive in `renderer.js`. I disagree: that bar requires a new shared VFX primitive, which the ticket explicitly scopes out to avoid conflicts with other per-card animation beads. Within the mandated "use the 315 primitives, this card's renderer only" constraint, the delivered 3-phase accent-colored sequence is a meaningful, theme-appropriate improvement and satisfies the acceptance criteria.

VERDICT: PASS
