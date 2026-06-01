# Senior review: Ticket 123 — Field Medic Kit

**Baseline:** `2116904f6ad7e0847329c57b9834edc601947ec9`  
**Commits:** `c873621` (server), `a080729` (client VFX), `1cd604e` (tests)  
**Capture:** `round-1/metrics.json` — `capturePlanSource: fallback` (lobby → gameplay smoke; no medic-kit-specific scenario)

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| Servers started | Pass (`url`: localhost:5173, phase `playing`, canvas present) |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines; only Vite connect, benign 409 on auth resource, `[initScene]` logs |

The captured run proves the game loads and plays. Harness smoke did not exercise the medic kit in-browser, but runtime health is clean.

---

## Acceptance criteria

### Cooldown ~6–8s

**Met.** `KEY_ITEM_DEFS.field_medic_kit.cooldownMs` is `7000`; handler uses `def.cooldownMs || 7000`. Integration test confirms immediate reuse returns `on_cooldown` with `remainingMs > 0`.

### Affects caster + other `gameState.players` in radius; dead players skipped

**Met.** Server iterates `Object.values(state.players)`, skips `dead` and `extracted`, uses `Math.hypot` against caster `(x, z)` with `healRadius` default `5` (within ticket’s 4–6 m). Caster is included when in range. Tests cover two-player heal, out-of-range unchanged, dead skipped, and solo self-heal.

### Does not exceed `MAX_HP` / `MAX_MAGIC_STONES`

**Met.** Heal uses `Math.min(p.hp + MAX_HP * healPercent, MAX_HP)` with `healPercent: 0.4`; MS uses `Math.min((p.magicStones || 0) + msRestore, MAX_MAGIC_STONES)` with `msRestore: 3` (within +2–4 MS). Dedicated cap test included.

### Party-safe in multiplayer lobby runs

**Met.** Healing mutates shared lobby `state.players` and broadcasts `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`. Two- and three-player socket tests run in the same lobby run. No client-only heal path.

### Client VFX: brief green pulse; HUD heal numbers optional

**Met (VFX).** `triggerHealPulseVFX` in `renderer.js` — green `#44ff44` ring, ~400 ms expand to 5 m, ~200 ms fade, dispose on complete. Wired from `keyItemUsed` when `ok` and `keyItemId === 'field_medic_kit'`.

**Optional HUD numbers:** Not implemented; ticket marks this optional — not a gap.

**Note:** `keyItemUsed` is emitted only to the caster’s socket (same as dodge roll / summon recall). Allies see HP/MS via `stateUpdate` but not the green pulse on their clients (see nits).

### Tests: two in range heal; out of range unchanged; cooldown gate

**Met.** `game/server/test/field_medic_kit.test.js` — six cases including caps and self-heal. `coverage.log`: 866 tests passed; medic-kit tests executed. `key-items.test.js` lists `field_medic_kit` among 14 defs.

---

## Design & foundation consistency

- Aligns with existing key-item pattern (`useKeyItem` handler branch, `KEY_ITEM_DEFS`, `stateUpdate` broadcast, client `keyItemUsed` feedback).
- `game/docs/design.md` has no separate medic-kit section; no conflict found.
- `game/docs/requirements.md` foundation (3D render, sockets, multiplayer movement) unchanged; capture shows two-player run in `playing` phase.

---

## Code quality

- Server logic is straightforward: radius scan, caps, cooldown, persistence dirty flag.
- No dead code in the ticket diff; VFX cleans up geometry/material.
- Client uses caster position from `gameState` at `keyItemUsed` time (reasonable; position is stable for a pulse).
- Pre-existing pattern: server does not require `keyItemId === player.equippedKeyItemId` (client sends equipped id only) — unchanged by this ticket.

---

## Debug scenario: `medic-kit-ready` (added in this ticket)

| Rule | Assessment |
|------|------------|
| Dev-only entry | Pass — `?debugScenario=medic-kit-ready` on localhost client; `isDebugScenarioAllowed` on server; listed in `DEBUG_SCENARIOS`. |
| Normal path still reaches equivalent state | Pass — equip `field_medic_kit` in lobby, enter run, take damage, use key item with cooldown clear. |
| Does not bypass `useKeyItem` validation | Pass — scenario only sets HP/MS/equip/cooldown and enters `playing`; heal still requires a normal `useKeyItem` emit. |

---

## Capture & QA limitations (non-blocking)

- Fallback capture (`01-initial`, movement probes) does not show medic-kit use or green pulse in screenshots.
- Sub-ticket 02 was `visual` verification; holistic browser proof of VFX was not in this capture plan. Code and sub-ticket QA are the evidence for VFX.

---

## Remaining gaps

None blocking. Runtime is healthy; acceptance criteria are satisfied in code and tests.

---

## Nits (non-blocking)

See `round-1/nits.md` for follow-up tickets: ally-visible heal VFX, shared heal-radius constant, outdated key-item description string.

VERDICT: PASS
