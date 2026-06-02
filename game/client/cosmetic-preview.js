// Live Three.js preview for account appearance customization (no server round-trip).

import * as THREE from 'three';

const DEFAULT_BODY_COLOR = '#4f9dde';
const DEFAULT_ACCENT_COLOR = '#f2c94c';
const DEFAULT_SHAPE = 'box';
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const VALID_SHAPES = new Set(['box', 'cylinder', 'cone', 'capsule']);

/** @type {CosmeticPreviewState | null} */
let activePreview = null;

/**
 * @typedef {object} CosmeticPreviewState
 * @property {HTMLElement} containerEl
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Group} figureGroup
 * @property {THREE.Mesh | null} bodyMesh
 * @property {THREE.Mesh | null} accentMesh
 * @property {THREE.MeshStandardMaterial} bodyMaterial
 * @property {THREE.MeshStandardMaterial} accentMaterial
 * @property {string | null} currentShape
 * @property {number | null} rafId
 * @property {ResizeObserver | null} resizeObserver
 */

function normalizeShape(shape) {
	return VALID_SHAPES.has(shape) ? shape : DEFAULT_SHAPE;
}

function normalizeHex(hex, fallback) {
	return typeof hex === 'string' && HEX_COLOR_REGEX.test(hex) ? hex : fallback;
}

/**
 * @param {string} shape
 * @returns {THREE.BufferGeometry}
 */
function createBodyGeometry(shape) {
	switch (shape) {
		case 'cylinder':
			return new THREE.CylinderGeometry(0.45, 0.45, 1.2, 24);
		case 'cone':
			return new THREE.ConeGeometry(0.55, 1.2, 24);
		case 'capsule':
			return new THREE.CapsuleGeometry(0.4, 0.6, 8, 16);
		case 'box':
		default:
			return new THREE.BoxGeometry(0.9, 1.2, 0.9);
	}
}

/** Accent ring geometry (shape-independent). */
function createAccentGeometry() {
	return new THREE.RingGeometry(0.12, 0.22, 24);
}

/**
 * @param {THREE.Mesh | null} mesh
 * @param {{ disposeMaterial?: boolean }} [options]
 */
function disposeMeshResources(mesh, options = {}) {
	if (!mesh) return;
	mesh.geometry?.dispose?.();
	if (!options.disposeMaterial) return;
	const mat = mesh.material;
	if (!mat) return;
	if (Array.isArray(mat)) {
		for (const m of mat) m.dispose?.();
	} else {
		mat.dispose?.();
	}
}

/**
 * @param {THREE.Mesh} mesh
 * @param {string} shape
 */
function positionAccentForShape(mesh, shape) {
	const yByShape = {
		box: 0.72,
		cylinder: 0.72,
		cone: 0.68,
		capsule: 0.78,
	};
	mesh.position.y = yByShape[shape] ?? 0.72;
	mesh.rotation.x = -Math.PI / 2;
}

/**
 * Initialize the cosmetic preview inside a container element.
 * Safe to call once when the account overlay opens; repeated calls for the same
 * container are no-ops.
 *
 * @param {HTMLElement | null | undefined} containerEl
 */
