// ── Cosmetic Preview ──
// A small, self-contained Three.js scene that renders the player's avatar from
// the current (unsaved) customization selection, shown in the Account overlay's
// Character section. It reuses createPlayerAvatar() from renderer.js so the
// preview matches the in-run avatar exactly (same body shape, body color, and
// accent band).
//
// Lifecycle: all GPU resources (renderer, scene, geometries, materials) are
// created in openPreview() and released in closePreview(). The render loop only
// runs while the panel is open, so repeated open/close neither leaks meshes nor
// keeps an animation loop running while the panel is hidden. This scene is fully
// independent of the main game scene/camera/render loop.

import * as THREE from 'three';
import { createPlayerAvatar, disposeAvatar } from './renderer.js';

let scene = null;
let camera = null;
let renderer = null;
let avatar = null;
let canvas = null;
let rafId = null;

function renderFrame() {
	if (!renderer || !scene || !camera) return;
	rafId = requestAnimationFrame(renderFrame);
	// Slow turntable so the player can see the avatar from all sides.
	if (avatar) avatar.rotation.y += 0.01;
	renderer.render(scene, camera);
}

/**
 * Build the avatar group from a cosmetic and add it to the preview scene.
 * @param {{bodyColor:string,accentColor:string,bodyShape:string}} cosmetic
 */
function mountAvatar(cosmetic) {
	if (!scene) return;
	avatar = createPlayerAvatar(cosmetic, true);
	scene.add(avatar);
}

/**
 * Remove the current avatar from the scene and dispose its GPU resources.
 */
function unmountAvatar() {
	if (!avatar) return;
	if (scene) scene.remove(avatar);
	disposeAvatar(avatar);
	avatar = null;
}

/**
 * Create the preview scene/camera/renderer bound to `canvasEl` and mount an
 * avatar built from `cosmetic`, then start rendering. Safe to call repeatedly:
 * any previous preview is torn down first.
 * @param {HTMLCanvasElement|null} canvasEl
 * @param {{bodyColor:string,accentColor:string,bodyShape:string}} cosmetic
 */
export function openPreview(canvasEl, cosmetic) {
	if (!canvasEl) return;
	// Drop any prior preview so we never double-allocate or stack render loops.
	closePreview();
	canvas = canvasEl;

	const width = canvas.clientWidth || canvas.width || 180;
	const height = canvas.clientHeight || canvas.height || 180;

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0f172a);

	camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
	camera.position.set(0, 0.4, 3.2);
	camera.lookAt(0, 0.2, 0);

	renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio || 1);
	renderer.setSize(width, height, false);

	// Lighting mirrors the in-run scene (ambient + a key directional) so colors
	// read the same as they will in a run.
	const ambient = new THREE.AmbientLight(0xffffff, 0.7);
	scene.add(ambient);
	const directional = new THREE.DirectionalLight(0xffffff, 0.8);
	directional.position.set(3, 5, 4);
	scene.add(directional);

	mountAvatar(cosmetic);
	renderFrame();
}

/**
 * Replace the previewed avatar with a freshly built one from `cosmetic`. The
 * old avatar group is disposed first. No-op if the preview is not open.
 * @param {{bodyColor:string,accentColor:string,bodyShape:string}} cosmetic
 */
export function updatePreview(cosmetic) {
	if (!scene) return;
	const prevRotation = avatar ? avatar.rotation.y : 0;
	unmountAvatar();
	mountAvatar(cosmetic);
	if (avatar) avatar.rotation.y = prevRotation;
}

/**
 * Stop the render loop and dispose every preview GPU resource. Idempotent.
 */
export function closePreview() {
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	unmountAvatar();
	if (renderer) {
		renderer.dispose();
		renderer = null;
	}
	scene = null;
	camera = null;
	canvas = null;
}

/** Whether a preview is currently open (test/debug helper). */
export function isPreviewOpen() {
	return scene !== null;
}
