// ── glTF Model Loading Module ──
// Additive plumbing for loading .glb models via Three.js GLTFLoader. Renderer
// consults MODEL_REGISTRY via attachRegistryModel; enemy types are wired here.
//
// Usage:
//   import { loadModel, modelPathFor, MODEL_REGISTRY } from './models.js';
//   const scene = await loadModel(modelPathFor('player'));
//   if (scene) group.add(scene); // each caller gets a fresh clone
//
// Resilience: a missing/broken/unparseable path logs a warning and resolves to
// null (never throws uncaught, never leaves a hung promise). Failures are cached
// so a bad path is not re-fetched on every call.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Registry mapping entity keys to a model path. Keys match how renderer.js keys
// its meshes: ENEMY_GEOMETRY (enemy types), MINION_VISUAL (minion types),
// createLootMesh (loot kinds), and the player avatar (via cosmetic.modelId →
// modelPathFor). Null means procedural-only.
export const MODEL_REGISTRY = {
	// Player avatar
	player: '/models/player.glb',

	// Enemy types (renderer.js ENEMY_GEOMETRY)
	grunt: '/models/grunt.glb',
	skirmisher: '/models/skirmisher.glb',
	miniboss: '/models/miniboss.glb',
	annex_overseer: null,
	arena_champion: null,
	spire_warden: null,
	spawner: '/models/spawner.glb',
	field_medic: null,
	ember_wraith: null,

	// Minion types (renderer.js MINION_VISUAL)
	ancient_wyrm: '/models/minion-ancient-wyrm.glb',
	null_crawler: '/models/minion-null-crawler.glb',
	bulkhead_mauler: '/models/minion-bulkhead-mauler.glb',

	// Loot kinds (renderer.js createLootMesh)
	currency: null,
	crystal: null,
	magic_stone: null,
};

// Per-path cache of the in-flight/resolved load promise. Concurrent callers for
// the same path share one fetch+parse; resolved entries (including cached null
// failures) are reused so a path is fetched at most once.
const modelCache = new Map();

/** userData key set on geometries/materials owned by the model cache. */
const MODEL_CACHE_SHARED_FLAG = '__modelCacheShared';

function markResourceShared(resource) {
	if (!resource) return;
	if (!resource.userData) resource.userData = {};
	resource.userData[MODEL_CACHE_SHARED_FLAG] = true;
}

/**
 * Tag every mesh geometry/material under a loadModel clone so dispose logic can
 * skip cache-owned GPU resources (shared across all live clones of a path).
 * @param {import('three').Object3D} root
 */
function markModelCloneShared(root) {
	if (!root) return;
	root.traverse((node) => {
		if (!node.isMesh) return;
		markResourceShared(node.geometry);
		const mat = node.material;
		if (Array.isArray(mat)) {
			for (const m of mat) markResourceShared(m);
		} else {
			markResourceShared(mat);
		}
	});
}

/**
 * True when `resource` is a geometry or material tagged by markModelCloneShared.
 * @param {import('three').BufferGeometry|import('three').Material|{ userData?: object }|null|undefined} resource
 * @returns {boolean}
 */
export function isModelCacheShared(resource) {
	return resource?.userData?.[MODEL_CACHE_SHARED_FLAG] === true;
}

/**
 * Look up the registry path for an entity key.
 * @param {string} key - e.g. 'player', 'grunt', 'magic_stone'
 * @returns {string|null} the model path, or null when the key is absent/empty.
 */
export function modelPathFor(key) {
	return MODEL_REGISTRY[key] ?? null;
}

/**
 * Load a .glb model from `path`, fetching+parsing at most once per path.
 *
 * Resolves to a fresh clone(true) of the loaded scene on every call so callers
 * never share a single instance. A missing/broken/unparseable path (or a
 * falsy/empty path) logs a warning and resolves to null; the failure is cached
 * so the path is not re-fetched indefinitely.
 *
 * @param {string} path
 * @returns {Promise<import('three').Object3D|null>}
 */
export function loadModel(path) {
	if (!path) {
		// No path to load (e.g. registry value is null). Resolve to null without
		// caching — there is nothing to fetch.
		return Promise.resolve(null);
	}

	let entry = modelCache.get(path);
	if (!entry) {
		entry = new Promise((resolve) => {
			let loader;
			try {
				loader = new GLTFLoader();
			} catch (err) {
				console.warn(`[models] failed to create GLTFLoader for "${path}":`, err);
				resolve(null);
				return;
			}
			loader.load(
				path,
				(gltf) => resolve(gltf && gltf.scene ? gltf.scene : null),
				undefined,
				(err) => {
					console.warn(`[models] failed to load model "${path}":`, err);
					resolve(null);
				},
			);
		});
		modelCache.set(path, entry);
	}

	// Each caller resolves to its own clone so instances are never shared. A
	// cached null failure stays null.
	return entry.then((scene) => {
		if (!scene) return null;
		const clone = scene.clone(true);
		markModelCloneShared(clone);
		return clone;
	});
}

/** Clear the model cache (testing/dev helper; not used by gameplay). */
export function _clearModelCache() {
	modelCache.clear();
}
