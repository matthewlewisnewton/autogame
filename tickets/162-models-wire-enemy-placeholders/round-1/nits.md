## Dead `scaleBy: 'footprint'` branch in normalizeLoadedModel
`MODEL_FIT` only ever sets `scaleBy: 'height'`, so the `fit.scaleBy === 'footprint'`
branch in `normalizeLoadedModel` (and the redundant trailing footprint fallback)
is unreachable. Either wire up a real footprint-driven case or drop the dead
branch to keep the scaling logic clear.
### Acceptance Criteria
- `normalizeLoadedModel` has no unreachable scaling branches, or `MODEL_FIT`
  legitimately produces a `scaleBy: 'footprint'` entry that a test exercises.

## Noisy GLTFLoader stack trace in client test output
Running the client suite prints a multi-line `TypeError: Invalid URL:
/models/miniboss.glb` stack trace from `main.test.js`, because GLTFLoader can't
fetch a root-relative URL under jsdom. The fallback works correctly (resolves
null, procedural stays), but the trace is alarming in CI logs.
### Acceptance Criteria
- The client test run no longer prints an uncaught-looking GLTFLoader URL stack
  trace (e.g. mock `loadModel`/GLTFLoader in the affected test, or assert the
  warning quietly) while keeping the fallback behavior covered.
