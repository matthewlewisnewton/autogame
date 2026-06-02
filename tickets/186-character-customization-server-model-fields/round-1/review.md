# Senior Review — 186-character-customization-server-model-fields

## Runtime health (blocking gate)
PASS. The captured run in `round-1/metrics.json` reports `"ok": true`, a non-null
`url` (`http://localhost:5177/`), and an **empty `pageerrors` array**. `console.log`
shows only benign Vite connect + `[initScene]` lines — no `pageerror`, no `[fatal]`.
`server.log` shows both players connecting/disconnecting cleanly with no errors,
servers listening on port 3004. The probe confirms `phase: "playing"`,
`sceneInitialized: true`, `connectionState: "connected"`, two players in-game with
live HP/movement (player moved to x=-3.7, z=-10.2 and took damage 100→94). The game
starts, loads, and plays cleanly.

No `harness_failure` block present. `pageerrors.json` is empty.

## Scope
This is a server-side data-plumbing ticket decomposed into three sub-tickets:
(01) model registry, (02) `bodyModel` in the cosmetic profile, (03) `bodyModel`
wired through the runtime snapshot. No client rendering and no debug scenarios are
in scope, so the DEBUG SCENARIOS gate does not apply. Diff is confined to
`game/server/cosmetic.js`, `game/server/progression.js`, and tests — consistent
with the technical specs.

## Per-criterion findings

### 01 — Model registry
- `BODY_MODELS` and `getAvailableModelKeys()` are exported from
  `game/server/cosmetic.js` (lines ~18-46). ✅
- Registry has the required two entries: `default` (`glbPath: null`, primitive
  fallback) and `player` (`glbPath: 'models/player.glb'`). ✅
- Each entry has `key`, `displayName`, and `glbPath` (string|null). ✅
- `getAvailableModelKeys()` returns `['default', 'player']`. ✅
- **Verified the referenced asset exists**: `game/client/public/models/player.glb`
  is present, so the registry does not point at a missing file. ✅
- `server/test/model_registry.test.js` covers entry count, both entries' fields,
  key/property-key consistency, and the helper. ✅

### 02 — bodyModel in cosmetic profile
- `DEFAULT_COSMETIC` gains `bodyModel: 'default'`. ✅
- `validateCosmetic()` validates a partial `bodyModel` against the allowlist and
  rejects unknown keys with a descriptive reason (→ 400 at the route). ✅
- `backfillCosmetic()` fills missing/invalid `bodyModel` with the default. ✅
- New accounts: `createUser`/`createUserAsync` seed `{ ...DEFAULT_COSMETIC }`
  (includes `bodyModel`). ✅
- `PATCH /api/me/profile`: `updateUserProfile` runs `validateCosmetic`, then merges
  `{ ...backfillCosmetic(user.cosmetic), ...result.value }` — partial `bodyModel`
  update persists while other fields are preserved. ✅
- Legacy records backfilled on load (`users.js` line ~36
  `record.cosmetic = backfillCosmetic(record.cosmetic)`). ✅
- Existing `bodyColor`/`accentColor`/`bodyShape` validation paths unchanged. ✅
- Tests added across `cosmetic.test.js`, `users.test.js`, `account.test.js`. ✅

### 03 — bodyModel in runtime snapshot
- `buildPlayerRecord()` attaches `account?.cosmetic ?? { ...DEFAULT_COSMETIC }`
  (`index.js:1019`); the account cosmetic is backfilled on load, so the field is
  always present, and the no-account fallback includes it too. ✅
- `stateSnapshot()` now emits `cosmetic: { ...DEFAULT_COSMETIC, ...(p.cosmetic || {}) }`
  (`progression.js:3081`). This is a genuine robustness improvement over the prior
  `p.cosmetic ?? {...DEFAULT_COSMETIC}`: a legacy player record carrying a cosmetic
  object that lacks `bodyModel` now still gets a valid default in the snapshot. ✅
- Integration tests added in `cosmetic_runtime.test.js`: PATCH→buildPlayerRecord
  carries updated `bodyModel`; snapshot reflects it for all players; default
  fallback when the key is deleted; and other fields remain unchanged. ✅

## Consistency / regression check
- No contradiction with `game/docs/design.md` (no cosmetic constraints there); the
  change is additive and mirrors the existing `bodyShape` wiring from ticket 181.
- Foundation untouched: the only non-test production change to `progression.js` is a
  safer spread that strictly widens the prior behavior.
- All 77 server tests across the five touched suites pass locally.

## Remaining gaps
None. All acceptance criteria across the three sub-tickets are fully and robustly
met, the game runs and plays cleanly, and tests pass.

VERDICT: PASS
