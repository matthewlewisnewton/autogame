# Senior Review: test hooks `__openDeckBoothForTest` / `__openShopBoothForTest`

**Ticket:** Bind booth deps on window test hooks so zero-arg calls no longer throw.  
**Baseline:** `e44dcccd2843537bce7df9451775c79dd47a7b54`  
**Commits:** `5a13ab85` — `test-hooks-opendeckboothfortest-openshopboothfortest-throw-t-uvx1/01-bind-booth-test-hook-deps`

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` `pageerror` / `[fatal]` | none |

The captured run started Vite on `:5177`, initialized the Three.js scene for both players, progressed through lobby ready-up into dungeon gameplay (Initiate Vault), and completed movement/dodge probes without uncaught exceptions. The `409 (Conflict)` resource lines in `console.log` are auth registration noise, not game fatals. Runtime proof is clean.

## Per-criterion findings

### Calling `window.__openDeckBoothForTest()` with no arguments opens the deck booth without throwing

**Met.** `main.js` now wraps the booth opener with the same `deckBoothDeps` object already used by `registerDeckBoothListener` and `createRequestDebugBoothOpener`:

```1784:1785:game/client/main.js
window.__openDeckBoothForTest = () => openDeckBooth(deckBoothDeps);
window.__openShopBoothForTest = () => openShopBooth(shopBoothDeps);
```

`deckBoothDeps` supplies `{ showGameLobby, setLobbyTab, renderDeckEditor }` (lines 1212–1213), which satisfies `openBooth(deps)` in `boothCommon.js` (calls `deps.showGameLobby()`, `deps.setLobbyTab(tab)`, `deps[renderDepKey]()`).

`lobby-menu-dismiss.test.js` calls `window.__openDeckBoothForTest()` with no args after `dismissGameLobby()` and asserts `#lobby` is visible, the dismissed flag is cleared, and `#deck-editor` is revealed. Test passes in `coverage.log`.

### Calling `window.__openShopBoothForTest()` with no arguments opens the shop booth without throwing

**Met.** Same pattern using `shopBoothDeps` (`{ showGameLobby, setLobbyTab, renderCardShop }`). The vitest case calls `window.__openShopBoothForTest()` with no args and asserts `#lobby` visibility, dismissed-flag reset, and `#card-shop` revealed. Test passes.

### Harness verification (vitest server+client)

**Met.** `coverage.log` reports **20 test files, 321 tests passed** (including `lobby menu dismiss guard > __openDeckBoothForTest and __openShopBoothForTest show #lobby when wired through main`). No test failures on changed files.

## Design & regression

- **Scope:** Test-hook wiring only; no gameplay, server, or booth-module logic changed.
- **`game/docs/design.md`:** No conflict. Booth open flow still goes through the shared `openBooth(deps)` path used by `booth:action` listeners and debug openers.
- **Foundation:** No changes to auth, simulation, or persistence. Normal booth interaction (`dispatchBoothAction`, hub zone interact, `?booth=` debug openers) is untouched.

## Code quality

- Minimal, correct fix: reuses existing `deckBoothDeps` / `shopBoothDeps` rather than duplicating dep objects.
- No dead code introduced; no new console errors in capture or tests.
- Test updated to exercise the documented zero-arg API instead of manually constructing deps (which masked the production bug).

## Debug scenarios

This ticket did not add or change any `?debugScenario=` shortcuts. Existing `?booth=` debug openers already passed deps correctly via `createRequestDebugBoothOpener` / `createRequestDebugShopBoothOpener`; only the window test hooks were broken. No debug-path gating or normal-gameplay bypass concerns apply.

## Integration notes

- Single sub-ticket (`01-bind-booth-test-hook-deps`) covers the full top-level acceptance criteria.
- Browser capture used the fallback full-flow smoke plan (auth → lobby → deploy → dungeon movement/dodge); it does not invoke the booth test hooks directly, but vitest provides direct hook coverage and the runtime capture confirms the game loads and plays cleanly with the change applied.

## Remaining gaps

None. The TypeError from calling unbound `openDeckBooth` / `openShopBooth` without a deps argument is fixed, covered by unit test, and the game runs cleanly in capture.

VERDICT: PASS
