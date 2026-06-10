// ── Shared Renderer State ──
// Single source of truth for the live Three.js scene reference and the keyed
// mesh-map stores that both renderer.js and the per-domain sync modules
// (player/enemy/minion/loot/...) read and mutate. Owning these here lets the
// domain modules share scene/map references with renderer.js without circular
// imports back into renderer.js.

// ── Scene reference ──
// `scene` is assigned once during scene init (renderer.js calls setScene()).
// Keep it a module-local `let` so getScene() always returns the live value.
let scene = null;

/**
 * Record the live scene. Called from renderer.js during initScene().
 * @param {THREE.Scene|null} s
 */
export function setScene(s) {
	scene = s;
}

/**
 * Get the current scene.
 * @returns {THREE.Scene|null}
 */
export function getScene() {
	// Check test-scene override first (set via window.___test_scene in tests)
	if (typeof window !== 'undefined' && window.___test_scene) {
		return window.___test_scene;
	}
	return scene;
}

// ── Shared keyed mesh-map stores ──
export const playersMeshes = {};
export const playerShadows = {}; // flying player id → ground shadow decal (no entry for grounded players)
export const playerNameplates = {}; // playerId → THREE.Sprite (username label)
export const enemyNameplates = {}; // enemyId → THREE.Sprite (named-rare label)
export const enemiesMeshes = {};
export const enemyHealthBars = {}; // enemy id → health bar mesh
export const enemyShieldBars = {}; // enemy id → shield absorb bar mesh
export const enemyHitboxMeshes = {}; // enemy id → pulsing hitbox group
export const enemyShadows = {}; // flying enemy id → ground shadow decal (no entry for grounded enemies)
export const telegraphMeshes = {}; // enemy id → warning ring mesh (ground circle during windup)
export const minionTelegraphMeshes = {}; // minion id → beam telegraph during windup
export const enemyLockOnRings = {}; // enemy id → lock-on reticle ring
export const variantMarkerMeshes = {}; // enemy id → floating badge for variant ("elite") enemies
export const frenziedTelegraphMeshes = {}; // enemy id → pulsing red ring (pre-enrage telegraph)
export const enemySlowMarkers = {}; // enemy id → icy ground ring shown while slowed
export const playerSlowMarkers = {}; // player id → icy ground ring shown while slowed
export const enemyBurnMarkers = {}; // enemy id → flickering flame shown while burning
export const playerBurnMarkers = {}; // player id → flickering flame shown while burning
export const minionsMeshes = {};
export const minionShadows = {}; // flying minion id → ground shadow decal (no entry for grounded minions)
/** Persistent ground-hazard meshes for armed spike_trap enchantments, keyed by enc.id. */
export const spikeTrapMeshes = {};
export const lootMeshes = {};
export const iceBallMeshes = {}; // ice-ball projectile id → giant icy sphere mesh (glacial thrower)
