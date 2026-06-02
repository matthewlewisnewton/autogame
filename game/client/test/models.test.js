import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadMock = vi.fn();

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = loadMock;
	}),
}));

describe('loadModel()', () => {
	beforeEach(() => {
		vi.resetModules();
		loadMock.mockReset();
	});

	it('caches the template and returns independent clones', async () => {
		let cloneCount = 0;
		const clone = vi.fn((deep) => {
			cloneCount += 1;
			return { id: cloneCount, deep };
		});
		const template = { clone };
		loadMock.mockImplementation((_path, onLoad) => onLoad({ scene: template }));

		const { loadModel } = await import('../models.js');
		const a = await loadModel('/models/foo.glb');
		const b = await loadModel('/models/foo.glb');

		expect(loadMock).toHaveBeenCalledTimes(1);
		expect(loadMock).toHaveBeenCalledWith('/models/foo.glb', expect.any(Function), undefined, expect.any(Function));
		expect(clone).toHaveBeenCalledTimes(2);
		expect(a.deep).toBe(true);
		expect(b.deep).toBe(true);
		expect(a).not.toBe(b);
		expect(a.id).not.toBe(b.id);
	});

	it('warns and resolves to null on load failure without rejecting', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const err = new Error('network');
		loadMock.mockImplementation((_path, _onLoad, _onProgress, onError) => onError(err));

		const { loadModel } = await import('../models.js');
		const first = await loadModel('/missing.glb');
		const second = await loadModel('/missing.glb');

		expect(first).toBeNull();
		expect(second).toBeNull();
		expect(loadMock).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith('[models] failed to load', '/missing.glb', err);
		warnSpy.mockRestore();
	});
});
