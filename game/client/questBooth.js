// ── Quest Booth Behavior Helpers ──
// Pure, DOM-free helpers for the hub "quest" booth. main.js subscribes to the
// `booth:action` window event (see boothPrompt.js) and uses these to decide
// whether an action belongs to the quest booth before revealing the existing
// inline quest panel (`#quest-board`). Kept free of `window`/`socket`
// references so it stays unit-testable like launchBooth.js (main.js itself is
// v8-ignored UI glue).

// The `?booth=` debug hook is shared across booths via boothCommon.js.
export { getBoothDebugHook } from './boothCommon.js';

/** The booth id of the hub quest booth, as produced by generateHub. */
export const QUEST_BOOTH_ID = 'quest';

/**
 * Decide whether a `booth:action` event detail targets the quest booth.
 * @param {{ boothId?: string }|null|undefined} detail
 * @returns {boolean} true when the detail is the quest booth
 */
export function isQuestBoothAction(detail) {
	return !!(detail && detail.boothId === QUEST_BOOTH_ID);
}
