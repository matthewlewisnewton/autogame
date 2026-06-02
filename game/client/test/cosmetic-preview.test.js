import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

describe('cosmetic-preview', () => {
	/** @type {HTMLDivElement} */
	let container;

	beforeEach(() => {
		vi.resetModules();
		container = document.createElement('div');
		container.style.width = '200px';
		container.style.height = '120px';
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('initCosmeticPreview is idempotent for the same container', async () => {
		const { initCosmeticPreview } = await import('../cosmetic-preview.js');
		initCosmeticPreview(container);
		const canvasCount = container.querySelectorAll('canvas').length;
		initCosmeticPreview(container);
		expect(container.querySelectorAll('canvas').length).toBe(canvasCount);
	});

	it('updateCosmeticPreview switches body geometry when bodyShape changes', async () => {
		const RealBox = THREE.BoxGeometry;
		const RealCone = THREE.ConeGeometry;
		const boxSpy = vi.spyOn(THREE, 'BoxGeometry').mockImplementation((...args) => new RealBox(...args));
		const coneSpy = vi.spyOn(THREE, 'ConeGeometry').mockImplementation((...args) => new RealCone(...args));

		const { initCosmeticPreview, updateCosmeticPreview } = await import('../cosmetic-preview.js');
		initCosmeticPreview(container);

		updateCosmeticPreview({
			bodyShape: 'box',
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
		});
		expect(boxSpy).toHaveBeenCalled();

		coneSpy.mockClear();
		updateCosmeticPreview({
			bodyShape: 'cone',
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
		});
		expect(coneSpy).toHaveBeenCalled();
	});

	it('updateCosmeticPreview does not throw when container is detached', async () => {
		const { initCosmeticPreview, updateCosmeticPreview } = await import('../cosmetic-preview.js');
		initCosmeticPreview(container);
		updateCosmeticPreview({
			bodyShape: 'box',
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
		});

		container.remove();
		expect(() => updateCosmeticPreview({
			bodyShape: 'cylinder',
			bodyColor: '#22c55e',
			accentColor: '#ffffff',
		})).not.toThrow();
	});
});
