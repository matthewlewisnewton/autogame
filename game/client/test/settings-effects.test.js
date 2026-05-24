import { describe, it, expect, beforeEach } from 'vitest';
import { patchSettings } from '../settings.js';

describe('settings-driven renderer effects', () => {
	beforeEach(async () => {
		await import('../renderer.js');
	});

	it('spawnHitSpark no-ops when particles are disabled', async () => {
		const { spawnHitSpark, getActiveEffects } = await import('../renderer.js');
		patchSettings({ particlesEnabled: false });
		const before = getActiveEffects().length;
		spawnHitSpark({ x: 0, y: 1, z: 0 });
		expect(getActiveEffects().length).toBe(before);
	});

	it('setDebugHitboxesVisible toggles hitbox overlay visibility', async () => {
		const { setDebugHitboxesVisible, getScene } = await import('../renderer.js');
		const scene = getScene();
		if (!scene) return;
		setDebugHitboxesVisible(true);
		patchSettings({ showHitboxes: true });
		const group = scene.getObjectByName('debugHitboxes');
		if (group) expect(group.visible).toBe(true);
		setDebugHitboxesVisible(false);
		if (group) expect(group.visible).toBe(false);
	});
});
