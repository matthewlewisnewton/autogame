# Senior Review — HUD top-right corner collision

**Ticket:** `hud-top-right-corner-collision-key-item-badge-overlaps-toolb-ihb5`  
**Baseline:** `5936e4a20c6ee00304778aab01cdcd4e9268f106`  
**Commits reviewed:** 4 sub-ticket commits (`01`–`04`)  
**Capture:** round-1 fallback smoke at 1280×800 (port 5175)

---

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` fatals / `pageerror` tags | None (409 on register is benign auth conflict; scene init succeeds) |

The captured run reaches in-run gameplay with dodge-roll key item equipped, comms visible, and no browser exceptions. **Runtime gate: PASS.**

---

## Acceptance criteria

### At 1280×800 and 1920×1080, no top-right HUD element overlaps another

**Implementation approach:** Four sub-tickets introduce a shared `#top-right-hud-stack` flex column (`position: fixed; top: var(--top-right-hud-stack-top, 60px); right: 16px`) that vertically stacks:

1. `#key-item-indicator`
2. `#lock-on-info-panel`
3. `#quest-comms-log` (plus transient `.quest-comms-toast` inserted immediately above the log)

The toolbar (`#app-toolbar`) stays at `top: 12px; z-index: 110; pointer-events: auto`, while the stack sits at `z-index: 10` with `pointer-events: none`, giving an 8px gap below the 40px button row (12 + 40 + 8 = 60px via `--top-right-hud-stack-top`).

**Evidence:**

| Scenario | Code / test | Visual capture |
|----------|-------------|----------------|
| Key-item badge vs toolbar | `top-right-hud-layout.test.js` scenario 1 @ 1280×800 & 1920×1080; CSS removes old `top: 36px` anchor | `02-after-w.png`, `04-after-dodge.png` — toolbar row fully visible; Dodge Roll badge sits clearly below with no overlap |
| Lock-on panel vs comms log | scenario 2 + full matrix tests at both resolutions | Not in harness screenshots; covered by 511-line regression suite with layout polyfill |
| Quest comms toast vs comms log at entry | scenario 3 @ both resolutions; `showQuestCommsToast` now inserts into stack before `#quest-comms-log` | `02-after-w.png` shows stacked comms toast + log line with vertical separation |

All 332 vitest tests pass (including 12 new layout regression tests). Pre-fix absolute anchors (`top: 36px`, `44px`, `92px`) are explicitly guarded against in tests.

**Finding: SATISFIED** — structural fix plus automated overlap checks at both required resolutions.

### Toolbar buttons fully clickable with key item equipped

Toolbar retains higher z-index (110) and `pointer-events: auto` while HUD stack children are non-interactive overlays. Spatial clearance ensures the badge does not sit under the button hit targets. Capture shows all four toolbar buttons unobstructed during dodge-roll cooldown.

**Finding: SATISFIED**

### Lock-on panel and comms log both readable simultaneously

Flex column with `gap: 8px` and `align-items: flex-end` orders lock-on above comms log when both are visible. Lock-on panel sync (`syncLockOnInfoPanel` via renderer) unchanged in behavior — only DOM/CSS placement moved into the stack.

**Finding: SATISFIED** (by layout tests; see nits for capture gap)

---

## Design & requirements consistency

- **Scope:** Pure client HUD layout/DOM refactor in `index.html`, `style.css`, and toast anchoring in `main.js`. No server, gameplay, or persistence changes.
- **`game/docs/design.md`:** No conflict; quest comms and lock-on remain in-run UI affordances.
- **Regressions:** Existing `questDialogue.test.js` and `lock-on-info-panel.test.js` still pass; quest toast parent assertion updated to `#top-right-hud-stack`.

---

## Debug scenarios

No new or modified `?debugScenario=` shortcuts. Existing test hooks (`__showQuestDialogueForTest`, etc.) are dev-only and do not alter normal quest dialogue flow.

---

## Code quality

- Clean separation: stack scaffold (HTML/CSS), toast anchoring (main.js), regression tests (dedicated file).
- Removed competing absolute positions and z-index arms race between lock-on/comms/key-item.
- Fallback in `showQuestCommsToast` appends to `document.body` if stack elements missing — defensive, unlikely in production DOM.
- No dead code or obvious bugs introduced.

---

## Remaining gaps

None blocking. All acceptance criteria are met with automated overlap regression coverage at 1280×800 and 1920×1080, corroborated by in-run capture showing toolbar clearance and comms stacking.

VERDICT: PASS
