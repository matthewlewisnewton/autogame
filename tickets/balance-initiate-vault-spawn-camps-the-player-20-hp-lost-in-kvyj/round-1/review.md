# Senior Review: balance-initiate-vault-spawn-camps-the-player-20-hp-lost-in-kvyj

**Ticket:** Initiate Vault tier-1 entry grunts spawn-camp the player during intro dialogue (~20 HP lost in the first seconds).

**Baseline:** `e35dc13b4c6e469103bd2ef15eaa769be2df757b`

**Commits reviewed:**
- `8085a168` — reposition entry grunts toward outbound passage bulkhead (`towardPassage`)
- `57d2c46a` — add 3s `aggroGraceMs` on room-0 wave-0 plus regression test

---

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes — servers started, screenshots captured |
| `pageerrors` | Empty |
| `console.log` fatals / `pageerror` | None (benign Vite connect lines and HTTP 409 on auth register only) |
| `harness_failure` | Absent |

The game loads and runs cleanly in the captured session.

**Capture note:** The harness used the generic fallback recipe (`capturePlanSource: "fallback"`), not a ticket-specific standstill probe. The first gameplay probe reports **70/100 HP** at the spawn tile `(-9, 27)` with the Kade intro banner still visible. Independent server simulation on the same layout seed (`352369970`, two-player party) shows **100 HP after 3s and after 18s** of standing still at spawn with entry grunts ~4.5 units away (inside `DETECTION_RADIUS` 8 but outside `ENEMY_ATTACK_RANGE` 4). The 70 HP reading is consistent with **HP persistence on deploy** (`progression.js` preserves `player.hp` across sorties per `design.md`) on reused harness accounts, not with chip damage at spawn. After the probe, holding W moves the player toward the bulkhead and HP drops 70→60, confirming grunts still engage once the player advances.

---

## Acceptance criteria

### Launch Initiate Vault tier 1, stand still 3 seconds → 100/100 HP

**Met.** Two complementary server-side fixes:

1. **Bulkhead placement** (`scriptedEncounters.js`): `towardPassage: true` on both room-0 wave-0 grunt spawns offsets them toward the outbound passage bulkhead with lateral spread. `training_caverns_named_rare.test.js` asserts each entry grunt is ≥ `ENEMY_ATTACK_RANGE` (4) from the deploy point and at distinct coordinates.

2. **Aggro grace** (`quests.js` + `scriptedEncounters.js` + `simulation.js`): `aggroGraceMs: 3000` on room-0 wave-0 sets `enemy.aggroGraceUntil`; `updateEnemies()` skips player acquisition and cancels in-progress player windups while grace is active (`isEnemyAggroGraceActive`). Scoped to the authored wave only — not global.

`training_caverns_spawn_camp.test.js` deploys tier 1, advances fake timers 3000 ms with `updateEnemies()` at tick rate, and asserts HP stays 100 while stationary. Re-ran locally: **pass**.

### Grunts still engage once the player moves into the room

**Met.** The regression test walks the player toward entry grunts after grace and asserts a grunt enters `chasing`/`windup`/`recovering` and player HP drops below 100. Browser capture confirms engagement after W-key movement (probe HP 70→60, player `z` 27→19, grunt chased north).

---

## Design & requirements consistency

- Aligns with **Initiate Vault** identity in `design.md` (scripted annex sweep, Kade bulkhead dialogue unchanged).
- Does not alter passage-lock chain, later waves, or Vault Stalker authoring.
- Aggro grace is quest-data scoped (`training_caverns` tier 1 room 0 wave 0 only) — no global combat silence.
- HP persistence on deploy is pre-existing design; this ticket correctly fixes **new-damage during intro**, not medic/heal flow.
- No regression against `requirements.md` foundation (3D render, socket play, movement sync all exercised in capture).

---

## Code quality

- Changes are focused: spawn offset helpers, wave-level `aggroGraceMs`, minimal `simulation.js` guard.
- `simNow()` used consistently for grace timing (matches combat clock).
- Dead-code / obvious bugs: none found.
- Vitest: **4085 tests passed** in `coverage.log`; new `training_caverns_spawn_camp.test.js` included.
- No new `?debugScenario=` shortcuts — nothing to audit on debug gating.

---

## Debug scenarios

Not applicable — this ticket did not add or change development debug scenarios.

---

## Remaining gaps

None blocking. The acceptance criterion is satisfied in code and covered by targeted regression tests. The browser capture does not directly exercise the 3-second standstill check, but runtime evidence plus server simulation on the production layout seed corroborates the fix; the 70 HP first-probe reading is explained by persisted vitals on harness accounts rather than spawn-camp damage.

---

VERDICT: PASS
