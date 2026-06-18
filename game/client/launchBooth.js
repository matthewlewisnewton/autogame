// ── Launch Bay Booth Behavior Helpers ──
// Pure, DOM-free helpers for the hub "Launch Bay" booth. main.js subscribes to
// the `booth:action` window event (see boothPrompt.js) and uses these to decide
// whether an action belongs to the launch booth and to read the `?booth=` debug
// hook. Kept free of `window`/`socket` references so it stays unit-testable like
// boothPrompt.js (main.js itself is v8-ignored UI glue).

/** The booth id of the hub Launch Bay, as produced by generateHub. */
export const LAUNCH_BOOTH_ID = 'launch';

/**
 * Window event name dispatched when a booth ready-up actually fires, so the
 * launch is observable in capture console output / by other modules.
 */
export const LAUNCH_READY_EVENT = 'launch:ready';

/**
 * Decide whether a booth ready-up should proceed. Ready-up only proceeds when
 * the player is not already ready and no launch ready request is in flight,
 * so a repeated booth touch before server ack does not re-emit `playerReady(true)`.
 * @param {boolean|undefined|null} currentIsReady - the local ready flag
 * @param {boolean|undefined|null} launchReadyPending - true while awaiting server ack
 * @returns {boolean} true when ready-up should proceed
 */
export function shouldLaunchReadyUp(currentIsReady, launchReadyPending = false) {
	return !currentIsReady && !launchReadyPending;
}

/**
 * Decide whether a `booth:action` event detail targets the launch booth.
 * @param {{ boothId?: string }|null|undefined} detail
 * @returns {boolean} true when the detail is the launch booth
 */
export function isLaunchBoothAction(detail) {
	return !!(detail && detail.boothId === LAUNCH_BOOTH_ID);
}

export { getBoothDebugHook } from './boothCommon.js';
