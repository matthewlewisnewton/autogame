import { disposeStaleMeshes } from './disposeMesh.js';

/**
 * Generic keyed-mesh reconciler: create meshes for new ids, update existing meshes,
 * and dispose stale entries no longer present in `items`.
 *
 * @param {Object} map - id → mesh map (mutated in place)
 * @param {Array} items - current state items to reconcile against
 * @param {(item: *) => string} getId - stable string id for each item
 * @param {(item: *) => THREE.Object3D} create - build a new mesh (not yet in scene)
 * @param {(mesh: THREE.Object3D, item: *) => void} update - per-frame mesh sync
 * @param {THREE.Scene} scene
 */
export function syncMeshMap(map, items, getId, create, update, scene) {
	const currentIds = new Set(items.map(getId));

	for (const item of items) {
		const id = getId(item);
		let mesh = map[id];
		if (!mesh) {
			mesh = create(item);
			scene.add(mesh);
			map[id] = mesh;
		}
		update(mesh, item);
	}

	disposeStaleMeshes(map, currentIds, scene);
}
