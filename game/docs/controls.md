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

## Key Item

The **key item** action triggers the equipped key item during dungeon runs.

- **Keyboard:** **E** (default, remappable in Settings)
- **Gamepad:** **D-pad Down** (default, remappable in Settings)
- **8BitDo 64:** **Stick click** (button 13 — same SDL index; remappable)

### Dodge Roll

The **Dodge Roll** is the default equipped key item. When activated, your character performs a fast burst in the current movement direction (or facing direction if stationary) with brief invulnerability.

- **Cooldown:** 800ms
- **Invulnerability:** ~300ms — you cannot take damage during this window
- **Direction:** Uses your current WASD/gamepad stick input; if stationary, uses your character's facing direction
- **Collision:** The dash stops at walls — you cannot clip through dungeon geometry

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

## Gamepad / Safari

Safari on macOS (and iOS) implements the Gamepad API with extra restrictions that other browsers do not impose. The game accounts for these where possible, but some behavior is controlled by the browser.

- **User gesture required** — Connected pads may not appear in `navigator.getGamepads()` until the player **clicks or taps the page** and then **presses a controller button or moves a stick**. Until that happens, Settings may show "No controller detected" even when a pad is plugged in.
- **`gamepadconnected` may not fire** — Safari sometimes omits the `gamepadconnected` event when a pad is attached. The client polls after the first gesture instead of relying on that event alone.
- **Secure context required** — Gamepad access requires **HTTPS** or **localhost**. Plain `http://` on a LAN IP will not expose controllers.
- **Manual verification recommended** — Confirm controller detection and calibration on **macOS Safari** with your hardware; behavior can differ from Chrome and Firefox on the same machine.
