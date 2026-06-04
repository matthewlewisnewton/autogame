# Senior review: 221-data-debrittle-model-tests

## Runtime health (capture gate)

Round-2 capture is clean:

- `metrics.json`: `"ok": true`, empty `pageerrors`, no `harness_failure`, no `failure_kind`.
- `console.log`: Vite connect + scene init only; no `pageerror` or `[fatal]` lines. The `409 (Conflict)` lines on auth are harness noise, not game defects.
- Probes show normal lobby → gameplay flow (connected, canvas, hand visible, dodge cooldown exercised).

**Runtime gate: PASS.**

## Acceptance criteria

### 1. Variant selection seam + membership/effect assertions (not RNG→index)

**`pickVariant(rng, ids)` seam** — Implemented and exported from `game/server/enemyVariants.js`. `applyVariant` delegates id selection to `pickVariant` after the tier-scaled roll; production behavior is unchanged aside from the extracted function.

**Tests** — The ticket’s churn sources are fixed:

- `warded_variant.test.js` no longer drives `applyVariant` with `seqRng` expecting a fixed registry index. Warded behavior is asserted by setting `enemy.variant = 'warded'` and invoking `VARIANT_DEFS.warded.apply`, or by checking shield fields after explicit tagging.
- `enemy_variants.test.js` asserts `Object.keys(VARIANT_DEFS).toContain(enemy.variant)` for tagged enemies and uses explicit `enemy.variant = 'test'` for the no-op case instead of index math.

**Criterion met** for the files called out in the ticket. One related test elsewhere still pins the first registry key when RNG is stubbed to `0.1` (`server.test.js` ~4706: `expect(enemy.variant).toBe(ids[0])`); that was not in this ticket’s diff and is filed as a nit, not a blocker.

### 2. Adding a variant is data-only (tests do not re-index existing)

New variants are added to `VARIANT_DEFS` only; `pickVariant` reads `Object.keys(VARIANT_DEFS)` at runtime. Tests no longer encode “index 2 of 5 → warded” or similar. Inserting a variant at the end of the registry does not force updates to warded/enemy_variants tests.

**Criterion met.**

### 3. CARD_DEFS length assertion debrittled

Hard `toHaveLength(42)` is gone from the card-pack path. Replaced with `toBeGreaterThanOrEqual(42)` and a `// baseline: 42 cards as of initial pack` comment in:

- `game/server/test/new_card_pack_definitions.test.js`
- `game/server/test/card_acquisition.test.js`
- `game/client/test/cards.test.js`

**Criterion met.**

### 4. Per-card identity checks split into a small file

Card definition identity checks (eleven pack cards + Permafrost Lance + shop pool) live in `game/server/test/new_card_pack_definitions.test.js` (53 lines). `game/server/test/new_card_pack.test.js` is combat-helper focused (~517 lines) and no longer carries the global length/type block.

**Criterion met.**

### 5. Suite green

Round-2 `coverage.log`: 9 files, **98/98 tests passed** on changed-scope coverage run.

Local verification:

- Ticket-focused vitest: **49/49 passed** (enemy_variants, warded_variant, new_card_pack, new_card_pack_definitions).
- Full `npm test`: **1754/1754 tests passed**; exit code 1 is from global coverage thresholds (62% vs 70% floor), not test failures — pre-existing project gate, outside this ticket’s AC.

**Criterion met.**

## Design & foundation consistency

- **design.md**: No gameplay or architecture changes; test/plumbing only. Aligns with “rename-first, cut-later” — no card or variant behavior altered.
- **requirements.md**: Capture proves 3D render, WebSocket play, movement, and multiplayer session still work. No regression observed.

## Code quality

- `pickVariant` is small, documented, and exported for testability without changing spawn semantics.
- Warded tests are clearer (direct registry hook vs brittle RNG choreography).
- Minor: `enemy_variants.test.js` imports `pickVariant` but does not use it (unused import nit).

## Debug scenarios

No new or changed `?debugScenario=` paths in this ticket’s commits. N/A.

## Commits (baseline `9134e7d` → HEAD)

| Commit | Summary |
|--------|---------|
| `713c1f6` | Extract `pickVariant(rng, ids)` |
| `cd83081` | De-index warded variant tests |
| `27f2529` | De-index enemy_variants tests |
| `d51e09c` | `>= 42` card count assertions |
| `41360f3` | Suite-green verification |
| `9e484b0` | Split `new_card_pack_definitions.test.js` |

## Remaining gaps

None blocking. Runtime is healthy; all five acceptance criteria are satisfied for the churn generators and test layout described in the ticket.

## Nits (non-blocking)

See `nits.md` for follow-up backlog items (unused import, residual `ids[0]` assertion in `server.test.js`).

VERDICT: PASS
