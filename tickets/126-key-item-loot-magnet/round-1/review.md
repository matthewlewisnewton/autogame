# Senior Review: Ticket 126 — Key Item: Loot Magnet

**Baseline:** `8c72d8ad252d99e04d4753eb3414c4a88e8f43be`  
**Commits:** `570fc71` (server pull logic), `c9642ba` (tests), `f80af31` (ticket spec)  
**Capture:** `round-1/metrics.json`, `round-1/console.log` (fallback full-flow smoke; no loot-magnet-specific scenario)

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind: browser_pageerror` | Pass |
| `console.log` — no `pageerror` / `[fatal]` lines | Pass (only Vite connect + HTTP 409 on auth, benign) |
| Game reaches `playing`, canvas, 2 players | Pass (probes) |

The captured run proves the game starts and loads cleanly. Harness used the deterministic fallback plan (lobby → movement smoke), not `?debugScenario=loot-magnet-ready`; that is acceptable because this ticket’s verification is **code** (`Verification: code` in `ticket.md`).

---

## Acceptance criteria

### Cooldown ~8s

**Met.** `KEY_ITEM_DEFS.loot_magnet` sets `cooldownMs: 8000` (was 25000). Handler applies `now + (def.cooldownMs || 8000)`. `loot_magnet.test.js` asserts `on_cooldown` with `remainingMs` ≈ 8000 on back-to-back use.

### Pull loose loot within ~8m toward caster (~0.3s or instant snap)

**Met (instant snap).** On `useKeyItem`, each entry in `state.loot` within `attractRadius` (default 8) is displaced toward the player by the full straight-line distance via `tryPlayerMove`, then auto-collected if within `LOOT_PICKUP_RADIUS` (3.5). This matches the sub-ticket spec (“instant pull, not persistent”) and the top-level ticket’s “or instant snap” wording. No client animation is required.

Ground **cards** are not `state.loot` entities (card rewards use `runCardDropIds` / choice UI); “ground cards if applicable” is N/A for the current loot model (`currency`, `magic_stone`, `crystal`, and layout spawns without `kind`).

### Does not pull loot through walls; respects pickup rules

**Met.**

- **Walls:** `tryPlayerMove(loot.x, loot.z, dirX, dirZ, dist, colliders)` with `getWallColliders()` — same wall-aware pathing as player movement. Dedicated test places loot behind an inner wall; loot slides along the wall, stays beyond pickup radius, and is not collected.
- **Pickup rules:** Auto-collect branch mirrors `lootPickup` (magic stones → `addMagicStones`, crystals → `recordCrystalCollected` + terminal check, else currency). Distance gate uses `LOOT_PICKUP_RADIUS`.

### Tests: drop outside range moves closer; already collected ignored

**Met.**

- **Outside attract range (15m):** untouched (`loot outside attractRadius is untouched`).
- **Moves closer without spurious collect:** wall-blocked pull test (7m, blocked at z=3 wall).
- **Already collected:** second activation after splice returns `pulled: 0`, `collected: 0`, no currency double-credit.
- Additional coverage: in-radius auto-collect, multi-loot counts, cooldown, magic_stone in debug setup.

All 7 tests in `game/server/test/loot_magnet.test.js` pass (confirmed locally).

### Integration / gate / defs

**Met.**

- `loot_magnet` added to `useKeyItem` implementation whitelist.
- `key-items.test.js` `not_implemented` case uses `overclock` instead of `loot_magnet`.
- Generic client path (`onUseKeyItem` → `socket.emit('useKeyItem', { keyItemId: me.equippedKeyItemId })`) works without client-specific changes.
- Lobby equip via `equipKeyItem` unchanged.

---

## Design & foundation

- Aligns with `game/docs/design.md` loot/economy loop (currency and MS drops on the ground, walk-over pickup).
- No conflicts found in `game/docs/requirements.md` (no key-item-specific requirements there).
- Consistent with other implemented key items: server-authoritative `useKeyItem`, cooldown on `keyItemCooldownUntil`, `stateUpdate` broadcast.

---

## Debug scenario: `loot-magnet-ready`

| Requirement | Status |
|-------------|--------|
| Gated to dev path only | Pass — registered in `DEBUG_SCENARIOS`; client requires `?debugScenario=` on localhost; server `isDebugScenarioAllowed`. |
| Normal path still reaches equivalent state | Pass — equip `loot_magnet` in lobby, enter dungeon, kill enemies / layout loot, press bound key item action. |
| Does not skip server validation | Pass — scenario only pre-seeds `equippedKeyItemId`, cooldown, and `state.loot`; activation still goes through `useKeyItem` handler. |

Capture did not use this scenario (`debugScenario: null` in probes); not blocking for a code-verified ticket.

---

## Code quality

- Focused diff: `game/server/index.js`, `game/server/progression.js`, tests only.
- No dead code or obvious logic bugs in the pull loop (backward iteration safe for `splice`).
- `savePlayerData` on successful magnet use is slightly more aggressive than some other key items but is reasonable for currency/MS persistence.
- Pre-existing pattern: `useKeyItem` does not verify `keyItemId === player.equippedKeyItemId` (client sends equipped id; tests emit directly). Not introduced by this ticket.

---

## Coverage (visibility)

`round-1/coverage.log` includes full `loot_magnet.test.js` run. New handler lines in `index.js` are exercised by unit tests; global thresholds are harness-disabled for this ticket.

---

## Remaining gaps

None blocking. Runtime is clean; acceptance criteria and sub-ticket specs are satisfied.

---

## Nits (non-blocking)

See `round-1/nits.md` for backlog items (test naming clarity, optional client feedback).

VERDICT: PASS
