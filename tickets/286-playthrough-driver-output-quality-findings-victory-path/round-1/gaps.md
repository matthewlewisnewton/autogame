1. Open-plaza validation `console.log` accumulates stale console errors across reruns, contradicting `findings.md` which reports no console/page errors.
   Files: `harness/validate/lib/consoleLog.mjs`, `harness/validate/playthrough.mjs`, `game/validation/open-plaza/console.log`, `game/validation/open-plaza/findings.md`
   Fix: clear or overwrite the output console log at the start/end of each validation run instead of appending stale entries, then rerun `cd game && pnpm validate:open-plaza` and ensure `findings.md` matches the regenerated clean `console.log`.