export function initCosmeticPreview(containerEl) {
	if (!containerEl || activePreview?.containerEl === containerEl) {
		return;
	}

	if (activePreview) {
		teardownPreview(activePreview);
	}

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x020617);

	const width = Math.max(containerEl.clientWidth || 200, 1);
	const height = Math.max(containerEl.clientHeight || 120, 1);

	const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
	camera.position.set(0, 0.55, 2.35);
	camera.lookAt(0, 0.45, 0);

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setSize(width, height);
	renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
	containerEl.appendChild(renderer.domElement);

	scene.add(new THREE.AmbientLight(0xffffff, 0.65));
	const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
	keyLight.position.set(2, 4, 3);
	scene.add(keyLight);

	const figureGroup = new THREE.Group();
	scene.add(figureGroup);

	const bodyMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_BODY_COLOR, roughness: 0.55 });
	const accentMaterial = new THREE.MeshStandardMaterial({
		color: DEFAULT_ACCENT_COLOR,
		emissive: DEFAULT_ACCENT_COLOR,
		emissiveIntensity: 0.55,
		roughness: 0.4,
		side: THREE.DoubleSide,
	});

	/** @type {CosmeticPreviewState} */
	const state = {
		containerEl,
		scene,
		camera,
		renderer,
		figureGroup,
		bodyMesh: null,
		accentMesh: null,
		bodyMaterial,
		accentMaterial,
		currentShape: null,
		rafId: null,
		resizeObserver: null,
	};

	activePreview = state;

	const resize = () => {
		if (!containerEl.isConnected) return;
		const w = Math.max(containerEl.clientWidth, 1);
		const h = Math.max(containerEl.clientHeight, 1);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
	};

	if (typeof ResizeObserver !== 'undefined') {
		state.resizeObserver = new ResizeObserver(resize);
		state.resizeObserver.observe(containerEl);
	}

	const tick = () => {
		state.rafId = requestAnimationFrame(tick);
		if (!containerEl.isConnected) return;
		figureGroup.rotation.y += 0.008;
		renderer.render(scene, camera);
	};
	tick();

	updateCosmeticPreview({
		bodyShape: DEFAULT_SHAPE,
		bodyColor: DEFAULT_BODY_COLOR,
		accentColor: DEFAULT_ACCENT_COLOR,
	});
}

/**
 * @param {CosmeticPreviewState} state
 */
function teardownPreview(state) {
	if (state.rafId != null) {
		cancelAnimationFrame(state.rafId);
		state.rafId = null;
	}
	state.resizeObserver?.disconnect();
	disposeMeshResources(state.bodyMesh, { disposeMaterial: false });
	disposeMeshResources(state.accentMesh, { disposeMaterial: false });
	state.bodyMaterial?.dispose?.();
	state.accentMaterial?.dispose?.();
	state.renderer?.dispose?.();
	if (state.renderer?.domElement?.parentNode) {
		state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
	}
	if (activePreview === state) {
		activePreview = null;
	}
}

/**
 * Update preview meshes/colors. No-op when preview was never initialized.
 *
 * @param {{ bodyShape?: string, bodyColor?: string, accentColor?: string }} [opts]
 */
export function updateCosmeticPreview(opts = {}) {
	const state = activePreview;
	if (!state) return;

	const shape = normalizeShape(opts.bodyShape ?? state.currentShape ?? DEFAULT_SHAPE);
	const bodyHex = normalizeHex(opts.bodyColor, DEFAULT_BODY_COLOR);
	const accentHex = normalizeHex(opts.accentColor, DEFAULT_ACCENT_COLOR);

	state.bodyMaterial.color.set(bodyHex);
	state.accentMaterial.color.set(accentHex);
	state.accentMaterial.emissive.set(accentHex);

	const shapeChanged = state.currentShape !== shape;

	if (shapeChanged) {
		if (state.bodyMesh) {
			state.figureGroup.remove(state.bodyMesh);
			disposeMeshResources(state.bodyMesh, { disposeMaterial: false });
			state.bodyMesh = null;
		}

		const geometry = createBodyGeometry(shape);
		const bodyMesh = new THREE.Mesh(geometry, state.bodyMaterial);
		bodyMesh.position.y = 0.55;
		state.figureGroup.add(bodyMesh);
		state.bodyMesh = bodyMesh;
		state.currentShape = shape;

		if (state.accentMesh) {
			positionAccentForShape(state.accentMesh, shape);
		}
	}

	if (!state.accentMesh) {
		const accentGeometry = createAccentGeometry();
		const accentMesh = new THREE.Mesh(accentGeometry, state.accentMaterial);
		positionAccentForShape(accentMesh, shape);
		state.figureGroup.add(accentMesh);
		state.accentMesh = accentMesh;
	} else if (!shapeChanged && state.accentMesh) {
		positionAccentForShape(state.accentMesh, shape);
	}

	if (state.containerEl.isConnected && state.renderer) {
		state.renderer.render(state.scene, state.camera);
	}
}
