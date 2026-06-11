import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Scene } from 'three';
import {
	ATTACK_EFFECT_UPDATERS,
	registerAttackEffectUpdater,
	resetUnknownAttackEffectKindWarnings,
} from '../renderer/attackEffectUpdaters.js';
import { getActiveEffects, updateAttackEffects } from '../renderer.js';

const DUMMY_KIND = '__testDummyAttackEffect';

describe('attack effect updater registry', () => {
	beforeEach(() => {
		window.___test_scene = new Scene();
		getActiveEffects().length = 0;
		resetUnknownAttackEffectKindWarnings();
		registerAttackEffectUpdater(DUMMY_KIND, (fx, elapsed) => {
			const t = Math.min(elapsed / fx.duration, 1);
			fx.mesh.scale.setScalar(1 + t);
		});
	});

	afterEach(() => {
		delete ATTACK_EFFECT_UPDATERS[DUMMY_KIND];
		getActiveEffects().length = 0;
		resetUnknownAttackEffectKindWarnings();
		delete window.___test_scene;
	});

	it('animates and disposes a registered dummy kind without editing updateAttackEffects', () => {
		const geometry = new BoxGeometry(1, 1, 1);
		const material = new MeshBasicMaterial();
		const mesh = new Mesh(geometry, material);
		window.___test_scene.add(mesh);

		const fx = {
			mesh,
			kind: DUMMY_KIND,
			createdAt: performance.now(),
			duration: 500,
		};
		getActiveEffects().push(fx);

		updateAttackEffects();
		expect(mesh.scale.x).toBeGreaterThan(1);

		fx.createdAt = performance.now() - fx.duration - 50;
		const disposeSpy = vi.spyOn(geometry, 'dispose');
		updateAttackEffects();

		expect(getActiveEffects()).toHaveLength(0);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('throws on unknown kind in vitest and still disposes on expiry', () => {
		const geometry = new BoxGeometry(1, 1, 1);
		const material = new MeshBasicMaterial();
		const mesh = new Mesh(geometry, material);
		window.___test_scene.add(mesh);

		const fx = {
			mesh,
			kind: '__unregisteredKind',
			createdAt: performance.now(),
			duration: 400,
		};
		getActiveEffects().push(fx);

		expect(() => updateAttackEffects()).toThrow(/Unknown attack effect kind/);
		expect(getActiveEffects()).toHaveLength(1);

		fx.createdAt = performance.now() - fx.duration - 50;
		updateAttackEffects();
		expect(getActiveEffects()).toHaveLength(0);
	});
});
