# Senior Review: Key Item — Echo Strike (#132)

**Baseline:** `d564f545d08aad78fe9fcf5ee11597054a799956`  
**Commits:** `0283f38` (activation), `b7cd8d9` (weapon echo)  
**Capture:** `round-1/metrics.json` — fallback full-flow smoke (lobby → gameplay movement)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass (409 on auth resource is benign; Vite connect only) |
| `pageerrors.json` | `[]` |

The captured run loads Two.js, enters `playing` with canvas, card hand, and enemies. Infrastructure is healthy; no harness blocker.

Round-1 capture did **not** exercise Echo Strike gameplay (generic smoke only). Acceptance is judged primarily on code and unit tests per ticket `Verification: code`.

---

## Acceptance criteria

### Cooldown ~10s

**Met.** `KEY_ITEM_DEFS.echo_strike` sets `cooldownMs: 10000` in `game/server/progression.js`. The `useKeyItem` handler sets `player.keyItemCooldownUntil = now + (def.cooldownMs || 10000)` and emits `cooldownUntil` on success.

Tests in `game/server/test/key-items.test.js` assert definition cooldown, activation cooldown window (`before + 10000` … `after + 10000`), and immediate re-use returns `{ ok: false, reason: 'on_cooldown', remainingMs }` ≈ 10000.

### Only weapon-type cards trigger echo; spells/summons do not

**Met.** Echo enqueue and `echoStrikePending` consumption live exclusively in the `useCard` weapon branch (`cardDef.type === 'weapon'`, after hit collection). Spell handling starts at a separate `cardDef.type === 'spell'` branch; creature/summon at `cardDef.type === 'creature'` — neither reaches echo logic.

Spell regression is covered: `a spell use leaves the flag armed and enqueues no echo` (`frost_nova`). Creature cards are structurally excluded the same way; no separate creature test, but behavior follows from branch isolation (see nits).

Weapon `draw_card` effects return early before echo logic, so they neither proc nor consume the pending flag — consistent with “no damage packet” and acceptable for this ticket.

### Tests: one weapon use → two damage packets; echo consumed after one proc

**Met.** `echo_strike — weapon echo` suite:

- Armed swing: primary HP drop synchronously, `pendingEchoes` enqueued at 50% (`Math.max(1, Math.round(17 * 0.5))` = 9), flag cleared.
- `processPendingEchoes()` applies delayed second packet to the same `enemyId`, sets `lastDamagedBy`, clears queue.
- Second weapon use after flush: only primary damage, no new echo.
- Missed swing: flag consumed, no enqueue (documented edge behavior).
- Activation/persistence tests cover pending flag, cooldown, and `extractPersistentData` exclusion.

Harness `coverage.log` and a local re-run of `key-items.test.js` show **36/36** tests passing for that file, including all echo_strike cases.

---

## Design & foundation consistency

- Aligns with `game/docs/design.md` combat model: key items augment card combat; Echo Strike buffs the next **weapon** hit with a follow-up damage packet, not a radial burst.
- Old `echo_strike` burst fields (`radius`, `damage`) removed; description updated to “next weapon hit … 50%”.
- `echoStrikePending` is transient (not in `extractPersistentData`), matching other combat buff flags.
- `pendingEchoes` initialized on lobby/game state (`index.js`, `lobbies.js`) and processed each sim tick via `processPendingEchoes()` in `simulation.js` (150ms delay constant `ECHO_STRIKE_DELAY_MS`).
- No conflict with `game/docs/requirements.md` (no echo-specific requirements there).

---

## Code quality

- Clear separation: activation in `useKeyItem`, proc in weapon branch, application in simulation tick.
- Damage uses scaled swing damage (`scaledGrindStat` / `echoDamage`) × `echoFraction` from defs, `Math.max(1, round(...))`.
- Multi-target weapon hits dedupe enemy IDs and enqueue one echo entry with per-target damage.
- `echo_strike` removed from `not_implemented` guard; listed among implemented key items.
- No dead radial-burst implementation left for this item.

Minor non-blocking observations (nits): no dedicated creature-card test; `pendingEchoes` are not part of telepipe/checkpoint capture (edge case if run suspends in the 150ms window).

---

## Debug scenario: `echo-strike-ready`

| Requirement | Assessment |
|-------------|------------|
| Gated to debug/dev path only | Pass — registered in `DEBUG_SCENARIOS`; applied via `debugScenario` socket (client: `?debugScenario=` on localhost only, `isDebugScenarioAllowed` on server). Normal capture had `debugScenario: null`. |
| Equivalent state reachable in normal play | Pass — players equip `echo_strike`, call `useKeyItem`, then use a weapon card against enemies; scenario only pre-equips, clears cooldown, ensures a weapon in hand, and spawns one grunt ahead. |
| Does not weaken invariants | Pass — does not bypass `useKeyItem` or weapon validation; only sets up player/enemy state for QA. Same pattern as `flare-beacon-ready`, `medic-kit-ready`, etc. |

---

## Sub-ticket integration

Both sub-tickets’ criteria are satisfied in the combined working tree:

1. **01-echo-strike-activation** — defs, handler, cooldown, persistence exclusion, tests.
2. **02-echo-strike-weapon-echo** — delayed 50% packet, weapon-only proc, consumption, spell non-proc test, simulation hook.

No integration gaps found between activation and weapon echo layers.

---

## Remaining gaps

**None (blocking).** Runtime is clean; all top-level acceptance criteria are implemented and covered by tests.

---

VERDICT: PASS
