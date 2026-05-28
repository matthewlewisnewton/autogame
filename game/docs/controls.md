# Player Controls

## Movement

- **W / A / S / D** — move relative to the camera facing direction.
- **Gamepad left stick** or **D-pad** — move relative to the camera. Partial stick deflection moves at reduced speed (analog walk).

While lock-on is active, movement becomes **target-relative**: stick/keys forward and back move toward or away from the locked enemy, and left/right strafe around them. Your character still faces the locked target so attacks go toward them.

## Camera (orbit)

The camera orbits around your character so you can look around while moving.

- **Right mouse button + drag** — rotate the camera horizontally (yaw).
- **Gamepad right stick (horizontal)** — rotate the camera while playing.

Movement and attacks use the camera facing direction, not the character mesh orientation alone. When you stop moving, your character turns to face the camera forward direction.

Manual camera control is disabled while lock-on is active; the camera stays behind you, turns to keep the locked enemy in view, and looks at the target.

## Lock-On (Z-Targeting)

Press **Z** or the **gamepad L trigger** (standard) / **Z button** (8BitDo 64) to lock onto the nearest enemy within range.

- While locked, your character always faces the target so attacks go toward them.
- The camera reorients behind you and follows as you and the target move.
- Lock-on ends automatically if the target dies or moves too far away.
- If no enemy is in range when you press Z, the camera snaps behind your current facing instead.

Configure what happens when you press Z again while already locked in **Settings → Lock-on repeat press**:

- **Unlock (Dark Souls)** — release lock-on (default)
- **Cycle target (OoT / PSO)** — switch to the next closest enemy
- **Re-acquire nearest** — refresh lock onto the current nearest enemy, or unlock if none are in range

## Combat

Card slots and deck controls are unchanged from keyboard/gamepad bindings documented in the client UI.

### 8BitDo 64 (N64 profile)

When an **8BitDo 64** is connected, Settings → Controller profile can stay on **Auto-detect** (recommended) or be set to **8BitDo 64 (N64)**. The profile maps:

| N64 control | Game action |
|-------------|-------------|
| **A** | Hand slot 1 |
| **B** | Hand slot 2 |
| **C↑ / C↓ / C← / C→** | Hand slots 3–6 |
| **Z** (left bottom trigger, btn 8) | Lock-on (Z-targeting) |
| **R** (right bottom trigger, btn 9) | — (reserved; not a C-button) |
| **C← / C→** (horizontal) | Camera orbit |
| **Joystick** | Move |
| **D-pad** | Move |
| **Select (−)** | Toggle deck viewer |
| **L** | Modifier for extended hand slots |
| **Start (+)** | — |
