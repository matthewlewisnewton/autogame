# Senior Review: 221-data-debrittle-model-tests

## Runtime health

Captured run is clean:

- `metrics.json`: `"ok": true`, empty `pageerrors`, gameplay probes show `phase: "playing"`, canvas initialized, no `harness_failure`.
- `console.log`: Vite connect + `[initScene]` only; no `pageerror` or `[fatal]` lines.
- Screenshots listed in metrics (lobby → movement → dodge) align with a normal smoke capture; no debug scenario was active (`debugScenario: null`).

**Runtime gate: pass.**

## Commits (baseline `38f3440` → HEAD)

| Commit | Summary |
|--------|---------|
| `82d958f` | Extract `pickVariant(rng, ids)` from `applyVariant` |
| `a1324eb` | De-index `warded_variant.test.js` |
| `86120ba` | Relax `CARD_DEFS` length check |
| `2daebe8` | Split card identity tests into `card_registry.test.js` |

Four focused commits; no game-behavior changes beyond the `pickVariant` extraction (same selection formula as before).

---

## Acceptance criteria

### 1. `pickVariant` seam / explicit variant selection in tests

**Met.**

`game/server/enemyVariants.js` exports `pickVariant(rng, ids)` and `applyVariant` delegates to it:

```83:108:game/server/enemyVariants.js
function pickVariant(rng, ids) {
  const pick = typeof rng === 'function' ? rng() : Math.random();
  return ids[Math.floor(pick * ids.length)];
}
// ...
    const id = pickVariant(rng, ids);
```

`warded_variant.test.js` no longer uses `seqRng([0.01, 0.5])` to hit “index 2 of 5”. The warded apply-path test sets `enemy.variant = 'warded'` and calls `VARIANT_DEFS.warded.apply(enemy)` directly; the no-op test variant case sets `variant = 'test'` explicitly. Assertions are on membership and shield behavior, not RNG→index mapping.

`enemy_variants.test.js` already asserts `Object.keys(VARIANT_DEFS).toContain(enemy.variant)` for the generic tag case.

### 2. Adding a variant is data-only (no re-index churn for existing variants)

**Met for the ticket’s stated pain point; partially met elsewhere.**

The brittle case called out in the ticket (`warded` at index 2 of 5) is fixed. Appending a new key to `VARIANT_DEFS` does not change insertion-order indices of existing keys, so production `pickVariant` behavior for existing ids is stable when variants are added at the end (the natural edit pattern).

`enemy_variants.test.js` still has two tests that use `seqRng([0.01, 0])` and expect `enemy.variant === 'test'` (index 0). That remains safe only while `test` stays the first registry key; inserting a variant before `test` in the object literal would re-break those tests. That predates this ticket and is narrower than the warded regression; see nits.

### 3. Drop global `CARD_DEFS` length lock; split identity checks from combat helper file

**Met.**

- `new_card_pack.test.js` no longer contains the `describe('new card pack definitions')` block or `toHaveLength(42)`.
- New `card_registry.test.js` holds per-card identity checks with `expect(Object.keys(CARD_DEFS).length).toBeGreaterThanOrEqual(42)` and an explicit comment that adding cards should be data-only.
- `new_card_pack.test.js` (~500 lines) is now combat-helper behavior only.

Other files (`card_acquisition.test.js`, `client/test/cards.test.js`) still hard-code `42`; they were outside this ticket’s diff and are noted as follow-up nits, not blocking gaps for AC 3.

### 4. Suite green

**Met.**

- Round-1 `coverage.log`: 72/72 tests in the ticket-touched files passed.
- `npm run test:quick`: **1728/1728** passed (full server + client suite, no coverage gate).
- One flaky failure observed on a single `npm test` run (`key-items.test.js` cooldown timing, diff 6 ms vs tolerance 5 ms); file unchanged by this ticket, and `test:quick` passed on re-run. Not attributed to this work.

---

## Design & regression

- **design.md**: No gameplay, UI, or loop changes; test-harness / seam refactor only.
- **requirements.md**: No server validation, persistence, or replication paths altered.
- **Debug scenarios**: Ticket did not add or change `?debugScenario=` entries; capture used normal lobby → ready → play flow.

---

## Code quality

- `pickVariant` is documented, exported, and used in one place — clear seam for future test stubs.
- `warded_variant.test.js` imports `pickVariant` but does not use it (dead import); harmless at runtime, minor cleanup nit.
- No dead production code introduced.

---

## Remaining gaps

None blocking. Runtime is healthy; all four acceptance criteria are satisfied for the scope of this ticket.

## Nits (non-blocking)

See `nits.md` for backlog items: unused import, remaining `toHaveLength(42)` copies, `enemy_variants` index-0 `test` coupling, optional `pickVariant` unit tests.

VERDICT: PASS
