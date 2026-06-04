import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('warded variant visuals', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('variantMarkerColor returns cyan for warded and magenta for other variants', async () => {
		const {
			variantMarkerColor,
			VARIANT_MARKER_COLORS,
			WARDED_TINT,
		} = await import('../renderer.js');

		expect(WARDED_TINT).toBe(0x22d3ee);
		expect(VARIANT_MARKER_COLORS.warded).toBe(0x22d3ee);
		expect(variantMarkerColor('warded')).toBe(0x22d3ee);
		expect(variantMarkerColor('test')).toBe(0xc026d3);
		expect(variantMarkerColor(undefined)).toBe(0xc026d3);
	});

	it('createEnemyMesh stores _origColor from the type palette', async () => {
		const { createEnemyMesh, ENEMY_GEOMETRY } = await import('../renderer.js');

		const mesh = createEnemyMesh('grunt');
		expect(mesh._origColor).toBe(ENEMY_GEOMETRY.grunt.color);
		expect(mesh.material.color.getHex()).toBe(ENEMY_GEOMETRY.grunt.color);
	});

	it('applyEnemyVariantTint sets warded cyan and restores the type default', async () => {
		const {
			applyEnemyVariantTint,
			WARDED_TINT,
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
		enemiesMeshes.e1 = mesh;

		applyEnemyVariantTint('e1', { variant: 'warded' });
		expect(mesh.material.color.getHex()).toBe(WARDED_TINT);

		applyEnemyVariantTint('e1', { variant: 'test' });
		expect(mesh.material.color.getHex()).toBe(0xdc2626);

		applyEnemyVariantTint('e1', {});
		expect(mesh.material.color.getHex()).toBe(0xdc2626);

		delete enemiesMeshes.e1;
	});

	it('applyVariantMarker uses per-variant badge colors on the marker mesh', async () => {
		const { initScene, getScene, applyVariantMarker } = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		applyVariantMarker('w1', { variant: 'warded', type: 'grunt', x: 0, z: 0 });
		applyVariantMarker('t1', { variant: 'test', type: 'grunt', x: 1, z: 0 });

		const markers = getScene().children.filter(
			(c) => c.geometry?._name === 'OctahedronGeometry' && c.material?.color?.getHex,
		);
		expect(markers).toHaveLength(2);

		const wardedMarker = markers.find((m) => m.material.color.getHex() === 0x22d3ee);
		const testMarker = markers.find((m) => m.material.color.getHex() === 0xc026d3);
		expect(wardedMarker).toBeDefined();
		expect(testMarker).toBeDefined();
		expect(wardedMarker.material.emissive.getHex()).toBe(0x22d3ee);
		expect(testMarker.material.emissive.getHex()).toBe(0xc026d3);
	});
});
