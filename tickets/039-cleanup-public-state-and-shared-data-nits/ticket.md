# Cleanup Nits from Current Codebase Review

> **Staleness note.** These nits were written against commit `c8f0a9e`
> (2026-05-19), with local uncommitted `030-encounter-telegraphs-audio` client
> edits present in the working tree. Reviewer and implementer: re-check every
> file path and code reference against the CURRENT code before acting. These
> notes may be stale by the time this ticket is picked up; skip anything already
> resolved.

Minor, non-blocking nits found during a current-codebase review. None of these
should interrupt active gameplay work unless they become directly relevant.

## Build explicit public state snapshots

`game/server/index.js` currently creates state updates with a shallow copy:

```js
function stateSnapshot() {
  const snapshot = { ...gameState };
  delete snapshot.layout;
  return snapshot;
}
```

This sends implementation details unless each future caller remembers to strip
them. For example, internal fields such as `_victoryCounters` can appear after
reward grants, and player objects include server-only/non-serializable fields
such as `pendingSummons` sets. The client does not appear to need those fields.

### Acceptance Criteria

- Replace the shallow-copy snapshot with an explicit public snapshot builder.
- Do not send `layout` in recurring `stateUpdate` events.
- Do not send internal bookkeeping fields such as `_victoryCounters`.
- Do not send non-client player internals such as `pendingSummons`.
- Existing client UI still receives the fields it uses for players, enemies,
  minions, loot, run state, phase, bounds, and currency.
- Add or update a server unit/integration test that asserts internal fields are
  absent from `stateSnapshot()` or a captured `stateUpdate`.

## Deduplicate card and deck constants shared by server and client

Card definitions and deck limits are currently mirrored in both:

- `game/server/index.js`
- `game/client/cards.js`

The comments explicitly say the server copy mirrors the client copy. That is
fine for early iteration, but it creates drift risk as more cards/rewards/deck
rules are added.

### Acceptance Criteria

- Move card definitions and deck size constants to a single shared source that
  both server and client can consume, or add a small test that asserts the two
  copies are in sync.
- Preserve current card ids, names, types, charges, costs, and server damage
  values.
- Preserve the current starting deck composition and owned-card counts.
- `npm test -- --coverage.enabled=false` passes.

## Avoid per-frame telegraph flash resets

In the current `game/client/main.js`, enemy wind-up rendering calls `flashMesh`
inside the animation loop while `enemy.attackState === 'windup'`. That can
schedule many overlapping restore timers during one wind-up. It may be visually
fine now, but it makes material restoration timing harder to reason about and
can become noisy as telegraph visuals grow.

### Acceptance Criteria

- Enemy wind-up visuals do not start a new `flashMesh` timer every animation
  frame for the same enemy.
- Telegraph creation/update/removal remains clear in screenshots.
- Existing enemy hit flash behavior still works.
- Add a focused client test if a helper is extracted; otherwise verify with the
  visual QA checklist for `030-encounter-telegraphs-audio`.

## Centralize mesh disposal helpers

`game/client/main.js` has several repeated loops that remove meshes from the
scene, dispose geometry/material, and delete entries from tracking maps
(`enemiesMeshes`, `enemyHealthBars`, `telegraphMeshes`, `minionsMeshes`, etc.).
The repeated pattern increases the chance that one cleanup path forgets to
dispose a material or deletes without disposal.

### Acceptance Criteria

- Introduce one small helper for disposing/removing a tracked mesh map, or
  otherwise reduce the repeated cleanup loops.
- Preserve the special cases where materials are intentionally shared and should
  not be disposed.
- The second-run cleanup path and removed-entity cleanup path still remove the
  right meshes.
