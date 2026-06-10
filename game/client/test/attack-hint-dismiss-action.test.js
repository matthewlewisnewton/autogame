import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createAttackHintDismisser,
	isAttackHintSeen,
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

/**
 * Re-create the action-gating wiring from main.js so we can assert it WITHOUT a
 * browser. In main.js, hint progress is only noted when `useCard()` actually
 * accepted and emitted (returns true); a client-side rejection returns false and
 * must not advance the dismisser. `useCardShim(slot)` stands in for `useCard()`.
 */
function makeHarness({ useCardShim, storage = makeStorage(), playerId = 'p1' }) {
	const dismisser = createAttackHintDismisser({
		getPlayerId: () => playerId,
		storage,
		timeoutMs: 10000,
		// Inert timer so only action-gating drives dismissal in these tests.
		setTimeoutFn: () => null,
		clearTimeoutFn: () => {},
	});
	dismisser.arm();
	return {
		dismisser,
		storage,
		// Click handler: cast only when useCard accepted.
		clickSlot(slot) {
			if (useCardShim(slot)) dismisser.noteProgress({ casted: true });
		},
		// Canvas basic attack: attack only when a usable slot was picked AND accepted.
		basicAttack(slot) {
			if (slot >= 0 && useCardShim(slot)) dismisser.noteProgress({ attacked: true });
		},
	};
}

describe('attack-hint dismissal is gated on successful useCard', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it('a click on an empty/unusable slot (useCard rejects) records no cast progress', () => {
		const useCardShim = () => false; // every activation rejected client-side
		const { dismisser, clickSlot } = makeHarness({ useCardShim });

		clickSlot(0);
		clickSlot(1);

		expect(dismisser._state()).toMatchObject({ attacked: false, casted: false });
		expect(dismisser._state().phase).toBe('active');
	});

	it('a basic attack with no usable slot (pickBasicAttackSlot() === -1) records no attack', () => {
		const useCardShim = vi.fn(() => true); // would accept, but should never be called
		const { dismisser, basicAttack } = makeHarness({ useCardShim });

		basicAttack(-1);

		expect(useCardShim).not.toHaveBeenCalled();
		expect(dismisser._state().attacked).toBe(false);
	});

	it('a basic attack whose chosen slot is rejected by useCard records no attack', () => {
		const useCardShim = () => false; // slot >= 0 but useCard rejects it
		const { dismisser, basicAttack } = makeHarness({ useCardShim });

		basicAttack(0);

		expect(dismisser._state().attacked).toBe(false);
	});

	it('rejected attempts never dismiss or persist the seen flag', () => {
		const useCardShim = () => false;
		const { dismisser, clickSlot, basicAttack, storage } = makeHarness({ useCardShim });

		clickSlot(0);
		basicAttack(0);
		basicAttack(-1);

		expect(dismisser._state().phase).toBe('active');
		expect(isAttackHintSeen('p1', storage)).toBe(false);
	});

	it('a genuine successful attack AND cast still dismiss + persist the seen flag', () => {
		const useCardShim = () => true; // every activation accepted and emitted
		const { dismisser, clickSlot, basicAttack, storage } = makeHarness({ useCardShim });

		basicAttack(0);
		expect(dismisser._state()).toMatchObject({ attacked: true, casted: false });
		expect(dismisser._state().phase).toBe('active');

		clickSlot(1);
		expect(dismisser._state().phase).toBe('dismissed');
		expect(isAttackHintSeen('p1', storage)).toBe(true);
	});

	it('a successful cast mixed with rejected attempts only counts the accepted one', () => {
		// First two activations rejected, the rest accepted.
		let calls = 0;
		const useCardShim = () => (++calls > 2);
		const { dismisser, clickSlot, basicAttack } = makeHarness({ useCardShim });

		clickSlot(0); // rejected
		basicAttack(1); // rejected
		expect(dismisser._state()).toMatchObject({ attacked: false, casted: false });

		basicAttack(2); // accepted → attack
		clickSlot(3); // accepted → cast → dismiss
		expect(dismisser._state().phase).toBe('dismissed');
	});
});
