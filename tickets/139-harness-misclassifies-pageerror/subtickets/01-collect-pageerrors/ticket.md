# Collect structured page errors from Playwright capture

Currently `screenshot.mjs` logs uncaught page errors to `console.log` as `[<tag>:pageerror]` lines, but never writes structured data. Downstream steps (capture_run diagnostics, review prompt, QA prompt) need a machine-readable source with file:line and stack info.

## Acceptance Criteria

- A `pageerrors` array is collected at module scope in `screenshot.mjs`.
- Every `page.on('pageerror', …)` event pushes a structured object `{ message, sourceURL, line, column, stack }` into the array. `sourceURL`, `line`, `column` are parsed from the Error's `stack` string (first meaningful frame).
- After the recipe finishes (in the `finally` block), `pageerrors.json` is written to `<outDir>/pageerrors.json` as a JSON array.
- If no page errors occur, `pageerrors.json` is written as `[]`.
- The existing `[<tag>:pageerror]` lines in `console.log` are **preserved** (no regression).
- `metrics.json` gains a top-level `pageerrors` key containing the collected array (capped at first 10 entries).

## Technical Specs

- **File**: `harness/screenshot.mjs`
- Add `const pageerrors = []` at module scope (near existing `const logs = []`).
- In `wire(page, tag)`, replace the one-liner `page.on('pageerror', …)` with a handler that:
  1. Pushes the tagged line to `logs` (existing behavior — keep it).
  2. Parses `e.stack` to extract `sourceURL`, `line`, `column` from the first frame (regex: `/\\((.+):(\d+):(\d+)\\)/` or `/at\s+([^@]+):(\d+):(\d+)/`).
  3. Pushes `{ message: e.message, sourceURL, line, column, stack: e.stack || '' }` to `pageerrors`.
- In the `finally` block:
  - Add `pageerrors: pageerrors.slice(0, 10)` to the `metrics` object before serializing.
  - Write: `writeFileSync(join(outDirAbs, 'pageerrors.json'), JSON.stringify(pageerrors, null, 2) + '\n')`.

## Verification: code
