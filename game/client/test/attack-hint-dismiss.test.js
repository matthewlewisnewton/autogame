import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createAttackHintDismisser,
	isAttackHintSeen,
	markAttackHintSeen,
	attackHintSeenKey,
	ATTACK_HINT_DISMISS_MS,
} from '../attackHintDismiss.js';

/** Minimal Map-backed localStorage stand-in. */
function makeStorage() {
	const map = new Map();
	return {
		getItem: (k) => (map.has(k) ? map.get(k) : null),
		setItem: (k, v) => { map.set(k, String(v)); },
		removeItem: (k) => { map.delete(k); },
		clear: () => map.clear(),
		_map: map,
	};
}

/** Spy bundle for the DOM-side callbacks. */
function makeCallbacks() {
	return { onShow: vi.fn(), onHide: vi.fn(), onDismiss: vi.fn() };
}

describe('attack-hint seen flag helpers', () => {
	it('keys the flag by player id and round-trips through storage', () => {
		const storage = makeStorage();
		expect(attackHintSeenKey('p1')).toBe('attackHintSeen:p1');
		expect(isAttackHintSeen('p1', storage)).toBe(false);
		markAttackHintSeen('p1', storage);
		expect(isAttackHintSeen('p1', storage)).toBe(true);
		// Different profile is independent.
		expect(isAttackHintSeen('p2', storage)).toBe(false);
	});

	it('is guarded: no player id, no storage, or throwing storage never throws', () => {
		expect(isAttackHintSeen(null, makeStorage())).toBe(false);
		expect(isAttackHintSeen('p1', null)).toBe(false);
		const boom = {
			getItem: () => { throw new Error('nope'); },
			setItem: () => { throw new Error('nope'); },
		};
		expect(() => markAttackHintSeen('p1', boom)).not.toThrow();
		expect(isAttackHintSeen('p1', boom)).toBe(false);
	});
});

describe('createAttackHintDismisser', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it('dismisses on the ~10s timeout and persists the seen flag', () => {
		const storage = makeStorage();
		const cb = makeCallbacks();
		const d = createAttackHintDismisser({ getPlayerId: () => 'p1', storage, ...cb });

		d.arm();
		expect(cb.onShow).toHaveBeenCalledTimes(1);
		expect(cb.onDismiss).not.toHaveBeenCalled();

		// Just before the timeout: still showing.
		vi.advanceTimersByTime(ATTACK_HINT_DISMISS_MS - 1);
		expect(cb.onDismiss).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(cb.onDismiss).toHaveBeenCalledTimes(1);
		expect(isAttackHintSeen('p1', storage)).toBe(true);
		expect(d._state().phase).toBe('dismissed');
	});

	it('dismisses on attack+cast — and neither one alone dismisses early', () => {
		const storage = makeStorage();
		const cb = makeCallbacks();
		const d = createAttackHintDismisser({ getPlayerId: () => 'p1', storage, ...cb });

		d.arm();

		d.noteProgress({ attacked: true });
		expect(cb.onDismiss).not.toHaveBeenCalled();
		// A second attack still isn't a cast.
		d.noteProgress({ attacked: true });
		expect(cb.onDismiss).not.toHaveBeenCalled();

		d.noteProgress({ casted: true });
		expect(cb.onDismiss).toHaveBeenCalledTimes(1);
		expect(isAttackHintSeen('p1', storage)).toBe(true);

		// The pending timeout must not fire a second dismissal.
		vi.advanceTimersByTime(ATTACK_HINT_DISMISS_MS);
		expect(cb.onDismiss).toHaveBeenCalledTimes(1);
	});

	it('cast-then-attack also dismisses (order independent)', () => {
		const storage = makeStorage();
		const cb = makeCallbacks();
		const d = createAttackHintDismisser({ getPlayerId: () => 'p1', storage, ...cb });
		d.arm();
		d.noteProgress({ casted: true });
		expect(cb.onDismiss).not.toHaveBeenCalled();
		d.noteProgress({ attacked: true });
		expect(cb.onDismiss).toHaveBeenCalledTimes(1);
	});

	it('a second run for the same profile keeps the hint hidden (persisted flag)', () => {
		const storage = makeStorage();
		const getPlayerId = () => 'p1';

		// First run: arm, dismiss via timeout, end the run.
		const run1 = makeCallbacks();
		const d1 = createAttackHintDismisser({ getPlayerId, storage, ...run1 });
		d1.arm();
		vi.advanceTimersByTime(ATTACK_HINT_DISMISS_MS);
		d1.reset();
		expect(run1.onShow).toHaveBeenCalledTimes(1);

		// Second run (same profile/storage): hint stays hidden, no show, no timer.
		const run2 = makeCallbacks();
		const d2 = createAttackHintDismisser({ getPlayerId, storage, ...run2 });
		d2.arm();
		expect(run2.onShow).not.toHaveBeenCalled();
		expect(run2.onHide).toHaveBeenCalledTimes(1);
		expect(d2._state().hasTimer).toBe(false);
		// And progress on an already-seen run is inert.
		d2.noteProgress({ attacked: true });
		d2.noteProgress({ casted: true });
		expect(run2.onDismiss).not.toHaveBeenCalled();
	});

	it('a fresh/empty profile re-shows the hint', () => {
		const storage = makeStorage();
		markAttackHintSeen('p1', storage); // an older profile dismissed it

		const cb = makeCallbacks();
		// New profile id with no stored flag.
		const d = createAttackHintDismisser({ getPlayerId: () => 'p2', storage, ...cb });
		d.arm();
		expect(cb.onShow).toHaveBeenCalledTimes(1);
		expect(cb.onHide).not.toHaveBeenCalled();
	});

	it('arm() is idempotent within a run and reset() re-arms for the next run', () => {
		const storage = makeStorage();
		const cb = makeCallbacks();
		const d = createAttackHintDismisser({ getPlayerId: () => 'p1', storage, ...cb });

		d.arm();
		d.arm(); // repeated showCardHand() during the same run
		d.arm();
		expect(cb.onShow).toHaveBeenCalledTimes(1);

		// reset() clears the timer so a stale timeout cannot dismiss after run end.
		d.reset();
		expect(cb.onHide).toHaveBeenCalled();
		expect(d._state().hasTimer).toBe(false);
		vi.advanceTimersByTime(ATTACK_HINT_DISMISS_MS);
		expect(cb.onDismiss).not.toHaveBeenCalled();

		// Fresh profile still unseen → re-arms and shows again.
		d.arm();
		expect(cb.onShow).toHaveBeenCalledTimes(2);
	});
});
