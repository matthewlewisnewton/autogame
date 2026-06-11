import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Persistent armed-spike-trap rendering + the SPIKE_TRAP_TRIGGERED hit-feedback
// handler. The reconcile tests drive animate() the same way renderer-minion-
// summon.test.js does; the trigger-handler test imports main.js and fires the
// mocked socket event via window.__triggerSocketEvent (see test/setup.js).

describe('spike trap persistent hazard reconcile', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function baseState(enchantments) {
		return {
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [],
			enchantments,
		};
	}

	it('creates a persistent mesh keyed by enc.id and positions it at enc.x/z', async () => {
		const { initScene, setGameStateRef, setMyId, animate, getMeshMaps } =
			await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		setGameStateRef(baseState([
			{ id: 'trap-1', effect: 'spike_trap', armed: true, x: 3, z: -4, radius: 2 },
		]));

		animate(0);

		const mesh = getMeshMaps().spikeTrapMeshes['trap-1'];
		expect(mesh).toBeDefined();
		expect(mesh.position.x).toBe(3);
		expect(mesh.position.z).toBe(-4);

		// Reused (not re-created) and re-positioned on the next frame.
		setGameStateRef(baseState([
			{ id: 'trap-1', effect: 'spike_trap', armed: true, x: 5, z: 6, radius: 2 },
		]));
		animate(16);
		expect(getMeshMaps().spikeTrapMeshes['trap-1']).toBe(mesh);
		expect(mesh.position.x).toBe(5);
		expect(mesh.position.z).toBe(6);
	});

	it('disposes the hazard mesh when the enchantment leaves the snapshot', async () => {
		const { initScene, setGameStateRef, setMyId, animate, getMeshMaps } =
			await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		setGameStateRef(baseState([
			{ id: 'trap-2', effect: 'spike_trap', armed: true, x: 1, z: 1, radius: 2 },
		]));
		animate(0);
		expect(getMeshMaps().spikeTrapMeshes['trap-2']).toBeDefined();

		// Server drops the trap (e.g. ttl expired / triggered): id no longer present.
		setGameStateRef(baseState([]));
		animate(16);
		expect(getMeshMaps().spikeTrapMeshes['trap-2']).toBeUndefined();
	});

	it('does NOT create a hazard mesh for cinder_snare enchantments', async () => {
		const { initScene, setGameStateRef, setMyId, animate, getMeshMaps } =
			await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		setGameStateRef(baseState([
			{ id: 'snare-1', effect: 'cinder_snare', armed: true, x: 2, z: 2, radius: 2 },
			{ id: 'trap-3', effect: 'spike_trap', armed: true, x: 4, z: 0, radius: 2 },
		]));

		animate(0);

		const meshes = getMeshMaps().spikeTrapMeshes;
		expect(meshes['snare-1']).toBeUndefined();
		expect(meshes['trap-3']).toBeDefined();
	});
});

describe('SPIKE_TRAP_TRIGGERED handler', () => {
	beforeEach(() => {
		vi.resetModules();
		const requiredIds = [
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
			'mute-btn',
		];
		for (const id of requiredIds) {
			if (!document.getElementById(id)) {
				const el = (id === 'return-to-lobby-btn' || id === 'mute-btn')
					? document.createElement('button')
					: document.createElement('div');
				el.id = id;
				document.body.appendChild(el);
			}
		}
	});

	afterEach(() => {
		delete window.___test_scene;
	});

	it('spawns the eruption VFX at the reported x/z/radius', async () => {
		await import('../main.js');
		const { getActiveEffects } = await import('../renderer.js');

		window.__setScene({ add() {}, remove() {} });
		getActiveEffects().length = 0;

		window.__triggerSocketEvent('spikeTrapTriggered', { x: 7, z: -3, radius: 1.4 });

		const effects = getActiveEffects();
		const { ATTACK_EFFECT_KINDS } = await import('../renderer/attackEffectUpdaters.js');
		const ring = effects.find((e) => e.kind === ATTACK_EFFECT_KINDS.spikeTrapRing);
		expect(ring).toBeDefined();
		expect(ring.kind).toBe(ATTACK_EFFECT_KINDS.spikeTrapRing);
		expect(ring.origin).toEqual({ x: 7, z: -3 });
		expect(ring.radius).toBe(1.4);
		expect(effects.some((e) => e.kind === ATTACK_EFFECT_KINDS.spikeTrapSpike || e.isSpikeTrapSpike)).toBe(true);
	});

	it('is a guarded no-op when x/z are not finite', async () => {
		await import('../main.js');
		const { getActiveEffects } = await import('../renderer.js');

		window.__setScene({ add() {}, remove() {} });
		getActiveEffects().length = 0;

		window.__triggerSocketEvent('spikeTrapTriggered', { x: NaN, z: 2, radius: 1.4 });

		expect(getActiveEffects().length).toBe(0);
	});
});
