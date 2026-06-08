import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('minion summon scale-in', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('records spawn time and starts new minion meshes below full scale', async () => {
		const {
			initScene,
			setGameStateRef,
			setMyId,
			animate,
			getMeshMaps,
			getMinionSpawnTimes,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [{
				id: 'ally-1',
				type: 'battery_automaton',
				x: 1,
				z: 2,
				hp: 40,
				maxHp: 40,
			}],
		});

		animate(0);

		const mesh = getMeshMaps().minionsMeshes['ally-1'];
		expect(mesh).toBeDefined();
		expect(getMinionSpawnTimes()['ally-1']).toBeDefined();
		expect(mesh.scale.x).toBeLessThan(1);
	});

	it('does not re-trigger spawn scale-in when the minion id was already seen', async () => {
		const {
			initScene,
			setGameStateRef,
			setMyId,
			animate,
			getMeshMaps,
			getMinionSpawnTimes,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setMyId('p1');
		const minion = {
			id: 'ally-2',
			type: 'battery_automaton',
			x: 0,
			z: 0,
			hp: 50,
			maxHp: 50,
		};
		const baseState = {
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [minion],
		};

		setGameStateRef(baseState);
		animate(0);
		const initialSpawnAt = getMinionSpawnTimes()['ally-2'];
		expect(initialSpawnAt).toBeDefined();

		// Simulate resync: mesh map cleared but same minion id returns.
		delete getMeshMaps().minionsMeshes['ally-2'];
		setGameStateRef(baseState);
		animate(16);

		expect(getMeshMaps().minionsMeshes['ally-2']).toBeDefined();
		expect(getMinionSpawnTimes()['ally-2']).toBe(initialSpawnAt);
	});
});
