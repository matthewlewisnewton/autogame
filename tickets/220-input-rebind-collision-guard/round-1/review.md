# Senior Review — 220-input-rebind-collision-guard

## Runtime health

`metrics.json` reports `"ok": true`, an empty `pageerrors` array, and no
`harness_failure` block. The capture drove the full flow (auth → lobby →
ready → gameplay), reaching `phase: "playing"` with a live scene
(`sceneInitialized: true`, `hasCanvas: true`) and a working dodge/key-item
cooldown probe. `console.log` shows only a transient HTTP 409 during lobby
create (benign harness retry) and the normal Three.js scene init — no
`pageerror` or `[fatal]` from game code. **Game runs cleanly.**

## Acceptance criteria

### AC1 — Reject keys already used by a built-in action, surfacing the existing toast

Met. `input.js:55-65` adds `getReservedKeys()`, which iterates
`DEFAULT_KEYBOARD` and returns the lowercased keys of every action **except**
`useKeyItem` — yielding exactly `{w,a,s,d,1,2,3,4,5,6,v,z}` (the fixed
1-6/wasd/v/z bindings described in the ticket). The `dodge` action has no
default key, so nothing spurious is added.

The key-capture handler at `main.js:3648-3654` now guards before persisting:
on a reserved key it calls `showCardErrorToast('Key already in use')` (the
existing toast defined at `main.js:3506`), aborts capture, blurs the input,
re-syncs the UI, and returns **without** calling `patchSettings`. This
directly addresses the root cause in the goal: binding `useKeyItem` to `1` or
`w` is now blocked instead of silently dead.

Correctly, the guard excludes `useKeyItem`'s own key from the reserved set, so
re-binding it (e.g. `e` → `q` → back) is never self-blocked.

### AC2 — No behavior change for valid binds

Met. For a non-reserved key the new branch is skipped entirely and the
original `patchSettings({ keyboard: { bindings: { useKeyItem: key } } })` path
runs unchanged. Modifier-only keys are still filtered earlier
(`main.js:3644`). Unit test `saves a non-reserved key via patchSettings`
confirms `q` persists and the UI shows `Q`.

## Tests & coverage

New tests are well targeted and pass (188/188 across `input.test.js` +
`main.test.js`):
- `getReservedKeys lists fixed keyboard bindings and excludes useKeyItem`
- `rejects reserved keys without changing the binding and shows a toast`
- `saves a non-reserved key via patchSettings`
- `ignores modifier-only keys with no toast`

## Code quality

Clean, minimal, self-contained change consistent with surrounding input/
settings code. No dead code, no regressions to `onKeyDown` resolution, and no
console errors introduced. Consistent with `design.md`/`requirements.md`
(input remapping is a settings-UI concern only; no net or server invariants
touched). No debug scenarios added.

## Remaining gaps

None blocking.

VERDICT: PASS
