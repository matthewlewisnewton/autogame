# Enemy Card Drops and Reward Draft

Add the first half of a *Lost Kingdoms 1 & 2*-inspired card acquisition loop:
defeated enemies should sometimes become concrete card rewards, not just generic
currency or a fixed victory-card rotation.

## Difficulty: medium

## Source Material Note

`game/docs/design.md` names *Lost Kingdoms 1 & 2* as reference material. The most
missing Lost Kingdoms-like loop element is that combat feeds the deck directly:
creatures and encounters become cards the player can add to their collection and
build around.

The game already has card rewards after a run. This ticket makes rewards feel
connected to enemies defeated during the dungeon.

## Goal

When enemies die, the server should have a chance to generate card-drop
candidates. At run completion, each player should see a small reward draft and
claim one card into their owned-card inventory.

## Acceptance Criteria

- Enemy definitions or enemy instances can specify possible card drops.
- When an enemy is defeated, the server records card-drop candidates for the
  current run.
- Run completion includes a `cardChoices` or equivalent reward-draft payload for
  each player.
- The run summary UI shows 2-3 card choices with name/type/short description.
- The player can choose one card reward from the summary.
- The server validates reward choice ids and adds exactly one copy to
  `player.ownedCards`.
- If no card drops were earned, the summary clearly says no card choices were
  found and existing fixed rewards still work if kept.
- Reward choices are server-owned and cannot be claimed twice.

## Implementation Notes

- Keep the first version deterministic enough for tests. For example, enemy type
  `goblin` always contributes `iron_sword`, while `drake` contributes
  `dungeon_drake`.
- If current enemies do not have types, add a small `type` field at spawn time.
- Store run-local card choices in server state, such as:

```js
player.pendingCardChoices = [
  { id: 'flame_blade', name: 'Flame Blade', type: 'weapon' },
  { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon' }
];
```

- Suggested socket event: `claimCardReward` with `{ cardId }`.
- Keep card choice UI inside the existing run summary overlay.
- Do not implement card selling/trading here; that belongs to
  `043-lobby-card-sell-and-trade`.

## Test Snippet

Adapt this into `game/server/test/integration.test.js`:

```js
it('offers card choices from defeated enemies and claims exactly one card', async () => {
  const debugResultPromise = waitForEvent(socket1, 'debugScenarioResult');
  socket1.emit('debugScenario', { name: 'summon-ready' });
  await debugResultPromise;
  await waitForEvent(socket1, 'stateUpdate');

  const player = gameState.players[socket1.id];
  gameState.enemies = [{
    id: 'drop_enemy',
    type: 'drake',
    x: player.x + 3,
    z: player.z,
    hp: 10,
    state: 'idle',
    attackState: 'idle',
    wanderTarget: { x: player.x + 3, z: player.z }
  }];
  gameState.run.objective.totalEnemies = 1;
  gameState.run.objective.defeatedEnemies = 0;

  const before = player.ownedCards.dungeon_drake || 0;
  const runCompletePromise = waitForEvent(socket1, 'runComplete');
  socket1.emit('useCard', { cardId: 'iron_sword', slotIndex: 0 });
  const summary = await runCompletePromise;

  expect(summary.players.find(p => p.id === socket1.id).cardChoices)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dungeon_drake' })
    ]));

  const rewardClaimed = waitForEvent(socket1, 'cardRewardClaimed');
  socket1.emit('claimCardReward', { cardId: 'dungeon_drake' });
  await rewardClaimed;

  expect(player.ownedCards.dungeon_drake).toBe(before + 1);
});
```

Add a second test that claiming the same reward twice does not add two copies.

## Files

- `game/server/index.js`
- `game/client/index.html`
- `game/client/main.js`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`
- `game/client/test/main.test.js`

## Tests

- Unit test enemy type -> possible card drop mapping.
- Unit test run-local card choice generation.
- Integration test card choice appears after a qualifying enemy is defeated.
- Integration test claiming one card mutates `ownedCards`.
- Integration test duplicate or invalid claims are rejected/no-op.
- Client test for summary rendering if helper extraction is practical.

## Visual QA Checklist

- Complete a run after defeating enemies and verify card choices appear in the
  run summary.
- Claim a card and verify the choice is visibly marked as claimed.
- Return to lobby and verify the owned-card/deck editor reflects the new copy.
