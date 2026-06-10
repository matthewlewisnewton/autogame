import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { patchSettings } from '../settings.js';
import { Mesh, BoxGeometry, Group, Box3, MeshStandardMaterial } from 'three';
import {
	getRegistryTargetFootprint,
	getRegistryHostVerticalOffset,
	normalizeLoadedRegistryModel,
	enemyMeshHalfHeight,
	getEnemyRenderScaleForTest,
	getMeshMaps,
	createEnemyMesh,
	ENEMY_GEOMETRY,
} from '../renderer.js';

describe('getRegistryTargetFootprint()', () => {
	it('uses max(height, diameter) for cone enemies', () => {
		expect(getRegistryTargetFootprint('grunt')).toEqual({ targetHeight: 1 });
		expect(getRegistryTargetFootprint('skirmisher')).toEqual({ targetHeight: 0.6 });
		expect(getRegistryTargetFootprint('miniboss')).toEqual({ targetHeight: 2.2 });
		expect(getRegistryTargetFootprint('annex_overseer')).toEqual({ targetHeight: 2.4 });
		expect(getRegistryTargetFootprint('arena_champion')).toEqual({ targetHeight: 3.0 });
		expect(getRegistryTargetFootprint('spire_warden')).toEqual({ targetHeight: 2.4 });
		expect(getRegistryTargetFootprint('permafrost_warden')).toEqual({ targetHeight: 2.5 });
	});

	it('uses diameter for octahedron enemies', () => {
		expect(getRegistryTargetFootprint('spawner')).toEqual({ targetHeight: 1.2 });
		expect(getRegistryTargetFootprint('field_medic')).toEqual({ targetHeight: 0.8 });
		expect(getRegistryTargetFootprint('ember_wraith')).toEqual({ targetHeight: 0.7 });
	});

	it('applies minion height and scale multiplier', () => {
		expect(getRegistryTargetFootprint('ancient_wyrm')).toEqual({ targetHeight: 2.25 });
		expect(getRegistryTargetFootprint('bulkhead_mauler')).toEqual({ targetHeight: 1.2 });
		expect(getRegistryTargetFootprint('null_crawler')).toEqual({ targetHeight: 0.7 });
	});

	it('normalizes the player avatar to the ~1.8 spike-contract height', () => {
		expect(getRegistryTargetFootprint('player')).toEqual({ targetHeight: 1.8 });
	});

	it('returns null for keys without geometry tables', () => {
		expect(getRegistryTargetFootprint('magic_stone')).toBeNull();
	});
});

describe('getRegistryHostVerticalOffset()', () => {
	it('matches enemyMeshHalfHeight for enemy registry keys', () => {
		expect(getRegistryHostVerticalOffset('grunt')).toBe(enemyMeshHalfHeight('grunt'));
		expect(getRegistryHostVerticalOffset('skirmisher')).toBe(enemyMeshHalfHeight('skirmisher'));
		expect(getRegistryHostVerticalOffset('miniboss')).toBe(enemyMeshHalfHeight('miniboss'));
		expect(getRegistryHostVerticalOffset('annex_overseer')).toBe(enemyMeshHalfHeight('annex_overseer'));
		expect(getRegistryHostVerticalOffset('arena_champion')).toBe(enemyMeshHalfHeight('arena_champion'));
		expect(getRegistryHostVerticalOffset('spire_warden')).toBe(enemyMeshHalfHeight('spire_warden'));
		expect(getRegistryHostVerticalOffset('permafrost_warden')).toBe(enemyMeshHalfHeight('permafrost_warden'));
		expect(getRegistryHostVerticalOffset('spawner')).toBe(enemyMeshHalfHeight('spawner'));
		expect(getRegistryHostVerticalOffset('field_medic')).toBe(enemyMeshHalfHeight('field_medic'));
		expect(getRegistryHostVerticalOffset('ember_wraith')).toBe(enemyMeshHalfHeight('ember_wraith'));
	});

	it('returns 0.5 for minion registry keys', () => {
		expect(getRegistryHostVerticalOffset('ancient_wyrm')).toBe(0.5);
		expect(getRegistryHostVerticalOffset('null_crawler')).toBe(0.5);
		expect(getRegistryHostVerticalOffset('bulkhead_mauler')).toBe(0.5);
	});

	it('returns 0 for keys without a raised host', () => {
		expect(getRegistryHostVerticalOffset('player')).toBe(0);
		expect(getRegistryHostVerticalOffset('magic_stone')).toBe(0);
	});
});

