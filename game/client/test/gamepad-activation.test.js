import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';

describe('gamepad-activation.js', () => {
	/** @type {Array<(time: number) => void>} */
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		installGamepadMock();
		clearMockGamepads();
	});

	afterEach(() => {
		uninstallGamepadMock();
		vi.unstubAllGlobals();
	});

	function flushPollTick() {
		const callback = rafCallbacks.shift();
		expect(callback).toBeTypeOf('function');
		callback(0);
	}

	it('does not notify subscribers before a user gesture primes access', async () => {
		const {
			initGamepadActivation,
			onGamepadActivationChange,
			isGamepadAccessPrimed,
		} = await import('../gamepad-activation.js');

		const changes = [];
		initGamepadActivation();
		onGamepadActivationChange((detail) => changes.push(detail));

		expect(isGamepadAccessPrimed()).toBe(false);
		flushPollTick();
		expect(changes).toHaveLength(0);
	});

	it('fires a connect callback after primeGamepadAccess() and a poll tick', async () => {
		const {
			initGamepadActivation,
			onGamepadActivationChange,
			primeGamepadAccess,
			isGamepadAccessPrimed,
		} = await import('../gamepad-activation.js');

		const changes = [];
		initGamepadActivation();
		onGamepadActivationChange((detail) => changes.push(detail));

		flushPollTick();
		expect(changes).toHaveLength(0);

		primeGamepadAccess();
		expect(isGamepadAccessPrimed()).toBe(true);

		mockGamepad(0, { id: 'Safari Mock Controller' });
		flushPollTick();

		expect(changes).toHaveLength(1);
		expect(changes[0].connected?.index).toBe(0);
		expect(changes[0].connected?.id).toBe('Safari Mock Controller');
		expect(changes[0].pads).toHaveLength(1);
		expect(changes[0].pads[0].index).toBe(0);
	});

	it('primes access from keydown and detects a delayed pad on the next poll', async () => {
		const {
			initGamepadActivation,
			onGamepadActivationChange,
			isGamepadAccessPrimed,
		} = await import('../gamepad-activation.js');

		const changes = [];
		initGamepadActivation();
		onGamepadActivationChange((detail) => changes.push(detail));

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		expect(isGamepadAccessPrimed()).toBe(true);

		mockGamepad(0, { id: 'Delayed Safari Pad' });
		flushPollTick();

		expect(changes).toHaveLength(1);
		expect(changes[0].connected?.id).toBe('Delayed Safari Pad');
	});

	it('fires a disconnect callback when a pad disappears after priming', async () => {
		const {
			initGamepadActivation,
			onGamepadActivationChange,
			primeGamepadAccess,
		} = await import('../gamepad-activation.js');

		const changes = [];
		initGamepadActivation();
		onGamepadActivationChange((detail) => changes.push(detail));

		primeGamepadAccess();
		mockGamepad(0, { id: 'Temporary Pad' });
		flushPollTick();
		expect(changes).toHaveLength(1);
		expect(changes[0].connected?.id).toBe('Temporary Pad');

		clearMockGamepads();
		flushPollTick();

		expect(changes).toHaveLength(2);
		expect(changes[1].connected).toBeNull();
		expect(changes[1].pads).toHaveLength(0);
	});

	it('unsubscribes via the return value of onGamepadActivationChange()', async () => {
		const {
			initGamepadActivation,
			onGamepadActivationChange,
			primeGamepadAccess,
		} = await import('../gamepad-activation.js');

		const changes = [];
		initGamepadActivation();
		const unsubscribe = onGamepadActivationChange((detail) => changes.push(detail));
		unsubscribe();

		primeGamepadAccess();
		mockGamepad(0, { id: 'Ignored Pad' });
		flushPollTick();

		expect(changes).toHaveLength(0);
	});
});
