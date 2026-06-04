# Senior review: 221-data-debrittle-model-tests

**Baseline:** `9134e7d23e986ee80812dc4c3459d30208c6abca`  
**Branch commits:** 5 (`01-extract-pickvariant-seam` … `05-suite-green`)  
**Scope:** Test-harness debrittling for enemy variant RNG index mapping and `CARD_DEFS` count assertions. No gameplay or debug-scenario changes.

---

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` | Pass (Vite connect + scene init only) |
| Gameplay probes | Lobby → playing, canvas, hand, movement, dodge cooldown HUD |

The captured run is valid proof the working tree loads and plays. No harness infra failure.

---

## Acceptance criteria

### 1. `pickVariant` seam / tests assert membership + effect, not RNG→index

**Pass.**

`pickVariant(rng, ids)` is extracted, exported, and used by `applyVariant`:

```89:91:game/server/enemyVariants.js
function pickVariant(rng, ids) {
  const pick = typeof rng === 'function' ? rng() : Math.random();
  return ids[Math.min(ids.length - 1, Math.floor(pick * ids.length))];
```

- `warded_variant.test.js` no longer uses `seqRng([0.01, 0.5])` / “index 2 of 5”. Warded cases set `enemy.variant = 'warded'` and call `VARIANT_DEFS.warded.apply` directly.
- `enemy_variants.test.js` “no-op test variant” sets `enemy.variant = 'test'` instead of relying on `seqRng([0.01, 0])` landing on key order index 0.
- Remaining `applyVariant` integration tests use `seqRng` only to drive tag-or-not and assert `Object.keys(VARIANT_DEFS).toContain(enemy.variant)` — not a fixed slot index.

### 2. Adding a variant is data-only (tests do not re-index existing)

**Pass (test layer).**

Tests no longer encode registry key order. New variants can be appended to `VARIANT_DEFS` without updating index-based expectations.

**Note:** Production selection still maps `rng()` to `Object.keys(VARIANT_DEFS)` positions (unchanged behavior). Inserting a key in the middle of the literal would still shift runtime RNG buckets — that predates this ticket and is outside the stated test-churn goal.

### 3. Drop global `CARD_DEFS` length assertion; split per-card identity out of 567-line combat-helper file

**Partial — blocking.**

**Length assertion — pass.** All four former `toHaveLength(42)` sites now use `toBeGreaterThanOrEqual(42)` with a `// baseline: 42 cards as of initial pack` comment:

- `game/server/test/new_card_pack.test.js`
- `game/server/test/card_acquisition.test.js` (both `CARD_DEFS` and `cardDefsJson`)
- `game/client/test/cards.test.js`

**Split — not done.** `game/server/test/new_card_pack.test.js` remains **567 lines** with two `describe` blocks in one file:

- `new card pack definitions` (~50 lines) — per-card type/field identity
- `new card combat helpers` (~460 lines) — simulation/combat behavior

The top-level ticket explicitly requires splitting identity checks out so **a new card touches one small file**. Today, adding a pack card still requires editing this monolith (definitions block plus combat block). Client-side `cards.test.js` already holds many per-card `toMatchObject` checks, but that does not satisfy the server-side split asked for in the ticket text.

### 4. Suite green

**Pass (test assertions); note on `pnpm test` exit code.**

- `pnpm test:quick`: **1754/1754** tests pass.
- Full `pnpm test`: all **1754** tests pass; exit code **1** due to global coverage thresholds (62% vs 70% configured in `vitest.config.js`) — same threshold config at baseline; not introduced by this diff.
- Round-1 `coverage.log`: 98 tests on changed paths, all pass.

Sub-ticket `05-suite-green` asked for `pnpm test` with zero failures including coverage gates; that gate was already failing before this ticket’s functional changes. For this debrittling ticket, **all test cases are green**; the coverage threshold is a separate, pre-existing CI concern.

---

## Design & regression

- **design.md / requirements:** No production gameplay, persistence, or net-replication changes. `enemyVariants.js` refactor is a pure extract of existing selection logic.
- **Debug scenarios:** None added or modified.
- **Merge-conflict sources addressed:** Variant index assertions and exact card count assertions removed as intended.

---

## Code quality

- Changes are minimal and focused (6 game files, ~30 net lines in game code).
- `pickVariant` is imported in `enemy_variants.test.js` but unused (harmless; tests prefer direct `variant` assignment).
- No dead production code introduced.

---

## Remaining gaps

1. **AC3 split incomplete:** Per-card identity checks for the new card pack remain inside `new_card_pack.test.js` alongside combat-helper tests. Adding a card still edits the 567-line file instead of a dedicated small definitions file.

---

## Nits (non-blocking)

See `nits.md` if present: unused `pickVariant` import, monolith file structure follow-up, pre-existing coverage gate.

---

VERDICT: FAIL