describe('normalizeLoadedRegistryModel()', () => {
	it('scales to target height and grounds bbox min.y at zero', () => {
		const mesh = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0xffffff }));
		const model = new Group();
		model.add(mesh);

		normalizeLoadedRegistryModel(model, { targetHeight: 1 });

		const box = new Box3().setFromObject(model);
		expect(box.max.y - box.min.y).toBeCloseTo(1, 5);
		expect(box.min.y).toBeCloseTo(0, 5);
	});
});

function attachNormalizedRegistryModel(key, host, stubModel) {
	const footprint = getRegistryTargetFootprint(key);
	if (!footprint) return;
	normalizeLoadedRegistryModel(stubModel, footprint);
	stubModel.position.y -= getRegistryHostVerticalOffset(key);
	host.add(stubModel);
}

/** World-space bbox min.y (host y + local min.y; mock Three has no updateMatrixWorld). */
function worldBoxMinY(host, model) {
	const localBox = new Box3().setFromObject(model);
	return host.position.y + localBox.min.y;
}

describe('registry model world grounding', () => {
	it('places enemy model feet at world y=0 when host is at enemyMeshHalfHeight', () => {
		const key = 'grunt';
		const host = new Group();
		host.position.y = enemyMeshHalfHeight(key);

		const stub = new Group();
		stub.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0xffffff })));
		attachNormalizedRegistryModel(key, host, stub);

		expect(worldBoxMinY(host, stub)).toBeCloseTo(0, 5);
	});

	it('places minion model feet at world y=0 when host is at y=0.5', () => {
		const key = 'ancient_wyrm';
		const host = new Group();
		host.position.y = 0.5;

		const stub = new Group();
		stub.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0xffffff })));
		attachNormalizedRegistryModel(key, host, stub);

		expect(worldBoxMinY(host, stub)).toBeCloseTo(0, 5);
	});
});

