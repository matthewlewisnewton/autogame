# Senior Review: Per-quest signature card rewards

**Ticket:** Replace the single global victory rotation with per-quest signature card pools; surface the signature reward on the quest board.

**Baseline:** `e35b4cd6ffcc08175a3b5675021dbed24bc68fa4`  
**Commits:** `706edbce` (server selection), `3685eb1c` (quest board display)

---

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes |
| `pageerrors` | Empty `[]` |
| `console.log` fatal/pageerror lines | None |
| Servers started | Yes (`http://localhost:5177/`) |

The captured run loads cleanly: auth, lobby ready-up, deploy into `training_caverns` gameplay, movement, and dodge-roll probes all succeeded. No browser page errors and no harness infrastructure failure.

**Note:** Round-1 capture used the deterministic fallback smoke plan (default `training_caverns` vault run), not a quest-board or frost-crossing victory screenshot. Acceptance for this ticket is substantiated by targeted unit/integration tests and sub-ticket visual QA; the generic capture only proves the game still runs.

---

## Acceptance criteria

### 1. Winning `frost_crossing` offers its signature card in the reward choices

**Met.** `buildCardChoices` in `game/server/progression.js` looks up the active run's quest/tier via `getSignatureCardId`, unshifts the signature card (deduped, capped at `MAX_CARD_CHOICES`). `grantRunRewards` on victory assigns `pendingCardChoices` from that builder.

`game/server/test/quest_signature_rewards.test.js` proves:
- `frost_crossing` with drops → `pendingCardChoices` is `['ice_ball', …]` with `ice_ball` first.
- No drops (`runCardDropIds = []`) → sole choice is `ice_ball`.
- Empty-choices fallback rotates through `['ice_ball', 'frost_nova', 'permafrost_lance']`.

Tier defs in `game/server/quests.js`: `signatureCardId: 'ice_ball'`, `rewardCards: ['ice_ball', 'frost_nova', 'permafrost_lance']`.

### 2. Winning `training_caverns` does not offer frost's signature

**Met.** Non-signature quests have no `signatureCardId` / `rewardCards` on tier defs. `buildCardChoices` for `training_caverns` returns only run drops and never injects `ice_ball` unless it was an actual drop. Tests assert `pendingCardChoices` excludes `ice_ball` and empty-choices fallback uses global `VICTORY_REWARD_ROTATION`.

### 3. Quest board displays each quest's signature reward before accepting

**Met.** Server `getQuest` / `listQuests` attach `signatureCardId` and resolved `signatureCardName` (from `cardDefs.json`). `listQuestVariants` builds `rewardSummary` via server `formatRewardSummary`, which appends the signature name when present.

Client `game/client/questBoard.js`:
- Tier-1 rows copy `signatureCardName` and `formatRewardSummary` renders e.g. `Reward: 14 money + Glacial Orb`.
- Tier-2 rows use server `rewardSummary` (e.g. `Reward: 16 stones + Gravity Well` for `spire_ascent` tier 2).

Socket payload flows through `applyQuestBoardFromPayload` → `renderQuestBoard` in `game/client/main.js`. Client and server tests cover frost vs training rendering.

### 4. Quests without a signature pool behave exactly as today

**Met.** `getSignatureCardId` / `getQuestRewardCards` return `null` for `training_caverns`, `arena_trials`, `canyon_descent`, `endless_siege`. Tests confirm tier defs lack the new fields, `buildCardChoices` output is drop-only, and `grantRunRewards` empty-choices path still indexes `VICTORY_REWARD_ROTATION`. `VICTORY_REWARD_ROTATION` and `SHOP_CARD_POOL` in `config.js` were not modified.

---

## Design & regression

- Aligns with the ticket's PSO-style design: quest-specific upfront rewards give players a reason to pick a contract.
- Theme assignments match the spec: frost → ice/slow (`ice_ball`), ember → burn (`fireball`), spire → knockback (`gravity_well`), crystal → utility (`mana_prism`).
- Only `acquisition: 'reward'` cards from `shared/cardDefs.json` are used; test enforces this.
- `runCardDropIds` is initialized to `[]` on deploy (`startDungeonRun`), so signature injection runs on normal victories even with zero drops.
- No changes to core combat, lobby, or persistence loops beyond reward selection and quest payload fields.

---

## Code quality

- Helpers `getSignatureCardId` and `getQuestRewardCards` follow existing `getEnemyPool` / `getGuaranteedEnemyType` patterns and are exported.
- Signature injection is localized to `buildCardChoices` and the victory fallback branch in `grantRunRewards`; minimal, readable diff.
- **2972 / 2972** tests pass (`pnpm test:quick`). New coverage: `quest_signature_rewards.test.js` (18 tests), extended `quests.test.js` and `questBoard.test.js`.
- No dead code or obvious logic bugs found in the changed paths.

---

## Debug scenarios

New scenario `frost-crossing-last-enemy` in `game/server/debugScenarios.js`:

| Requirement | Status |
|-------------|--------|
| Gated behind debug/dev path only | Yes — registered in `DEBUG_SCENARIOS`; `isDebugScenarioAllowed` requires `ALLOW_DEBUG_SCENARIOS=1` or localhost; URL/socket is the entry point |
| Same end-state reachable in normal play | Yes — frost_crossing tier 1 with all but one hostile cleared |
| Does not weaken invariants | Yes — uses `setupFrostCrossingTier1Deploy`, spawns a 1-HP grunt, does not skip victory reward server logic |

Not used in round-1 capture (`debugScenario: null` in probes). Acceptable QA shortcut.

---

## Remaining gaps

None blocking. All acceptance criteria are implemented and covered by tests; the game runs without errors in capture.

---

## Nits (non-blocking)

See `nits.md` for one follow-up on tier-1 vs tier-2 currency label wording on the quest board.

VERDICT: PASS
