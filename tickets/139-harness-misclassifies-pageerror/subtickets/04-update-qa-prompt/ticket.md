# Update QA prompt to surface browser page errors

The per-iteration code QA prompt (`harness/prompts/qa-code.md`) reads `console.log` and `metrics.json` but does not explicitly check for browser page errors. Today a sub-ticket can pass QA even though the game's browser page is broken at module load (because the diff looks fine and the QA prompt doesn't look for pageerror lines).

## Acceptance Criteria

- The QA prompt instructs the code reviewer to check `console.log` for `[pageerror]` lines and `pageerrors.json` (when present) for non-empty arrays.
- If page errors are found from the game's own code (not benign noise), the sub-ticket is `VERDICT: FAIL` regardless of whether the diff looks correct.
- The prompt lists the specific artifacts to check: `console.log` (grep for `pageerror`), `pageerrors.json`, and `metrics.json.pageerrors`.
- The prompt distinguishes genuine page errors from benign noise (THREE.js deprecation, WebGL context lost/restored, Vite ws proxy / EPIPE).

## Technical Specs

- **File**: `harness/prompts/qa-code.md`
- After the "Runtime evidence" section, add a new paragraph:
  > **Browser page errors — hard fail.** Before judging acceptance criteria, check `console.log` for lines tagged `[pageerror]` and `pageerrors.json` (if present) for a non-empty array. Any uncaught error from the game's own code is a hard `VERDICT: FAIL` — the game does not load. Ignore only benign noise: THREE.js deprecation warnings, headless-WebGL "context lost/restored", Vite `ws proxy` / `EPIPE`.
- Also add `@__ARTIFACTS_DIR__/pageerrors.json` to the runtime evidence list (with "if present" qualifier).

## Verification: code
