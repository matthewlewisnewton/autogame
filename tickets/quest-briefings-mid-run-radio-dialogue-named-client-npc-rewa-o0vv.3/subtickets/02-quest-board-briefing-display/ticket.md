# 02 — Quest board briefing and reward display

When a player selects a quest on the Contract Terminal, show the named client, briefing paragraph, and concrete reward (currency now; optional signature-card line when `rewardSignatureCard` is present on the tier def) before ready-up. Depends on sub-ticket 01 for `client` data in quest payloads.

## Acceptance Criteria

- Selecting a quest card highlights it (existing behavior) **and** updates a briefing detail area visible in the quest board wrapper.
- The detail area shows: **Client** label + `client.name`, **Briefing** label + `client.briefing`, and **Reward** label + currency amount (reuse `formatRewardSummary` or an extended helper).
- When the selected tier defines `rewardSignatureCard` (card id string), the reward line also names that card (lookup display name from shared card identity if available; otherwise show the id).
- Tiers without `client` show a short fallback (e.g. “Contract issuer unknown”) without breaking selection.
- Briefing detail updates when the squad leader changes selection via `questUpdate` socket payload.
- `cd game && pnpm test:quick` passes; `game/client/test/questBoard.test.js` covers rendering of client name, briefing, and reward for a sample quest.

## Technical Specs

- **`game/client/questBoard.js`** — Add `formatClientBriefing(quest)`, extend `buildQuestBoardRows` / `renderQuestBoard` to accept a detail container or render a `.quest-briefing-panel` sibling; pass `client`, `rewardCurrency`, and optional `rewardSignatureCard` from row data.
- **`game/client/index.html`** — Add `#quest-briefing-panel` (or equivalent) inside `#quest-board-wrapper`, below `#quest-board`.
- **`game/client/style.css`** — Styles for `.quest-briefing-panel`, client/briefing/reward labels (match existing quest-card palette).
- **`game/client/main.js`** — Wire `renderQuestBoardState()` to pass the new detail element; ensure `applyQuestBoardFromPayload` forwards `client` from server quest rows.
- **`game/server/quests.js`** — Optional: add `rewardSignatureCard` field to tier schema (no values required yet).
- **`game/client/test/questBoard.test.js`** — DOM assertions for selected-quest briefing panel content.

## Verification: code
