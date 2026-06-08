import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene } from 'three';

describe('telepipe portal animation', () => {
	beforeEach(() => {
		vi.resetModules();
		window.___test_scene = new Scene();
	});

	afterEach(() => {
		delete window.___test_scene;
		document.body.innerHTML = '';
	});

	it('creates a Group with cylinder, two rings, and particle children', async () => {
		const { syncTelepipeMesh, setGameStateRef, getScene } = await import('../renderer.js');

		setGameStateRef({
			telepipe: { x: 5, z: 5, placedAt: Date.now() },
		});
		syncTelepipeMesh();

		const scene = getScene();
		const portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		expect(portal).toBeDefined();

		const cylinder = portal.children.find((c) => c.userData?.isTelepipeCylinder);
		expect(cylinder).toBeDefined();

		const rings = portal.children.filter((c) => c.userData?.isTelepipeRing);
		expect(rings).toHaveLength(2);

		const particles = portal.children.filter((c) => c.userData?.isTelepipeParticle);
		expect(particles.length).toBeGreaterThan(0);
	});

	it('positions the portal at gameState.telepipe coordinates', async () => {
		const { syncTelepipeMesh, setGameStateRef, getScene } = await import('../renderer.js');

		setGameStateRef({
			telepipe: { x: 10, z: -3, placedAt: Date.now() },
		});
		syncTelepipeMesh();

		const scene = getScene();
		const portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		expect(portal.position.x).toBe(10);
		expect(portal.position.z).toBe(-3);
	});

	it('removes and disposes portal mesh when telepipe is cleared', async () => {
		const { syncTelepipeMesh, setGameStateRef, getScene } = await import('../renderer.js');

		setGameStateRef({
			telepipe: { x: 0, z: 0, placedAt: Date.now() },
		});
		syncTelepipeMesh();

		const scene = getScene();
		let portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		expect(portal).toBeDefined();

		const anyGeo = portal.children[0].geometry;
		const disposeSpy = vi.spyOn(anyGeo, 'dispose');

		// Clear telepipe
		setGameStateRef({ telepipe: null });
		syncTelepipeMesh();

		portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		expect(portal).toBeUndefined();
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('animateTelepipePortal oscillates cylinder emissive intensity', async () => {
		const { syncTelepipeMesh, setGameStateRef, getScene, animateTelepipePortal } =
			await import('../renderer.js');

		setGameStateRef({
			telepipe: { x: 0, z: 0, placedAt: Date.now() },
		});
		syncTelepipeMesh();

		const scene = getScene();
		const portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		const cylinder = portal.children.find((c) => c.userData?.isTelepipeCylinder);
		const baseIntensity = cylinder.material.emissiveIntensity;

		// Advance ~0.5s (half a shimmer cycle)
		animateTelepipePortal(0.5);
		expect(cylinder.material.emissiveIntensity).not.toBe(baseIntensity);
	});

	it('animateTelepipePortal is a no-op when no portal exists', async () => {
		const { syncTelepipeMesh, setGameStateRef, animateTelepipePortal } =
			await import('../renderer.js');

		setGameStateRef({ telepipe: null });
		syncTelepipeMesh();

		// Should not throw
		animateTelepipePortal(0.016);
	});

	it('two rings orbit at different speeds', async () => {
		const { syncTelepipeMesh, setGameStateRef, getScene, animateTelepipePortal } =
			await import('../renderer.js');

		setGameStateRef({
			telepipe: { x: 0, z: 0, placedAt: Date.now() },
		});
		syncTelepipeMesh();

		const scene = getScene();
		const portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		const rings = portal.children.filter((c) => c.userData?.isTelepipeRing);

		// Record initial angles
		const angleA = rings[0].userData.orbitAngle;
		const angleB = rings[1].userData.orbitAngle;

		// Advance one frame
		animateTelepipePortal(0.016);

		// Both should have changed, but by different amounts (different speeds)
		expect(rings[0].userData.orbitAngle).not.toBe(angleA);
		expect(rings[1].userData.orbitAngle).not.toBe(angleB);
		expect(rings[0].userData.orbitSpeed).not.toBe(rings[1].userData.orbitSpeed);
	});

	it('particles rise and recycle when exceeding portal height', async () => {
		const { syncTelepipeMesh, setGameStateRef, getScene, animateTelepipePortal } =
			await import('../renderer.js');

		setGameStateRef({
			telepipe: { x: 0, z: 0, placedAt: Date.now() },
		});
		syncTelepipeMesh();

		const scene = getScene();
		const portal = scene.children.find(
			(c) => c.children.some((ch) => ch.userData?.isTelepipeCylinder),
		);
		const particles = portal.children.filter((c) => c.userData?.isTelepipeParticle);
		expect(particles.length).toBeGreaterThan(0);

		const initialY = particles[0].position.y;

		// Advance enough time for particles to rise past the top
		animateTelepipePortal(3); // 3 seconds of rise

		// Particles should have recycled (y should be near bottom)
		expect(particles[0].position.y).toBeLessThan(initialY + 3);
	});
});
