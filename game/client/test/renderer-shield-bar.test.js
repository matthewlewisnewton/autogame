import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('enemy shield bar', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('createEnemyShieldBarMesh uses cyan above the enemy half-height', async () => {
		const {
			initScene,
			createEnemyShieldBarMesh,
			enemyMeshHalfHeight,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		const mesh = createEnemyShieldBarMesh('e1', 1, 2, 'grunt');
		const halfHeight = enemyMeshHalfHeight('grunt');

		expect(mesh.material.color.getHex()).toBe(0x22d3ee);
		expect(mesh.position.x).toBe(1);
		expect(mesh.position.z).toBe(2);
		expect(mesh.position.y).toBe(halfHeight + 0.65);
	});

	it('updateEnemyShieldBarMesh scales by shieldHp / maxShieldHp', async () => {
		const {
			initScene,
			createEnemyShieldBarMesh,
			updateEnemyShieldBarMesh,
			getMeshMaps,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		const mesh = createEnemyShieldBarMesh('e1', 0, 0, 'grunt');
		getMeshMaps().enemyShieldBars.e1 = mesh;

		updateEnemyShieldBarMesh('e1', { shieldHp: 30, maxShieldHp: 40 });
		expect(mesh.scale.x).toBeCloseTo(0.75);

		updateEnemyShieldBarMesh('e1', { shieldHp: 10, maxShieldHp: 40 });
		expect(mesh.scale.x).toBeCloseTo(0.25);
	});

	it('animate sync creates, updates, and disposes shield bars from game state', async () => {
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
			enemies: [{
				id: 'e1',
				type: 'grunt',
				x: 0,
				z: 0,
				hp: 100,
				maxHp: 100,
				shieldHp: 40,
				maxShieldHp: 40,
			}],
			minions: [],
		});

		animate(0);
		const { enemyShieldBars } = getMeshMaps();
		expect(enemyShieldBars.e1).toBeDefined();
		expect(enemyShieldBars.e1.scale.x).toBeCloseTo(1);

		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [{
				id: 'e1',
				type: 'grunt',
				x: 0,
				z: 0,
				hp: 100,
				maxHp: 100,
				shieldHp: 20,
				maxShieldHp: 40,
			}],
			minions: [],
		});
		animate(16);
		expect(enemyShieldBars.e1.scale.x).toBeCloseTo(0.5);

		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [{
				id: 'e1',
				type: 'grunt',
				x: 0,
				z: 0,
				hp: 100,
				maxHp: 100,
				shieldHp: 0,
				maxShieldHp: 40,
			}],
			minions: [],
		});
		animate(32);
		expect(enemyShieldBars.e1).toBeUndefined();

		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [{
				id: 'e2',
				type: 'grunt',
				x: 1,
				z: 1,
				hp: 100,
				maxHp: 100,
				shieldHp: 10,
				maxShieldHp: 10,
			}],
			minions: [],
		});
		animate(48);
		expect(enemyShieldBars.e2).toBeDefined();

		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [],
			minions: [],
		});
		animate(64);
		expect(enemyShieldBars.e2).toBeUndefined();
	});

	it('does not create a shield bar when shieldHp is absent or zero', async () => {
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
			enemies: [
				{ id: 'plain', type: 'grunt', x: 0, z: 0, hp: 100, maxHp: 100 },
				{ id: 'empty', type: 'grunt', x: 2, z: 0, hp: 100, maxHp: 100, shieldHp: 0, maxShieldHp: 40 },
			],
			minions: [],
		});

		animate(0);
		expect(getMeshMaps().enemyShieldBars.plain).toBeUndefined();
		expect(getMeshMaps().enemyShieldBars.empty).toBeUndefined();
	});
});