describe('field medic VFX', () => {
	beforeEach(() => {
		patchSettings({ particlesEnabled: true });
	});

	afterEach(async () => {
		const { getActiveEffects } = await import('../renderer.js');
		getActiveEffects().length = 0;
	});

	it('triggerMedicAllyHealVFX spawns telegraph ring and particle burst primitives', async () => {
		const {
			initScene,
			triggerMedicAllyHealVFX,
			getActiveEffects,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		const before = getActiveEffects().length;

		triggerMedicAllyHealVFX({ x: 4, y: 0, z: 5 }, 6);

		expect(getActiveEffects().length).toBe(before + 2);
		const effects = getActiveEffects().slice(before);
		expect(effects.some((fx) => fx.isTelegraphRing && fx.telegraphRadius === 6)).toBe(true);
		expect(effects.some((fx) => fx.isParticleBurst)).toBe(true);
	});

	it('triggerMedicEnergyBeadVFX spawns corridor, trail, decal, and burst along the bead vector', async () => {
		const {
			initScene,
			triggerMedicEnergyBeadVFX,
			getActiveEffects,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		const before = getActiveEffects().length;

		triggerMedicEnergyBeadVFX({
			origin: { x: 2, z: 3 },
			direction: { x: 1, z: 0 },
			beadRange: 8,
			hitWidth: 0.5,
		});

		expect(getActiveEffects().length).toBe(before + 4);
		const effects = getActiveEffects().slice(before);
		const corridor = effects.find((fx) => fx.returning === true);
		expect(corridor).toBeTruthy();
		expect(corridor.returnPasses).toBe(0);
		expect(corridor.range).toBe(8);
		expect(corridor.hitWidth).toBe(0.5);
		expect(effects.some((fx) => fx.isProjectileTrail)).toBe(true);
		expect(effects.some((fx) => fx.isImpactDecal)).toBe(true);
		expect(effects.some((fx) => fx.isParticleBurst)).toBe(true);
	});
});

describe('ENEMY_GEOMETRY export', () => {
	it('exposes the enemy geometry table for tests', () => {
		expect(ENEMY_GEOMETRY.grunt.height).toBe(1);
	});

	it('gives field_medic a distinct small octahedron vs spawner', () => {
		const medic = ENEMY_GEOMETRY.field_medic;
		const spawner = ENEMY_GEOMETRY.spawner;
		expect(medic.type).toBe('octahedron');
		expect(medic.radius).toBeLessThan(spawner.radius);
		expect(medic.color).not.toBe(spawner.color);
		expect(enemyMeshHalfHeight('field_medic')).toBe(medic.radius);
	});

	it('gives ember_wraith a distinct emissive octahedron vs grunt', () => {
		const wraith = ENEMY_GEOMETRY.ember_wraith;
		const grunt = ENEMY_GEOMETRY.grunt;
		expect(wraith.type).toBe('octahedron');
		expect(wraith.emissive).toBe(0xff2200);
		expect(wraith.color).not.toBe(grunt.color);
		expect(enemyMeshHalfHeight('ember_wraith')).toBe(wraith.radius);
		expect(getRegistryTargetFootprint('ember_wraith')).toEqual({ targetHeight: wraith.radius * 2 });
	});

	it('gives arena_champion its own distinct, larger silhouette vs miniboss', () => {
		const champ = ENEMY_GEOMETRY.arena_champion;
		const boss = ENEMY_GEOMETRY.miniboss;
		expect(champ).toBeTruthy();
		expect(champ.radius).toBeGreaterThan(boss.radius);
		expect(champ.height).toBeGreaterThan(boss.height);
		expect(champ.color).not.toBe(boss.color);
		// Half-height helper resolves to its own geometry, not the grunt fallback.
		expect(enemyMeshHalfHeight('arena_champion')).toBe(champ.height / 2);
		expect(enemyMeshHalfHeight('arena_champion')).not.toBe(enemyMeshHalfHeight('grunt'));
	});

	it('gives permafrost_warden a distinct ice-cyan boss silhouette vs glacial_thrower and miniboss', () => {
		const warden = ENEMY_GEOMETRY.permafrost_warden;
		const thrower = ENEMY_GEOMETRY.glacial_thrower;
		const boss = ENEMY_GEOMETRY.miniboss;
		expect(warden).toBeTruthy();
		expect(warden.radius).toBeGreaterThan(thrower.radius);
		expect(warden.height).toBeGreaterThan(thrower.height);
		expect(warden.color).not.toBe(thrower.color);
		expect(warden.color).not.toBe(boss.color);
		expect(enemyMeshHalfHeight('permafrost_warden')).toBe(warden.height / 2);
		expect(enemyMeshHalfHeight('permafrost_warden')).not.toBe(enemyMeshHalfHeight('grunt'));
	});
});

describe('getEnemyRenderScaleForTest()', () => {
	it('falls back to geometry preset height when no mesh is synced', () => {
		expect(getEnemyRenderScaleForTest('missing', 'miniboss')).toEqual({ scale: 2.2 });
		expect(getEnemyRenderScaleForTest('missing', 'grunt')).toEqual({ scale: 1 });
	});

	it('reads world-space height from a live enemy mesh', () => {
		const mesh = createEnemyMesh('miniboss');
		getMeshMaps().enemiesMeshes['boss-1'] = mesh;
		const result = getEnemyRenderScaleForTest('boss-1', 'miniboss');
		expect(result?.scale).toBeGreaterThan(1.5);
		delete getMeshMaps().enemiesMeshes['boss-1'];
	});
});
