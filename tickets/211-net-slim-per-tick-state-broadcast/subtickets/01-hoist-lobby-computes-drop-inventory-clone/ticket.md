# 01 — Hoist lobby computes and drop per-tick inventory clone

Reduce `stateSnapshot()` CPU/GC cost without changing the wire shape or client behavior. Compute lobby-scoped fields once per snapshot call, and stop deep-cloning every player's `inventory` on the 20Hz tick path.

## Acceptance Criteria

- `ensureShopOffer()` and `buildSuspendedRunSummary()` are each invoked at most once per `stateSnapshot()` call (not inside the per-player loop).
- `stateSnapshot()` no longer maps/clones `player.inventory` on every call; inventory in the emitted payload is the live array reference (or an equivalent no-clone representation).
- The `stateUpdate` payload shape is unchanged: all existing player and lobby fields still appear on tick broadcasts.
- Existing `stateSnapshot()` unit tests in `game/server/test/server.test.js` pass with at most expectation tweaks for reference semantics (not field removal).

## Technical Specs

- **`game/server/progression.js`**
  - In `stateSnapshot()` (~2784–2845): hoist `const shopOffer = ensureShopOffer()` and `const suspendedRunSummary = buildSuspendedRunSummary(_gameState.suspendedCheckpoint)` before the `for (const [id, p] of Object.entries(_gameState.players))` loop; use those locals in the returned object.
  - Remove `p.inventory.map(instance => ({ ...instance }))`; emit `inventory: p.inventory` (preserve `undefined` when absent, same as today).
  - Do not remove or rename any snapshot fields in this sub-ticket.
- **`game/server/test/server.test.js`**
  - Adjust `stateSnapshot() — explicit public snapshot` tests if they assumed deep-cloned inventory instances; add an assertion that two consecutive snapshots share the same `inventory` array reference when inventory is unchanged.

## Verification: code
