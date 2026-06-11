# Senior Review — 323-anim-vault-wyrm (Vault Wyrm animation theme + timing)

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started, scene initialized
  (`sceneInitialized: true`, `hasCanvas: true`), 2 players connected.
- `console.log` (10 lines): only `[vite] connecting/connected`, `[initScene]`,
  `[launchBooth]`, and two `409 Conflict` resource loads. The 409 is the benign
  lobby create/join race (resource load, not a game-code page error) and is not
  in `pageerrors`. No `pageerror` / `[fatal]` lines.
- **Game runs and loads cleanly.**

## Scope
Diff vs baseline `7b5516bb` touches only:
`game/client/cardRenderers.js`, `game/client/cards.js`,
`game/client/test/cardRenderers.test.js`, `game/client/test/deck-viewer.test.js`
(plus sub-ticket docs). Entirely within the declared scope
(`cardRenderers.js` + `game/client` vfx + `game/client/test`).

## Acceptance criteria

### 1. Animation visibly matches name/theme ("Vault Wyrm" = fire/ember)
PASS. `renderWyrmAttack` now uses an unconditional hot palette
(`color = getAccentHex('dungeon_drake') = 0xfb923c`, `emissive = 0xf97316`) with
dense bursts (count 14, spread 2.0). `cards.js` adds
`dungeon_drake: { color: '#fb923c', icon: '🔥' }`. Screenshot `04-after-dodge.png`
confirms the card now renders as an amber/ember card with a 🔥 icon, "BURNING
BREATH", and the deck mini-counter uses 🔥. Previously the breath keyed its warm
look off `specialEffect === 'fire_breath'`, but the server emits
`specialEffect: "burning_breath"` for this card (cardStats.json:10), so that
branch never matched and the old visual fell back to the dim green/purple ember —
the fix correctly resolves this.

### 2. Timing synced to server effect resolution
PASS.
- Wind-up: cardStats `windUpMs: 600`; HUD shows "600ms wind-up" (generic 307
  telegraph, already wired, untouched — correct).
- Breath cone lifetime bound to `data.breathDurationMs` (server
  `config.breathDurationMs = 2000`, simulation.js:2019/1984), so the cone persists
  for the full channel instead of a default flash.
- Per-tick ember bursts: the renderer emits a spark + ember burst per hit on EVERY
  server breath event — `start` and each `tick` — matching the server's
  `breathTickMs = 500` cadence (simulation.js:2042-2044). No client-side
  `scheduleAfter`/timer invents its own cadence; the new test
  "never schedules a client-side burn cadence" locks this in.

### 3. No perf regression
PASS. Per-event bursts are bounded (one spark + one ember per hit); ticks add no
unbounded particle growth. No new allocations in hot loops beyond the existing
pattern. No timers.

### 4. Client test where feasible
PASS. `cardRenderers.test.js` updated and extended: palette assertions, cone
duration binding, per-hit ember bursts on tick across multiple enemies, and the
no-client-timer guarantee. `deck-viewer.test.js` updated for the 🔥 icon. Full
suite: 277/277 pass.

## Consistency / regressions
- `renderArchiveWyrmBreath` (ancient_wyrm) is untouched and still keys off
  `fire_breath` — correct, that is a different card with different server payload.
- No debug scenarios added or changed.
- No design.md / requirements.md regressions; this is a cosmetic + timing polish
  on existing primitives.

## Remaining gaps
None blocking. One minor doc-accuracy nit (renderer comment says the server emits
"NO specialEffect" when it actually emits `"burning_breath"`) — filed in nits.md.

VERDICT: PASS
