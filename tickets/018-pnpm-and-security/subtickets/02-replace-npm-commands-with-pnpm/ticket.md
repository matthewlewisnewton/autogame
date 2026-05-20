# Replace npm Commands with pnpm Everywhere

Update all `npm install` and `npm run` references in `package.json` scripts, `CONTEXT.md`, and harness files to use `pnpm` instead.

## Acceptance Criteria
- `game/package.json` scripts use `pnpm` instead of `npm` (`install:all`, `dev`)
- `CONTEXT.md` "How to Run" section uses `pnpm` commands
- `harness/lib.sh` `PIPELINE_CHECK_COMMAND` default uses `pnpm test`
- `harness/lib.sh` `start_game()` uses `pnpm` / `npx` equivalents (or `pnpm exec`)
- `harness/prompts/implement.md` references `pnpm` instead of `npm`
- No remaining `npm install` or `npm run` references in documentation or scripts (excluding `package.json` "name" fields or resolved URLs in lockfiles)

## Technical Specs
- **Files to modify**:
  - `game/package.json` — change `install:all` to `pnpm install && pnpm install --prefix server && pnpm install --prefix client`; change `dev` to use `pnpm run dev --prefix ...`
  - `CONTEXT.md` — replace `npm run install:all` → `pnpm run install:all`, `npm run dev` → `pnpm run dev`
  - `harness/lib.sh` — change `PIPELINE_CHECK_COMMAND` default from `npm test` to `pnpm test`; update `start_game()` to use `pnpm` (e.g., `pnpm --prefix server run dev` or `node game/server/index.js` directly; `pnpm --prefix client exec vite`)
  - `harness/prompts/implement.md` — replace `npm` with `pnpm` in the dependency installation instruction

## Verification: code
