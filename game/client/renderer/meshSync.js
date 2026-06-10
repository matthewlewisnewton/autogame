// ── Generic Keyed-Mesh-Map Sync Helpers ──
// Domain-agnostic create/update/dispose reconcile utilities for keyed mesh maps
// (id → THREE.Object3D). Shared by renderer.js and the per-domain sync modules.
// Moved verbatim from renderer.js — logic unchanged.

import { disposeMeshTreeSafe } from '../models.js';
import { getScene } from './rendererState.js';

/**
 * Remove and optionally dispose a single mesh from a mesh map.
 * @param {Object} map
 * @param {string} id
 * @param {THREE.Scene} targetScene
 * @param {boolean} [skipDispose]
 */
export function disposeOne(map, id, targetScene, skipDispose) {
	const mesh = map[id];
	if (!mesh) return;
	if (targetScene) targetScene.remove(mesh);
	if (!skipDispose) {
		disposeMeshTreeSafe(mesh);
	}
	delete map[id];
}

/**
 * Iterate a mesh map, remove each mesh from the scene, optionally dispose, and clear.
 * @param {Object} map
 * @param {THREE.Scene} targetScene
 * @param {boolean} [skipDispose]
 */
export function disposeMeshMap(map, targetScene, skipDispose) {
	for (const id of Object.keys(map)) {
		disposeOne(map, id, targetScene, skipDispose);
	}
}

/**
 * Find and dispose meshes in a map whose ids are no longer present in currentIds.
 * @param {Object} map
 * @param {Set<string>} currentIds
 * @param {THREE.Scene} targetScene
 */
export function disposeStaleMeshes(map, currentIds, targetScene) {
	for (const id of Object.keys(map)) {
		if (!currentIds.has(id)) {
			disposeOne(map, id, targetScene);
		}
	}
}

/**
 * Generic keyed-mesh-map reconcile: for each item create-if-missing (adding the
 * new mesh to the scene and storing it in `map`), run `update(mesh, item)` for
 * every item, then dispose meshes whose id has left `items` via
 * disposeStaleMeshes. Encapsulates the create/update/disposeStale pattern that
 * is otherwise inlined across animate().
 * @param {Object} map - id → mesh store, mutated in place
 * @param {Array} items - current snapshot records
 * @param {Object} handlers
 * @param {(item) => string} [handlers.key] - item → id (defaults to item.id)
 * @param {(item) => THREE.Object3D} handlers.create - build a mesh for a new id
 * @param {(mesh, item) => void} handlers.update - update an existing/created mesh
 * @param {THREE.Scene} [targetScene=getScene()] - scene to add/remove meshes from
 */
export function syncMeshMap(map, items, { key = (item) => item.id, create, update }, targetScene = getScene()) {
	const currentIds = new Set();
	for (const item of items) {
		const id = key(item);
		currentIds.add(id);
		let mesh = map[id];
		if (!mesh) {
			mesh = create(item);
			targetScene.add(mesh);
			map[id] = mesh;
		}
		update(mesh, item);
	}
	disposeStaleMeshes(map, currentIds, targetScene);
}
