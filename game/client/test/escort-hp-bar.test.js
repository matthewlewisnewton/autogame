import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('escort NPC HP bar', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('shouldHaveEscortHealthBar is true only for isEscort minions', async () => {
		const { shouldHaveEscortHealthBar } = await import('../renderer.js');

		expect(shouldHaveEscortHealthBar({ isEscort: true })).toBe(true);
		expect(shouldHaveEscortHealthBar({ isEscort: false })).toBe(false);
		expect(shouldHaveEscortHealthBar({ type: 'battery_automaton' })).toBe(false);
		expect(shouldHaveEscortHealthBar(null)).toBe(false);
		expect(shouldHaveEscortHealthBar(undefined)).toBe(false);
	});

	it('escortHealthBarFillScale clamps hp/maxHp into 0..1', async () => {
		const { escortHealthBarFillScale } = await import('../renderer.js');

		expect(escortHealthBarFillScale(120, 120)).toBe(1);
		expect(escortHealthBarFillScale(60, 120)).toBeCloseTo(0.5);
		expect(escortHealthBarFillScale(30, 120)).toBeCloseTo(0.25);
		expect(escortHealthBarFillScale(0, 120)).toBe(0);
		expect(escortHealthBarFillScale(-5, 120)).toBe(0);
		expect(escortHealthBarFillScale(150, 120)).toBe(1);
		// Invalid/missing maxHp never divides by zero.
		expect(escortHealthBarFillScale(50, 0)).toBe(0);
		expect(escortHealthBarFillScale(50, undefined)).toBe(0);
	});

	it('animate sync creates a bar only for escort minions and scales/colors it from hp', async () => {
		const {
			initScene,
			setGameStateRef,
			setMyId,
			animate,
			getMeshMaps,
			healthBarColor,
			ESCORT_HEALTH_BAR_OFFSET_Y,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		const escort = {
			id: 'escort-1',
			type: 'escort_npc',
			isEscort: true,
			x: 3,
			z: 4,
			hp: 120,
			maxHp: 120,
		};
		const ordinary = {
			id: 'ally-1',
			type: 'battery_automaton',
			x: 0,
			z: 0,
			hp: 40,
			maxHp: 40,
		};
		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [escort, ordinary],
		});

		animate(0);
		const { escortHealthBars } = getMeshMaps();
		expect(escortHealthBars['escort-1']).toBeDefined();
		expect(escortHealthBars['ally-1']).toBeUndefined();

		const bar = escortHealthBars['escort-1'];
		expect(bar.scale.x).toBeCloseTo(1);
		expect(bar.material.color.getHex()).toBe(healthBarColor(120, 120));
		expect(bar.position.x).toBe(3);
		expect(bar.position.z).toBe(4);
		expect(bar.position.y).toBeCloseTo(0.5 + ESCORT_HEALTH_BAR_OFFSET_Y);

		// Damage tick: fill shrinks and color drops to the red band.
		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [{ ...escort, x: 5, z: 6, hp: 24 }, ordinary],
		});
		animate(16);
		expect(bar.scale.x).toBeCloseTo(0.2);
		expect(bar.material.color.getHex()).toBe(healthBarColor(24, 120));
		expect(bar.position.x).toBe(5);
		expect(bar.position.z).toBe(6);
	});

	it('disposes the bar when the escort minion leaves the snapshot', async () => {
		const {
			initScene,
			setGameStateRef,
			setMyId,
			animate,
			getMeshMaps,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [{
				id: 'escort-1',
				type: 'escort_npc',
				isEscort: true,
				x: 0,
				z: 0,
				hp: 120,
				maxHp: 120,
			}],
		});

		animate(0);
		expect(getMeshMaps().escortHealthBars['escort-1']).toBeDefined();

		// Escort died (or run ended): minion drops out of the snapshot.
		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [],
		});
		animate(16);
		expect(getMeshMaps().escortHealthBars['escort-1']).toBeUndefined();
	});
});
