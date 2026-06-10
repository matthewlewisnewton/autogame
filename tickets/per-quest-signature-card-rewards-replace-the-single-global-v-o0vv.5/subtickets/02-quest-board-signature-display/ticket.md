# Quest board shows each quest's signature card reward next to currency

Surface the signature card (added in sub-ticket 01) on the lobby quest board so
players see the quest-specific reward before accepting: the server includes the
resolved card name in quest payloads, and the client renders it next to the
currency reward. Quests without a signature reward render exactly as today.

## Acceptance Criteria

- Server quest payloads expose the signature reward with a human-readable name:
  - Quests resolved via `getQuest` / `listQuests` in `game/server/quests.js` include
    `signatureCardId` and a resolved `signatureCardName` (e.g. `'Glacial Orb'` for
    `frost_crossing`) when the tier defines one; both absent/null otherwise.
  - `formatRewardSummary` in `game/server/quests.js` appends the signature card name
    when present (e.g. `Reward: 14 stones + Glacial Orb`), so tier-2 rows built from
    `listQuestVariants().rewardSummary` (e.g. `spire_ascent` tier 2 → Gravity Well)
    show it too. Quests without a signature produce the exact same string as before.
- The client quest board (`game/client/questBoard.js`) shows the signature reward
  next to the currency reward inside each quest card:
  - `frost_crossing`'s card includes its signature card name (Glacial Orb) in the
    rendered reward text.
  - `training_caverns`'s card reward text is unchanged (`Reward: 10 <currency>`, no
    signature suffix).
- New/updated tests pass:
  - server: `listQuests()` row for `frost_crossing` carries
    `signatureCardId === 'ice_ball'` and `signatureCardName === 'Glacial Orb'`;
    `formatRewardSummary` output unchanged for `training_caverns`.
  - client (`game/client/test/questBoard.test.js`): a row with a signature renders
    it in the quest card's reward element; a row without one renders the existing
    `Reward: N <currency>` text exactly.
- Full test suite passes (`pnpm test:quick` from `game/`).

## Technical Specs

- `game/server/quests.js`:
  - `require('../shared/cardDefs.json')` (same module the server config uses) to
    resolve card names. In `getQuest` (or `listQuests`/`listQuestVariants`), derive
    `signatureCardId` via the sub-ticket-01 helper `getSignatureCardId(questId, tier)`
    and set `signatureCardName` from `CARD_DEFS[signatureCardId]?.name ?? null`.
    Skip both fields (or set null) when there is no signature.
  - `formatRewardSummary(quest)` (~line 356): when `quest.signatureCardName` (or a
    resolvable signature id) is present, return
    `` `Reward: ${quest.rewardCurrency} stones + ${name}` ``; otherwise keep the
    current return values verbatim (including the `'Reward: —'` null case).
- `game/client/questBoard.js`:
  - `buildQuestBoardRows`: copy `signatureCardName` from each tier-1 quest into its
    row (tier-2 variant rows already receive the server-built `rewardSummary`
    string, which now contains the signature).
  - `formatRewardSummary` (client, ~line 64) or `rowRewardText` (~line 90): append
    `` ` + ${row.signatureCardName}` `` when present so the `.quest-reward` span
    shows e.g. `Reward: 14 st + Glacial Orb`. Keep the no-signature output and the
    `THEME.currency.short` usage exactly as today.
- Tests:
  - Extend `game/client/test/questBoard.test.js` (it already stubs quest rows with
    `rewardSummary` — follow its patterns).
  - Add a small server assertion to the sub-ticket-01 test file or a quests test for
    the payload fields and `formatRewardSummary` behavior.
- Depends on sub-ticket 01 (`getSignatureCardId` helper and tier-def fields).

## Verification: code
