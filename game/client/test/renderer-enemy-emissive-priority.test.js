import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockEnemyMesh(origEmissive = 0x000000, origEmissiveIntensity = 0) {
	return {
		_origEmissive: origEmissive,
		_origEmissiveIntensity: origEmissiveIntensity,
		material: {
			emissive: {
				_value: origEmissive,
				set(c) {
					this._value = c;
				},
				getHex() {
					return this._value;
				},
			},
			emissiveIntensity: origEmissiveIntensity,
		},
	};
}

describe('resolveEnemyEmissive priority', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('windup survives a non-reveal reveal pass on the same frame', async () => {
		const {
			applyWindupFlash,
			applyRevealHighlight,
			resolveEnemyEmissive,
			getMeshMaps,
			getWindupFlashing,
		} = await import('../renderer.js');

		const { enemiesMeshes } = getMeshMaps();
		const mesh = createMockEnemyMesh();
		enemiesMeshes.e1 = mesh;

		applyWindupFlash('e1', true);
		applyRevealHighlight('e1', {});
		resolveEnemyEmissive('e1', { attackState: 'windup' });

		expect(mesh.material.emissive.getHex()).toBe(0xff3333);
		expect(mesh.material.emissiveIntensity).toBe(1.5);
		expect(getWindupFlashing().has('e1')).toBe(true);

		delete enemiesMeshes.e1;
		getWindupFlashing().delete('e1');
	});

	it('damage flash beats windup while active', async () => {
		const {
			applyWindupFlash,
			resolveEnemyEmissive,
			flashMesh,
			getMeshMaps,
			getEnemyDamageFlash,
			getWindupFlashing,
		} = await import('../renderer.js');

		const { enemiesMeshes } = getMeshMaps();
		const mesh = createMockEnemyMesh();
		enemiesMeshes.e2 = mesh;

		applyWindupFlash('e2', true);
		resolveEnemyEmissive('e2', { attackState: 'windup' });
		expect(mesh.material.emissive.getHex()).toBe(0xff3333);

		flashMesh(mesh, 0xffffff, 200, 'e2');
		expect(mesh.material.emissive.getHex()).toBe(0xffffff);
		expect(getEnemyDamageFlash().has('e2')).toBe(true);

		resolveEnemyEmissive('e2', { attackState: 'windup' });
		expect(mesh.material.emissive.getHex()).toBe(0xffffff);

		delete enemiesMeshes.e2;
		getWindupFlashing().delete('e2');
		getEnemyDamageFlash().delete('e2');
	});

	it('reveal beats leeching variant tint when no higher-priority effect is active', async () => {
		const {
			applyVariantEmissiveTint,
			resolveEnemyEmissive,
			getMeshMaps,
		} = await import('../renderer.js');

		const { enemiesMeshes } = getMeshMaps();
		const mesh = createMockEnemyMesh();
		enemiesMeshes.e3 = mesh;

		const future = Date.now() + 5000;
		const enemy = { variant: 'leeching', revealedUntil: future };
		applyVariantEmissiveTint('e3', enemy);
		resolveEnemyEmissive('e3', enemy);

		expect(mesh.material.emissive.getHex()).toBe(0xffaa00);
		expect(mesh.material.emissiveIntensity).toBe(1.0);

		delete enemiesMeshes.e3;
	});

	it('falls back to windup after damage flash expires', async () => {
		const {
			applyWindupFlash,
			resolveEnemyEmissive,
			flashMesh,
			getMeshMaps,
			getEnemyDamageFlash,
			getWindupFlashing,
		} = await import('../renderer.js');

		const { enemiesMeshes } = getMeshMaps();
		const mesh = createMockEnemyMesh();
		enemiesMeshes.e4 = mesh;

		applyWindupFlash('e4', true);
		flashMesh(mesh, 0xffffff, 50, 'e4');
		expect(mesh.material.emissive.getHex()).toBe(0xffffff);

		await new Promise((r) => setTimeout(r, 80));
		resolveEnemyEmissive('e4', { attackState: 'windup' });

		expect(getEnemyDamageFlash().has('e4')).toBe(false);
		expect(mesh.material.emissive.getHex()).toBe(0xff3333);
		expect(mesh.material.emissiveIntensity).toBe(1.5);
		expect(getWindupFlashing().has('e4')).toBe(true);

		delete enemiesMeshes.e4;
		getWindupFlashing().delete('e4');
	});
});
