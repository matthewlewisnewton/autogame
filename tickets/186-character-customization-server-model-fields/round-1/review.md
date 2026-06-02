# Senior Review — 186-character-customization-server-model-fields

## Runtime health (gate)

- `round-1/metrics.json`: `"ok": true`, `pageerrors: []`, servers started at `http://localhost:5177/`, scene initialized, two players reached `phase: "playing"`. No `harness_failure` block.
- `round-1/pageerrors.json`: `[]`.
- `round-1/console.log`: only `[vite] connecting/connected`, two `409 Conflict` resource loads (benign auth/lobby create-join race — not a `pageerror` or `[fatal]`), and `[initScene] Initializing Three.js scene...`. No uncaught exceptions from game code.
- Full server test suite green: `460 passed` (coverage run); targeted run of the four touched suites `91 passed`.

The captured run proves the game starts and loads cleanly with this ticket applied.

## Scope

This is a server-side data-model ticket (`Verification: code`): it adds `modelId`
and `proportions` to the cosmetic schema and threads them through validation,
backfill, persistence, the player record, and the profile API. No client
rendering is in scope. The diff is confined to `game/server/{cosmetic,users,account}.js`
plus their tests — clean and well-contained.

## Per-criterion findings

**01 — Schema constants & defaults** (PASS)
- `MODEL_IDS = ['player']`, `PROPORTION_KEYS` with all six canonical keys, and
  `PROPORTION_RANGES` with the specified `{min,max}` bounds are defined and
  exported via `module.exports`.
- `DEFAULT_COSMETIC` extended with `modelId: 'player'` and a full `proportions`
  object of 1.0 defaults.

**02 — Validation & backfill** (PASS)
- `validateCosmetic()` validates `modelId` against `MODEL_IDS` (rejects non-string
  / unknown ids with a reason), and validates `proportions` as a plain object,
  rejecting arrays/non-objects, unknown keys, non-finite numbers, and
  out-of-range values; valid numbers pass through into `value.proportions`.
- `backfillCosmetic()` restores `modelId` from default when absent/invalid and
  delegates to a new `backfillProportions()` that merges per-key — keeping valid
  in-range user values, replacing missing/out-of-range keys with defaults.
- Existing `bodyColor`/`accentColor`/`bodyShape`/`hat` paths unchanged; all
  prior cosmetic tests still pass.

**03 — Storage integration** (PASS)
- `loadUsers()` backfills legacy records via the now-extended `backfillCosmetic()`.
- `updateProfile()` passes fields through `validateCosmetic()` and, importantly,
  **deep-merges `proportions`** (`merged.proportions = { ...base.proportions, ...result.value.proportions }`)
  so a partial update of one key does not erase the others. This is a correct
  call that the AC implied but did not spell out.
- `buildPlayerRecord()` sources `account?.cosmetic ?? { ...DEFAULT_COSMETIC }`; since
  the account cosmetic is backfilled on load, `modelId`/`proportions` propagate to
  the player record and through `stateSnapshot()` automatically (cosmetic is
  spread as a whole object). Verified `savedData` does not overwrite cosmetic.

**04 — Profile API exposure** (PASS)
- `GET /api/me` now returns `modelIds: MODEL_IDS` and
  `proportionConfig: { keys, ranges }` alongside the existing cosmetic/hat data.
- `PATCH /api/me/profile` already routes `cosmetic` through `updateProfile()`, so
  `modelId`/`proportions` updates are validated and persisted; the echoed payload
  returns the merged `user.cosmetic`.

## Consistency / regressions

Consistent with the existing cosmetic system (hats, body shapes, colors) and the
established validate/backfill pattern. `design.md` and `requirements.md` impose no
contradicting constraints on this schema. No debug scenarios were added. No
regressions: the full 460-test suite passes.

## Remaining gaps

None blocking. The acceptance criteria across all four sub-tickets are fully and
robustly met, and the captured run is healthy.

VERDICT: PASS
