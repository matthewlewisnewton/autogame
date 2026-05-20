/**
 * Clamp a raw delta-time (in seconds) to a sensible maximum.
 *
 * Tab-switches or GC pauses can produce huge deltas that cause physics/AI
 * updates to spiral. This helper caps the delta at `MAX_DELTA` (100 ms)
 * and guards against zero or negative values.
 *
 * @param {number} rawDelta - delta time in seconds (from THREE.Clock.getDelta)
 * @returns {number} clamped delta in seconds, in range [0, 0.1]
 */
export function clampDelta(rawDelta) {
	if (rawDelta <= 0) return 0;
	return Math.min(rawDelta, 0.1);
}
