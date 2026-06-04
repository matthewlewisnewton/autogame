# 04 — Migrate remaining lobby handlers to withLobbyPlayer

Finish the refactor for quest selection, ready-up, key items, medic, and card trade handlers — including those with custom phase-mismatch emits or atypical phase rules. After this sub-ticket, the top-level ticket’s handler deduplication is complete.

## Acceptance Criteria

- **Silent lobby phase + player** — migrated to `withLobbyPlayer` with `requirePhase: 'lobby'`:
  - `selectQuest` (no player use in body; still receive `player` or use `_` — phase guard only)
  - `offerCardTrade`
  - `respondCardTrade`
- **Custom phase mismatch** — migrated with `phaseMismatch` preserving exact emit payloads:
  - `equipKeyItem` → `keyItemError` / `{ reason: 'not_in_lobby' }`
  - `medicHeal` → `medicError` / `{ reason: 'not_in_lobby' }`
- **playerReady** — uses `withLobbyPlayer` **without** `requirePhase` (ready is allowed regardless of phase; `checkAllReady` only when `isLobbyPhase(state)` inside body). Player resolution only; no new phase guard at handler entry.
- No remaining copies of the old preamble trio (`withLobbyFromSocket` + `isLobbyPhase` + manual player lookup) on the handlers listed in the parent ticket goal.
- Handlers intentionally left on plain `withLobbyFromSocket` (e.g. `move`, `useCard`, `giveUp`, playing-phase `discardCard`) are unchanged unless they never had the lobby preamble pattern.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **File:** `game/server/index.js`
  - `selectQuest` (~1282–1314)
  - `playerReady` (~1316–1338) — `requirePhase` omitted; keep `if (isLobbyPhase(state)) checkAllReady()`
  - `equipKeyItem` (~1464–1491) — `phaseMismatch: { event: 'keyItemError', payload: { reason: 'not_in_lobby' } }`
  - `medicHeal` (~1694–1715) — same pattern for `medicError`
  - `offerCardTrade` / `respondCardTrade` (~1748–1855)
- Do not migrate `useKeyItem` / `useCard` (delegate to effect modules) in this ticket unless they still contain the duplicate preamble (they should not).

## Verification: code
