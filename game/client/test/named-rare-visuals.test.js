import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('named-rare enemy visuals', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('parseNamedRareTintHex converts hex strings to color numbers', async () => {
		const { parseNamedRareTintHex } = await import('../renderer.js');

		expect(parseNamedRareTintHex('#ffdd00')).toBe(0xffdd00);
		expect(parseNamedRareTintHex('ffdd00')).toBe(0xffdd00);
		expect(parseNamedRareTintHex('')).toBeNull();
		expect(parseNamedRareTintHex(null)).toBeNull();
	});

	it('applyNamedRareTint sets tint from namedRare and restores the type default', async () => {
		const {
			applyNamedRareTint,
			getMeshMaps,
		} = await import('../renderer.js');

		const { enemiesMeshes } = getMeshMaps();
		const mesh = {
			_origColor: 0xdc2626,
			material: {
				color: {
					setHex(hex) {
						this._hex = hex;
					},
					getHex() {
						return this._hex;
					},
					_hex: 0xdc2626,
				},
			},
		};
		enemiesMeshes.nr1 = mesh;

		applyNamedRareTint('nr1', { namedRare: { tint: '#ffdd00' } });
		expect(mesh.material.color.getHex()).toBe(0xffdd00);

		applyNamedRareTint('nr1', {});
		expect(mesh.material.color.getHex()).toBe(0xdc2626);

		delete enemiesMeshes.nr1;
	});

	it('applyNamedRareScale applies scaleMult and restores base scale', async () => {
		const {
			applyNamedRareScale,
			getMeshMaps,
		} = await import('../renderer.js');

		const { enemiesMeshes } = getMeshMaps();
		const mesh = {
			scale: { x: 1, y: 1, z: 1, set(sx, sy, sz) { this.x = sx; this.y = sy; this.z = sz; } },
		};
		enemiesMeshes.nr2 = mesh;

		applyNamedRareScale('nr2', { namedRare: { scaleMult: 1.25 } });
		expect(mesh.scale.x).toBe(1.25);
		expect(mesh.scale.y).toBe(1.25);
		expect(mesh.scale.z).toBe(1.25);

		applyNamedRareScale('nr2', { namedRare: {} });
		expect(mesh.scale.x).toBe(1);
		expect(mesh.scale.y).toBe(1);
		expect(mesh.scale.z).toBe(1);

		delete enemiesMeshes.nr2;
	});

	it('applyEnemyNameplate creates and disposes sprites keyed on namedRare', async () => {
		const {
			initScene,
			getScene,
			applyEnemyNameplate,
			createEnemyNameplate,
			disposeEnemyNameplate,
			getMeshMaps,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		const { enemyNameplates } = getMeshMaps();

		const standalone = createEnemyNameplate('The Fake in Yellow');
		expect(standalone.userData.namedRareName).toBe('The Fake in Yellow');

		applyEnemyNameplate('nr3', {
			namedRare: { name: 'The Fake in Yellow' },
			x: 2,
			z: 3,
		}, 1.5);
		expect(enemyNameplates.nr3).toBeDefined();
		expect(enemyNameplates.nr3.userData.namedRareName).toBe('The Fake in Yellow');
		expect(getScene().children).toContain(enemyNameplates.nr3);

		applyEnemyNameplate('nr3', { x: 2, z: 3 }, 1.5);
		expect(enemyNameplates.nr3).toBeUndefined();

		disposeEnemyNameplate('nr3');
	});
});
