# Senior Review — 147 Cleanup nits from key item input bindings and settings

## Runtime health

The captured run is clean. `metrics.json` reports `"ok": true`, `pageerrors: []`,
and a `playing` phase with two connected players and an initialized scene.
`console.log` contains no `pageerror` or `[fatal]` lines from game code — only a
benign `vite connecting/connected` pair and a `409 Conflict` on a resource fetch
(lobby create idempotency, not a crash). The game starts, loads, and reaches
gameplay. **Runtime health: PASS.**

## Acceptance Criteria

This follow-up ticket bundles two cleanup nits.

### Nit 1 — Profile-aware gamepad hint for key item binding

- **"When profile is `8bitdo-64` … `gamepadHint` uses that profile's `buttonLabels`
  for the resolved index."** — MET. `getUseKeyItemBinding()`
  (`game/client/input.js:433-439`) now branches on `is8BitDo64HandHintsActive()`
  and looks up `EIGHTBITDO_64_PROFILE.buttonLabels` by index, falling back to
  `Btn N`. For the default `useKeyItem` index 13, that resolves to "Stick click"
  on the 8BitDo profile (`gamepad-profiles.js:320`) versus the standard
  "D-pad Down". The `is8BitDo64HandHintsActive()` helper correctly handles
  explicit `8bitdo-64` and the `auto` path that detects an attached 8BitDo pad.
- **"Unit test covers 8BitDo profile hint text vs standard profile for the same
  default index."** — MET. `input.test.js:364-375` asserts the standard hint is
  "DPad Down", the 8BitDo binding resolves index 13 to "Stick click", and the two
  differ. Full suite passes (32/32).

### Nit 2 — Pass equipped key item id on `useKeyItem` emit

- **"On `onUseKeyItem`, emit `{ keyItemId }` from the player's equipped key item
  (or skip emit when none equipped)."** — MET. `main.js:741-755` only emits when
  `me.equippedKeyItemId` is set, sends `{ keyItemId: me.equippedKeyItemId }` for
  ordinary items, and a `{ keyItemId: 'phase_step', targetPlayerId }` variant for
  the targeted item. This work predates the ticket baseline; per the ticket's
  staleness note, an already-resolved nit is correctly left as-is and no longer
  appears in the diff.
- **"press `e` in dungeon with dodge equipped → `keyItemUsed` with `ok: true` …
  other than `missing_key_item_id`."** — MET, proven by capture. The dodge probe
  shows `equippedKeyItemId: "dodge_roll"`, the dodge executed (player moved
  -9,9 → -10.9,-9.6), and the cooldown engaged afterward
  (`keyItemCooldownRemaining: 359`, HUD indicator "0.4", then "0.1"), with no
  rejection error in the console. The server clearly received a valid
  `{ keyItemId }`.

## Code quality

- The new branch is small, readable, and matches surrounding style. No dead code,
  no console errors, no leftover debug paths. No new `?debugScenario` shortcuts
  were introduced (`debugScenario: null`, `debugScenarioAllowed: true` in probes).
- Consistent with `design.md`: profile-aware control glyphs are exactly the
  intent of the gamepad-profiles abstraction; no foundation regression.

## Remaining gaps

None. Both acceptance criteria are fully and robustly met, the unit suite passes,
and the captured run is healthy.

VERDICT: PASS
