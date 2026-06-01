# Cleanup nits from 122-key-item-summon-recall

> **Staleness note.** This follow-up ticket was written against commit
> `5996c51` (2026-06-01). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `122-key-item-summon-recall`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale summon_recall mock in client key-item tests

`game/client/test/main.test.js` still mocks `summon_recall` as “Summon Recall” with a teleport description and 15000ms cooldown, while the server registry now uses “Recall Whistle” and 10000ms. Tests pass against the mock, not live defs.

### Acceptance Criteria
- Update `mockKeyItemDefs.summon_recall` name/description/cooldown to match `KEY_ITEM_DEFS` in `progression.js`.
- `pnpm test` client key-item tests still pass.

## Player-visible feedback for no_minions soft-fail

Server correctly returns `reason: 'no_minions'` without burning cooldown; client only `console.warn`s. Players get no HUD cue when blowing the whistle with zero minions.

### Acceptance Criteria
- On `keyItemUsed` with `reason: 'no_minions'`, show a brief non-blocking indicator (e.g. extend `flashKeyItemIndicator` or status line) distinct from cooldown flash.
- Using recall with zero minions does not start cooldown (unchanged server behavior).

## Per-minion ring radius variation

`ringRadiusMin` / `ringRadiusMax` are defined but implementation uses a single midpoint radius (~2m) for every minion. Acceptable for MVP; varying radius per slot would better match “~1.5–2.5m spread.”

### Acceptance Criteria
- Each recalled minion lands at a radius between `ringRadiusMin` and `ringRadiusMax` (e.g. alternate or jitter within band).
- Existing `key-items.test.js` distance assertions still pass with updated tolerances.

## Agent-guided capture for Recall Whistle

Round-1 capture used fallback lobby/movement smoke; recall was never exercised in-browser (probes showed `minions: []`).

### Acceptance Criteria
- Add or extend a development scenario / capture step that equips Recall Whistle, has ≥2 minions, triggers recall, and screenshots minions near the player after `stateUpdate`.
