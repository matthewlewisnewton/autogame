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
import { createPlayerAvatar, disposeAvatar, applyAvatarProportions } from './renderer.js';

let scene = null;
let camera = null;
let renderer = null;
let avatar = null;
let canvas = null;
let rafId = null;
// Latest cosmetic passed to openPreview()/updatePreview(), kept so we can
// re-apply its proportions every frame — the glTF body mesh loads async, so a
// proportion change made before the model is ready must take effect once it is.
let currentCosmetic = null;

/**
 * Re-apply the stored cosmetic's proportions to the mounted avatar. Cheap and
 * a no-op until the morph-bearing body mesh exists (procedural fallback / model
 * still loading), so it is safe to call on every render frame.
 */
function applyStoredProportions() {
	if (avatar) applyAvatarProportions(avatar, currentCosmetic && currentCosmetic.proportions);
}

function renderFrame() {
	if (!renderer || !scene || !camera) return;
	rafId = requestAnimationFrame(renderFrame);
	// Slow turntable so the player can see the avatar from all sides.
	if (avatar) avatar.rotation.y += 0.01;
	// Re-apply proportions each tick so a change made before the async glTF body
	// mesh finished loading still lands once the morph targets exist.
	applyStoredProportions();
	renderer.render(scene, camera);
}

/**
 * Build the avatar group from a cosmetic and add it to the preview scene.
 * @param {{bodyColor:string,accentColor:string,bodyShape:string,hat:string,proportions?:object}} cosmetic
 */
function mountAvatar(cosmetic) {
	if (!scene) return;
	avatar = createPlayerAvatar(cosmetic, true);
	scene.add(avatar);
	// Apply proportions immediately; harmless no-op until morph targets load.
	applyStoredProportions();
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
 * @param {{bodyColor:string,accentColor:string,bodyShape:string,hat:string,proportions?:object}} cosmetic
 */
export function openPreview(canvasEl, cosmetic) {
	if (!canvasEl) return;
	// Drop any prior preview so we never double-allocate or stack render loops.
	closePreview();
	canvas = canvasEl;
	// Store the cosmetic (incl. proportions) so renderFrame() can re-apply it.
	currentCosmetic = cosmetic;

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
 * @param {{bodyColor:string,accentColor:string,bodyShape:string,hat:string,proportions?:object}} cosmetic
 */
export function updatePreview(cosmetic) {
	if (!scene) return;
	// Store the latest cosmetic (incl. proportions) so the preview applies the
	// current proportions on this update and on every subsequent frame.
	currentCosmetic = cosmetic;
	const prevRotation = avatar ? avatar.rotation.y : 0;
	unmountAvatar();
	mountAvatar(cosmetic);
	if (avatar) avatar.rotation.y = prevRotation;
	applyStoredProportions();
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
	currentCosmetic = null;
}

/** Whether a preview is currently open (test/debug helper). */
export function isPreviewOpen() {
	return scene !== null;
}
