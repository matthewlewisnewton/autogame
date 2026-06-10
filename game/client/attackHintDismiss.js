// Dismissal policy for the in-run attack/cast hint line (`#attack-hint`).
//
// The hint teaches new players the attack + cast controls. It should not nag:
// it fades out on the earlier of ~10s elapsed or the player having performed
// BOTH a basic attack and a card cast, and a persisted per-profile flag keeps
// it dismissed across future runs. This module is DOM-free and timer/storage
// injectable so the policy can be unit-tested; main.js wires the show/fade/hide
// side-effects via callbacks. The hint TEXT itself comes from sub-ticket 01
// (`getAttackCastHint` / `applyAttackHintText`); this only controls WHEN it shows.

export const ATTACK_HINT_DISMISS_MS = 10000;
export const ATTACK_HINT_SEEN_PREFIX = 'attackHintSeen:';

/** localStorage key for a given profile's "hint seen" flag. */
export function attackHintSeenKey(playerId) {
	return `${ATTACK_HINT_SEEN_PREFIX}${playerId ?? ''}`;
}

function defaultStorage() {
	try {
		return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
	} catch (_) {
		return null;
	}
}

/** True when this profile has already dismissed the hint on a previous run. */
export function isAttackHintSeen(playerId, storage = defaultStorage()) {
	if (!playerId || !storage) return false;
	try {
		return storage.getItem(attackHintSeenKey(playerId)) === '1';
	} catch (_) {
		return false;
	}
}

/** Persist the "hint seen" flag for this profile (guarded; never throws). */
export function markAttackHintSeen(playerId, storage = defaultStorage()) {
	if (!playerId || !storage) return;
	try {
		storage.setItem(attackHintSeenKey(playerId), '1');
	} catch (_) {
		/* storage unavailable / quota — dismissal still works for this run */
	}
}

/**
 * Stateful controller for one client's attack-hint lifecycle.
 *
 * Lifecycle per run: `arm()` on hand-show (idempotent — only the first call
 * after a `reset()` does anything), `noteProgress({ attacked, casted })` as the
 * player acts, and `reset()` on hand-hide / run end. Dismissal (timeout or
 * attack+cast) fades the hint and persists the seen flag exactly once.
 *
 * All DOM is delegated to the `onShow` / `onHide` / `onDismiss` callbacks, and
 * timers/storage are injectable, so the policy is testable without a browser.
 */
export function createAttackHintDismisser({
	getPlayerId = () => null,
	storage = defaultStorage(),
	onShow = () => {},
	onHide = () => {},
	onDismiss = () => {},
	timeoutMs = ATTACK_HINT_DISMISS_MS,
	setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
	clearTimeoutFn = (id) => clearTimeout(id),
} = {}) {
	/** @type {'idle' | 'active' | 'dismissed'} */
	let phase = 'idle';
	let timerId = null;
	let attacked = false;
	let casted = false;

	function clearTimer() {
		if (timerId !== null) {
			try { clearTimeoutFn(timerId); } catch (_) { /* ignore */ }
			timerId = null;
		}
	}

	function dismiss() {
		if (phase === 'dismissed') return;
		phase = 'dismissed';
		clearTimer();
		markAttackHintSeen(getPlayerId(), storage);
		try { onDismiss(); } catch (_) { /* ignore */ }
	}

	return {
		/**
		 * Show the hint and start the timeout for a fresh run. No-op if the hint
		 * is already active or already dismissed this run, or — keeping it hidden —
		 * if this profile has seen it before.
		 */
		arm() {
			if (phase !== 'idle') return;
			if (isAttackHintSeen(getPlayerId(), storage)) {
				phase = 'dismissed';
				try { onHide(); } catch (_) { /* ignore */ }
				return;
			}
			phase = 'active';
			attacked = false;
			casted = false;
			try { onShow(); } catch (_) { /* ignore */ }
			clearTimer();
			try {
				timerId = setTimeoutFn(() => { timerId = null; dismiss(); }, timeoutMs);
			} catch (_) {
				timerId = null;
			}
		},

		/** Record per-run progress; dismiss once both an attack and a cast happened. */
		noteProgress({ attacked: didAttack = false, casted: didCast = false } = {}) {
			if (phase !== 'active') return;
			if (didAttack) attacked = true;
			if (didCast) casted = true;
			if (attacked && casted) dismiss();
		},

		/** End of run / hand hidden: clear the timer and per-run state, hide the hint. */
		reset() {
			clearTimer();
			phase = 'idle';
			attacked = false;
			casted = false;
			try { onHide(); } catch (_) { /* ignore */ }
		},

		/** Inspect internal state (tests/debug only). */
		_state() {
			return { phase, attacked, casted, hasTimer: timerId !== null };
		},
	};
}
