// ── Launch Bay Booth Behavior Helpers ──
// Pure, DOM-free helpers for the hub "Launch Bay" booth. main.js subscribes to
// the `booth:action` window event (see boothPrompt.js) and uses these to decide
// whether an action belongs to the launch booth and to read the `?booth=` debug
// hook. Kept free of `window`/`socket` references so it stays unit-testable like
// boothPrompt.js (main.js itself is v8-ignored UI glue).

/** The booth id of the hub Launch Bay, as produced by generateHub. */
export const LAUNCH_BOOTH_ID = 'launch';

/**
 * Decide whether a `booth:action` event detail targets the launch booth.
 * @param {{ boothId?: string }|null|undefined} detail
 * @returns {boolean} true when the detail is the launch booth
 */
export function isLaunchBoothAction(detail) {
	return !!(detail && detail.boothId === LAUNCH_BOOTH_ID);
}

/**
 * Parse the `?booth=` debug hook from a location query string.
 * @param {string} search - e.g. `window.location.search` ("?booth=launch")
 * @returns {string|null} the `booth` param value, or null when absent
 */
export function getBoothDebugHook(search) {
	return new URLSearchParams(search || '').get('booth');
}
