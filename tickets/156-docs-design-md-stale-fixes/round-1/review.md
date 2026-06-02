# Senior Review: 156-docs-design-md-stale-fixes

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `harness_failure` | absent |
| `console.log` | No `pageerror` or `[fatal]` lines; only Vite connect and `[initScene]` logs |

Capture shows a full smoke flow: lobby → ready → playing, movement (W/D), canvas and HUD present. Screenshots match probes (2 players in lobby, then in-run with 6-card hand, MS/HP HUD, enemies).

## Acceptance criteria

### Only `game/docs/design.md` is modified (no `game/server/` or `game/client/`)

**Met.** `git diff aa963b34..HEAD --name-only` shows no paths under `game/server/` or `game/client/`. The only game change is `game/docs/design.md`.

Four `tickets/156-docs-design-md-stale-fixes/subtickets/*/ticket.md` files were also added in the branch commits. Those are harness decomposition artifacts, not game/runtime code, and align with how this ticket was executed. They do not violate the intent of keeping runtime untouched.

### At least one genuinely stale/incorrect statement corrected

**Met.** Multiple factual corrections verified against code:

| Doc claim (updated) | Code source |
|---------------------|-------------|
| Deck max 24 | `DECK_MAX_SIZE = 24` in `game/server/config.js` and `game/client/config.js`; test `DECK_MAX_SIZE is 24` |
| Hand max 6 | `MAX_HAND_SLOTS = 6` in `game/server/config.js`; tests expect `hand` length 6 |
| Card types Techniques/Invocations/Bound Forms/Arcana with `weapon`/`spell`/`creature`/`enchantment` | `game/shared/theme.json` `cardTypes` |
| Mystic Signal (MS) player-facing currency | `game/shared/theme.json` `resource.full`; client HUD uses `MS` label |
| Lobby browser fields `id`, `name`, `hostId`, `gamePhase`, `selectedQuestId`, `playerCount`, `players` | `lobbySummary()` in `game/server/lobbies.js` |
| `gamePhase` `'lobby'` / `'playing'` | Used throughout server tests and lobby state |
| Floor slope movement via `sampleFloorY()` (not ticket 117) | `sampleFloorY` in `game/shared/floorSampling.esm.js`; player height sampling in server/client collision paths |
| Terminology squad → lobby | Matches `lobbies.md` and in-game theme strings ("Lobby Connection", etc.) |

### Structure and headings preserved; surgical edits only

**Met.** All original top-level sections remain (`Overview`, `Core Loop`, `Run Suspend / Resume`, `Combat Mechanics`, `Future Mechanics`). Subsections `Floor Geometry`, `Card Types`, and `Playtesting Notes` are intact. One small addition, `### Player-Facing Currency`, supports the Mystic Signal correction without restructuring the doc. No sections were deleted.

### Every edit reflects real current behavior (no speculation)

**Met.** Cross-checked the diff claims above against `config.js`, `lobbies.js`, `theme.json`, `floorSampling.esm.js`, and capture probes (e.g. 6 hand slots, `MS` in HUD, `gamePhase: playing`, themed card names like "Rust-Forged Saber" / "Signal Familiar").

## Consistency with `design.md` / `requirements.md`

- **`requirements.md`**: No changes; foundation (3D render, WebSocket, multiplayer, movement sync) unchanged. Capture confirms all four pillars still work.
- **`lobbies.md`**: Updated lobby-browser wording in `design.md` now matches the dedicated lobby architecture doc and `lobbySummary()` shape.
- **Internal consistency**: Combat section correctly uses Mystic Signal / themed type names. One leftover uses the old currency label in the Telepipe bullet (see nits — non-blocking).

## Code quality

Docs-only ticket; no game code edits. No new debug scenarios (`debugScenario: null` throughout capture). No console/page errors.

## Debug scenarios

Not applicable — this ticket did not add or change `?debugScenario=` shortcuts.

## Commits (since `aa963b34`)

```
47fb013 01-combat-mechanics-values: deck/hand sizes, card types, Mystic Signal
6d29346 02-terminology-sweep: squad → lobby
7c77436 03-ticket-ref-and-floor-geometry: remove ticket 117 ref; sampleFloorY
23f81aa 04-core-loop-lobby-details: lobby browser fields from lobbySummary()
```

## Remaining gaps

None blocking. Runtime proof is clean; acceptance criteria are satisfied.

### Nits (non-blocking)

- **Telepipe currency label**: Run Suspend section still says "0 Magic Stones" while Combat Mechanics now documents **Mystic Signal (MS)** as the player-facing name. Cost is correct (`magicStoneCost: 0` on `telepipe` card); label is inconsistent. Filed in `nits.md`.
- **Overview phrasing**: "gather in a lobby, join lobbies" is grammatically awkward but not factually wrong after the squad→lobby sweep.

## Coverage

`coverage.log` reports no test files matched for changed game paths (expected for a docs-only diff).

VERDICT: PASS
