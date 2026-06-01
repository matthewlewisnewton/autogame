# Client: dodge roll VFX and in-game cooldown indicator

## Description

Add visual feedback for the dodge roll on the client: (1) a motion trail or squash-and-stretch effect on the local player mesh during the dash, (2) a brief invulnerability shimmer (semi-transparent or desaturated look), and (3) a cooldown indicator on the in-game HUD showing when the key item is on cooldown.

## Acceptance Criteria

- **Motion trail / squash**: When the local player dashes, the player mesh briefly squashes (scale Y decreases, X/Z increase) for ~100ms, then returns to normal. Alternatively, a short-lived motion trail (ghost clone at previous position that fades over 200ms) is acceptable.
- **Invulnerability visual**: While `isInvulnerable` is true in the `stateUpdate`, the player mesh becomes semi-transparent (opacity ~0.5) or desaturated to indicate i-frames.
- **Cooldown HUD indicator**: The in-game HUD shows a cooldown overlay or dimmed icon for the key item while `keyItemCooldownRemaining > 0` in the state snapshot. The indicator clears when cooldown expires.
- All VFX are client-side only (no server roundtrip needed beyond the `stateUpdate` the server already sends).
- No regression to existing card-hand rendering, HP/MS bars, or movement visuals.

## Technical Specs

- **File**: `game/client/main.js`
  - In the `stateUpdate` handler (where `gameState` is updated from server data), detect when the local player's position changes significantly in a single tick (> `MOVE_SPEED / TICK_RATE * 2`) — treat this as a dash and trigger VFX:
    ```js
    function handleStateUpdate(data) {
      // ... existing state sync ...
      const me = gameState.players[myId];
      if (me && me._prevX != null) {
        const jumpDist = Math.hypot(me.x - me._prevX, me.z - me._prevZ);
        if (jumpDist > (MOVE_SPEED / TICK_RATE) * 2) {
          triggerDashVFX(me);
        }
      }
      // Store prev position for next tick comparison
      if (me) { me._prevX = me.x; me._prevZ = me.z; }
    }
    ```
  - Implement `triggerDashVFX(player)`:
    - Squash the player mesh: `playerMesh.scale.set(1.3, 0.7, 1.3)`, then lerp back to `(1,1,1)` over 150ms using a short `requestAnimationFrame` loop.
    - Optionally create a ghost clone at the previous position with reduced opacity that fades over 200ms.
  - In the per-frame render loop or `stateUpdate` handler, when `me.isInvulnerable` is true, set `playerMesh.material.transparent = true`, `playerMesh.material.opacity = 0.5` (or use `material.color.setScalar(0.6)` for desaturation). Restore on next tick when `isInvulnerable` is false.
  - **Cooldown HUD**: Add a small key item indicator to the in-game HUD. Options:
    - Reuse the `#hud-meta` area to show a small icon with a cooldown overlay (CSS `::after` with a countdown arc or dimmed state).
    - Or add a `#key-item-hud` element near the card hand that shows the equipped key item name/icon with a cooldown overlay when `keyItemCooldownRemaining > 0`.
    - Update this element each `stateUpdate` based on `me.keyItemCooldownRemaining`.

- **File**: `game/client/index.html`
  - Add key item HUD element if not using an existing HUD area:
    ```html
    <div id="key-item-hud" class="hidden">
      <div id="key-item-icon" title="Key Item"></div>
      <div id="key-item-cooldown-overlay" class="hidden"></div>
    </div>
    ```
  - Show/hide `#key-item-hud` based on `gamePhase === 'playing'`.

- **File**: `game/client/main.js` — CSS for cooldown overlay (semi-transparent dark fill that shrinks as cooldown expires, or a simple dimmed state that clears when ready).

## Verification: code
