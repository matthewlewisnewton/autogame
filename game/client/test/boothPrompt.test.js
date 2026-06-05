import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub, generateLayout } from '../../server/dungeon.js';
import {
	formatBoothPrompt,
	updateBoothPrompt,
	dispatchBoothAction,
	BOOTH_ACTION_EVENT,
} from '../boothPrompt.js';

// Exercises the hub booth-interaction primitive the way main.js wires it:
// the renderer computes the in-range booth each animate frame, main.js shows/
// hides the prompt on the resulting transitions and emits `boothInteract` for
// the in-range booth. main.js itself is v8-ignored UI glue, so we drive the
// renderer + helper contract it relies on (same approach as hub-lobby-render).
describe('booth interaction prompt', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		window.__soundLogEnabled = true;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	/** Build the renderer in the hub lobby with the local avatar wired up. */
	async function setupHub(hubLayout, startPos) {
		const renderer = await import('../renderer.js');
		renderer.setGamePhase('lobby');
		renderer.initScene(hubLayout, { x: 0, z: 0 });
		renderer.setMyId('p1');
		renderer.setPlayerPosition(startPos.x, startPos.z);
		renderer.setGameStateRef({
			gamePhase: 'lobby',
			layout: hubLayout,
			players: { p1: { x: startPos.x, z: startPos.z, hp: 100, dead: false } },
			loot: [],
			enemies: [],
			minions: [],
		});
		return renderer;
	}

	it('formatBoothPrompt names the booth and ignores unknown/none', () => {
		expect(formatBoothPrompt('shop')).toBe('Press F — Shop');
		expect(formatBoothPrompt('quest')).toBe('Press F — Quest Board');
		expect(formatBoothPrompt(null)).toBeNull();
		expect(formatBoothPrompt('not-a-booth')).toBeNull();
	});

	it('shows the prompt on zone enter and hides it on exit', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.shop;
		// Start far from every booth so the player begins out of range.
		const renderer = await setupHub(hubLayout, { x: anchor.x + 50, z: anchor.z + 50 });

		const promptEl = document.createElement('div');
		promptEl.id = 'booth-prompt';
		promptEl.classList.add('hidden');
		document.body.appendChild(promptEl);

		const transitions = [];
		renderer.setBoothInRangeListener((boothId) => {
			transitions.push(boothId);
			updateBoothPrompt(promptEl, boothId);
		});

		// Out of range: prompt stays hidden.
		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBeNull();
		expect(promptEl.classList.contains('hidden')).toBe(true);

		// Walk onto the shop anchor — prompt shows and names the booth.
		renderer.setPlayerPosition(anchor.x, anchor.z);
		renderer.animate(16);
		expect(renderer.getCurrentBoothInRange()).toBe('shop');
		expect(promptEl.classList.contains('hidden')).toBe(false);
		expect(promptEl.textContent).toBe('Press F — Shop');

		// Walk back out — prompt hides again.
		renderer.setPlayerPosition(anchor.x + 50, anchor.z + 50);
		renderer.animate(32);
		expect(renderer.getCurrentBoothInRange()).toBeNull();
		expect(promptEl.classList.contains('hidden')).toBe(true);

		expect(transitions).toEqual(['shop', null]);
	});

	it('hides the prompt when the rendered scene is not the hub', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.shop;
		const renderer = await setupHub(hubLayout, { x: anchor.x, z: anchor.z });

		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBe('shop');

		// Deploy into a quest layout (no boothAnchors) — booth zone clears even
		// though the player sits at the same coordinates.
		const questLayout = generateLayout(42, 'default');
		expect(questLayout.profile).not.toBe('hub');
		renderer.setGameStateRef({
			gamePhase: 'playing',
			layout: questLayout,
			players: { p1: { x: anchor.x, z: anchor.z, hp: 100, dead: false } },
			loot: [],
			enemies: [],
			minions: [],
		});
		renderer.animate(16);
		expect(renderer.getCurrentBoothInRange()).toBeNull();
	});

	it('emits boothInteract for the in-range booth and nothing when out of range', async () => {
		const hubLayout = generateHub(0);
		const anchor = hubLayout.boothAnchors.deck;
		const renderer = await setupHub(hubLayout, { x: anchor.x, z: anchor.z });

		const socket = { emit: vi.fn() };
		renderer.setSocketRef(socket);

		// Wire input the way main.js does: interact → emit for current booth.
		const { initInput, resetInputState } = await import('../input.js');
		resetInputState();
		initInput({
			onInteract: () => renderer.emitBoothInteract(),
			// Prove interact is NOT gated behind canUseGameActions (works in hub).
			canUseGameActions: () => false,
		});

		// In range: pressing F emits boothInteract with the right id.
		renderer.animate(0);
		expect(renderer.getCurrentBoothInRange()).toBe('deck');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
		expect(socket.emit).toHaveBeenCalledWith('boothInteract', { boothId: 'deck' });

		// Out of range: pressing F emits nothing.
		socket.emit.mockClear();
		renderer.setPlayerPosition(anchor.x + 50, anchor.z + 50);
		renderer.animate(16);
		expect(renderer.getCurrentBoothInRange()).toBeNull();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
		expect(socket.emit).not.toHaveBeenCalled();
	});

	it('dispatchBoothAction fires the single booth:action hook point', () => {
		const received = [];
		const listener = (e) => received.push(e.detail);
		window.addEventListener(BOOTH_ACTION_EVENT, listener);
		try {
			dispatchBoothAction({ boothId: 'shop', action: 'shop' });
		} finally {
			window.removeEventListener(BOOTH_ACTION_EVENT, listener);
		}
		expect(received).toEqual([{ boothId: 'shop', action: 'shop' }]);
	});
});
