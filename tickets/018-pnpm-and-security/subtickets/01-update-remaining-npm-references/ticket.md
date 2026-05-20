# Update Remaining npm References to pnpm

Replace the last remaining `npm run` and `npm test` references in `CONTEXT.md` and harness scripts with `pnpm` equivalents. The lockfile migration and `game/package.json` scripts are already done.

## Acceptance Criteria
- `CONTEXT.md` "How to Run" section uses `pnpm run install:all` and `pnpm run dev` instead of `npm run`
- `harness/lib.sh` `PIPELINE_CHECK_COMMAND` default uses `pnpm test` instead of `npm test`
- `harness/prompts/implement.md` references `pnpm` instead of `npm` for dependency installation
- No remaining `npm run` or `npm install` or `npm test` references in documentation or harness scripts (excluding lockfiles or unrelated strings)

## Technical Specs
- **Files to modify**:
  - `CONTEXT.md` — replace `npm run install:all` → `pnpm run install:all`, `npm run dev` → `pnpm run dev`
  - `harness/lib.sh` — change `PIPELINE_CHECK_COMMAND` default from `npm test -- --coverage.enabled=false` to `pnpm test -- --coverage.enabled=false`
  - `harness/prompts/implement.md` — replace "npm dependencies" with "pnpm dependencies" (line 26)

## Verification: code
