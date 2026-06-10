import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const MAIN_DOM_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
	'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
];

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		if (!document.getElementById(id)) {
			const el = (id === 'return-to-lobby-btn')
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
	const cardHand = document.getElementById('card-hand');
	if (cardHand && cardHand.querySelectorAll('.card-slot').length === 0) {
		for (let i = 0; i < 6; i++) {
			const slot = document.createElement('div');
			slot.className = 'card-slot';
			slot.dataset.slotIndex = String(i);
			cardHand.appendChild(slot);
		}
	}
	if (!document.getElementById('key-item-indicator')) {
		const indicator = document.createElement('div');
		indicator.id = 'key-item-indicator';
		indicator.innerHTML = `
			<span class="key-item-hud-icon" aria-hidden="true"></span>
			<span class="key-item-hud-name"></span>
			<span class="key-item-hud-keybind"></span>
			<span class="key-item-hud-cooldown" aria-hidden="true"></span>
		`;
		document.body.appendChild(indicator);
	}
}

function ensureSocket() {
	if (!window.__isSocketReady()) {
		window.createSocket('test-fake-jwt-token');
	}
}

describe('key item cooldown HUD', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('updateKeyItemCooldownHud toggles cooldown class and countdown text', async () => {
		await import('../main.js');

		window.__setKeyItemDefs({
			dodge_roll: { id: 'dodge_roll', name: 'Dodge Roll', cooldownMs: 800 },
		});
		window.__setGameState(
			{ gamePhase: 'playing', players: { p1: { equippedKeyItemId: 'dodge_roll' } } },
			'p1',
		);
		window.__renderKeyItemHudForTest(
			{ equippedKeyItemId: 'dodge_roll' },
			'playing',
		);

		const el = document.getElementById('key-item-indicator');
		const nameEl = el.querySelector('.key-item-hud-name');
		const keybindEl = el.querySelector('.key-item-hud-keybind');
		const cooldownEl = el.querySelector('.key-item-hud-cooldown');
		window.__updateKeyItemCooldownHud(700);
		expect(el.classList.contains('cooldown')).toBe(true);
		expect(el.classList.contains('ready')).toBe(false);
		expect(cooldownEl.textContent).toMatch(/^0\.[0-9]+$/);
		expect(cooldownEl.textContent).toBe('0.7');
		expect(nameEl.textContent).toBe('Dodge Roll');
		expect(keybindEl.textContent).toBe('E');

		window.__updateKeyItemCooldownHud(0);
		expect(el.classList.contains('cooldown')).toBe(false);
		expect(el.classList.contains('ready')).toBe(true);
		expect(cooldownEl.textContent).toBe('');
	});

	it('flashKeyItemIndicator adds flash classes without removing HUD children', async () => {
		vi.useFakeTimers();
		await import('../main.js');

		window.__setKeyItemDefs({
			dodge_roll: { id: 'dodge_roll', name: 'Dodge Roll', cooldownMs: 800 },
		});
		window.__renderKeyItemHudForTest(
			{ equippedKeyItemId: 'dodge_roll' },
			'playing',
		);

		const el = document.getElementById('key-item-indicator');
		const childCount = el.children.length;

		for (const [type, cls] of [
			['success', 'flash-success'],
			['cooldown', 'flash-cooldown'],
			['soft-fail', 'flash-soft-fail'],
		]) {
			window.__flashKeyItemIndicator(type);
			expect(el.classList.contains(cls)).toBe(true);
			expect(el.children.length).toBe(childCount);
			vi.advanceTimersByTime(450);
			expect(el.classList.contains(cls)).toBe(false);
		}
	});
});

describe('dash VFX', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		document.body.innerHTML = '';
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('triggerDashVFX applies squash scale when a player mesh exists', async () => {
		const { initScene, triggerDashVFX, getMeshMaps } = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });

		const geometry = {};
		const material = { color: { getHex: () => 0xffffff } };
		const vec3 = () => ({
			x: 0,
			y: 0,
			z: 0,
			copy(other) {
				if (other) {
					this.x = other.x;
					this.y = other.y;
					this.z = other.z;
				}
				return this;
			},
		});
		const bodyMesh = {
			geometry,
			material,
			position: vec3(),
			rotation: vec3(),
		};
		const mesh = {
			scale: {
				x: 1,
				y: 1,
				z: 1,
				set(x, y, z) {
					this.x = x;
					this.y = y;
					this.z = z;
				},
			},
			position: vec3(),
			rotation: vec3(),
			userData: { bodyMesh },
		};
		getMeshMaps().playersMeshes.p1 = mesh;

		expect(() => triggerDashVFX('p1')).not.toThrow();
		expect(mesh.scale.x).toBe(1.3);
		expect(mesh.scale.y).toBe(0.7);
		expect(mesh.scale.z).toBe(1.3);
	});
});

describe('dash VFX detection in stateUpdate', () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }
	});

	it('calls triggerDashVFX when player position jumps beyond dash threshold', async () => {
		const rendererMod = await import('../renderer.js');
		const dashSpy = vi.spyOn(rendererMod, 'triggerDashVFX').mockImplementation(() => {});

		await import('../main.js');
		ensureSocket();

		window.__setGameState({ gamePhase: 'playing', players: { p1: { x: 0, z: 0 } } }, 'p1');

		window.__triggerSocketEvent('stateUpdate', {
			gamePhase: 'playing',
			players: { p1: { x: 0, z: 0 } },
		});
		window.__triggerSocketEvent('stateUpdate', {
			gamePhase: 'playing',
			players: { p1: { x: 5, z: 5 } },
		});

		expect(dashSpy).toHaveBeenCalledWith('p1');
		dashSpy.mockRestore();
	});
});
