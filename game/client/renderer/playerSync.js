// ── Player-Domain Mesh Sync ──
// Owns the per-frame player reconcile (`syncPlayerMeshes`): cosmetic-driven avatar
// build/rebuild, proportion/key-item application, slow/burn/card-windup ground
// indicators, flying shadows, remote + local positioning, dead/invuln body tint,
// shield + smoke VFX glue, HP-drop flash + damage numbers, nameplates, and the
// per-domain cleanup of markers/shadows/nameplates for players who left.
//
// The local player's kinematic values (myX/myZ/playerRotation) are passed in via
// the `localKinematics` argument built by renderer.js each frame — this module
// never reads or writes those cross-module mutable bindings. The respawn-detection
// reset that reassigns renderer.js's kinematic `let`s stays in renderer.js
// (applyLocalPlayerRespawnReset), invoked from animate() right after this sync.
//
// Scene + keyed mesh-map stores (playersMeshes, playerShadows, playerNameplates,
// playerSlowMarkers, playerBurnMarkers) come from ./rendererState.js so this module
// mutates the same references renderer.js does; generic dispose from ./meshSync.js.
// Floor sampling comes straight from ../collision.js and the account profile from
// ../settings.js. Cross-cutting helpers shared with the rest of renderer.js
// (avatar/nameplate build+dispose, cosmetic application, slow/burn/windup
// indicators, flying-shadow + flash glue, shield/smoke VFX triggers, damage
// numbers) plus the DEAD_AVATAR_COLOR / NAMEPLATE_OFFSET_Y / SHIELD_OFFSET_DIST
// constants and the shieldVFX / smokeVFX / card-windup marker stores are imported
// back from ../renderer.js and only ever invoked/read at call time (per-frame),
// which is safe under ES-module live bindings even though renderer.js also imports
// from this module.

import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from '../collision.js';
import { getAccountProfile } from '../settings.js';
import { disposeOne } from './meshSync.js';
import {
	getScene,
	playersMeshes,
	playerShadows,
	playerNameplates,
	playerSlowMarkers,
	playerBurnMarkers,
} from './rendererState.js';
import {
	cosmeticSignature,
	createPlayerAvatar,
	disposeAvatar,
	applyLoadedModelCosmetic,
	updateKeyItemProp,
	applySlowIndicator,
	applyBurnIndicator,
	applyPlayerCardWindupIndicator,
	flyingRenderOffset,
	syncFlyingShadow,
	flashMesh,
	createNameplate,
	disposeNameplate,
	spawnDamageNumber,
	triggerShieldVFX,
	triggerSmokeVFX,
	DEAD_AVATAR_COLOR,
	NAMEPLATE_OFFSET_Y,
	SHIELD_OFFSET_DIST,
	shieldVFX,
	smokeVFX,
	playerCardWindupMarkers,
	playerCardWindupFlashing,
} from '../renderer.js';

// ── Player damage-flash state (private to this module) ──
const previousPlayerHp = {}; // playerId → hp from previous frame

/**
 * Sync avatar/nameplate/indicator meshes for every player in the snapshot.
 * The local player's kinematic reads come from `localKinematics`; the respawn
 * reset that mutates renderer.js's kinematic `let`s lives in renderer.js.
 * @param {object} gs - live game state
 * @param {string|null} myId - local player id
 * @param {{ myX: number, myZ: number, playerRotation: number }} localKinematics
 */
export function syncPlayerMeshes(gs, myId, localKinematics) {
	const scene = getScene();
	const { myX, myZ, playerRotation } = localKinematics;
	for (const id of Object.keys(gs.players)) {
		const pData = gs.players[id];
		if (!pData) continue;
		// Build the cosmetic-driven avatar, or rebuild it when the player's
		// broadcast cosmetic changes (signature differs from the rendered one).
		const sig = cosmeticSignature(pData.cosmetic);
		if (!playersMeshes[id] || playersMeshes[id].userData.cosmeticKey !== sig) {
			if (playersMeshes[id]) {
				disposeAvatar(playersMeshes[id]);
				scene.remove(playersMeshes[id]);
			}
			const avatar = createPlayerAvatar(pData.cosmetic, id === myId, pData.equippedKeyItemId);
			scene.add(avatar);
			playersMeshes[id] = avatar;
		}

		// (Re)apply proportion morphs + body/accent tint from the broadcast
		// cosmetic every update (local + remote) so changes take effect without
		// a reload; safe no-op on the procedural fallback. Runs before either
		// recolor path below reads userData.baseColor.
		applyLoadedModelCosmetic(playersMeshes[id], pData.cosmetic);

		// (Re)seat the equipped key-item prop when it changes between snapshots
		// (local + remote), so an equip swap takes effect without a reload.
		updateKeyItemProp(playersMeshes[id], pData.equippedKeyItemId);

		// Slow status ring (local + remote) — driven by the broadcast slowedUntil.
		// For the local player, anchor the ring to the predicted myX/myZ (the
		// slower predicted avatar position) so it does not lag behind the avatar
		// while slowed; remote players use their broadcast x/z directly.
		if (id === myId) {
			applySlowIndicator(playerSlowMarkers, id, {
				slowedUntil: pData.slowedUntil,
				x: myX,
				z: myZ,
			});
		} else {
			applySlowIndicator(playerSlowMarkers, id, pData);
		}

		// Burning flame (local + remote) — driven by the broadcast burningUntil.
		// Local player anchors to the predicted myX/myZ like the slow ring so
		// the flame tracks the avatar; remote players use broadcast x/z.
		if (id === myId) {
			applyBurnIndicator(playerBurnMarkers, id, {
				burningUntil: pData.burningUntil,
				x: myX,
				z: myZ,
			});
		} else {
			applyBurnIndicator(playerBurnMarkers, id, pData);
		}

		const windupX = id === myId ? myX : pData.x;
		const windupZ = id === myId ? myZ : pData.z;
		applyPlayerCardWindupIndicator(id, pData, windupX, windupZ, Date.now());

		if (id === myId) continue;

		const body = playersMeshes[id].userData.bodyMesh;
		// Floor-aware airborne height: a flying remote player rises to its
		// broadcast altitude via the shared flyingRenderOffset helper, composed
		// against DEFAULT_FLOOR_Y exactly like flying minions/enemies — the
		// helper (preferring the server-resolved pData.y) already bakes in the
		// floor delta, so DEFAULT_FLOOR_Y + offset resolves to floorY + altitude.
		// A grounded player keeps its broadcast floor y exactly as before.
		const remoteY = pData.flying
			? DEFAULT_FLOOR_Y + flyingRenderOffset(pData, gs.layout)
			: (pData.y || 0.5);
		playersMeshes[id].position.set(pData.x, remoteY, pData.z);
		if (Number.isFinite(pData.rotation)) {
			playersMeshes[id].rotation.y = pData.rotation - Math.PI / 2;
		}
		// Ground shadow beneath a flying remote player (none for grounded).
		syncFlyingShadow(playerShadows, { id, flying: pData.flying, x: pData.x, z: pData.z }, gs.layout);

		if (pData.dead) {
			body.material.color.setHex(DEAD_AVATAR_COLOR);
		} else {
			body.material.color.setHex(playersMeshes[id].userData.baseColor);
		}

		// Detect remote player HP drop — flash red
		if (previousPlayerHp[id] !== undefined && pData.hp < previousPlayerHp[id]) {
			flashMesh(playersMeshes[id], 0xff0000, 200);
		}
		previousPlayerHp[id] = pData.hp;

		// ── Nameplate for remote players (after avatar is positioned) ──
		const remoteUsername = pData.username;
		if (remoteUsername) {
			if (!playerNameplates[id] || playerNameplates[id].userData.username !== remoteUsername) {
				if (playerNameplates[id]) disposeNameplate(id);
				const np = createNameplate(remoteUsername);
				scene.add(np);
				playerNameplates[id] = np;
			}
			const avatar = playersMeshes[id];
			playerNameplates[id].position.set(
				avatar.position.x,
				avatar.position.y + NAMEPLATE_OFFSET_Y,
				avatar.position.z,
			);
		}
	}

	if (myId != null && playersMeshes[myId]) {
		const layout = gs && gs.layout;
		const floorY = layout ? resolveFloorY(sampleFloorY(layout, myX, myZ)) : DEFAULT_FLOOR_Y;
		const me = gs.players[myId];
		// Floor-aware airborne height for the local player, using the same shared
		// helper as enemies/minions/remote players. A grounded player keeps the
		// sampled floor exactly; a flying player rises to its altitude via
		// DEFAULT_FLOOR_Y + flyingRenderOffset (the minion composition, where the
		// helper already bakes in the floor delta → floorY + altitude). Composing
		// against the sampled floorY here would double-count that delta.
		const localFlyingEntity = { flying: me?.flying, altitude: me?.altitude, x: myX, z: myZ };
		const localY = me?.flying
			? DEFAULT_FLOOR_Y + flyingRenderOffset(localFlyingEntity, layout)
			: floorY;
		playersMeshes[myId].position.set(myX, localY, myZ);
		playersMeshes[myId].rotation.y = playerRotation - Math.PI / 2;
		// Ground shadow beneath a flying local player (none for grounded).
		syncFlyingShadow(playerShadows, { id: myId, flying: me?.flying, x: myX, z: myZ }, layout);

		const isDead = me && me.dead;

		// Respawn detection + lock-on clears that reassign renderer.js's kinematic
		// `let`s live in renderer.js (applyLocalPlayerRespawnReset), invoked from
		// animate() right after this sync — see the note at the top of this module.

		const selfBody = playersMeshes[myId].userData.bodyMesh;
		if (isDead) {
			selfBody.material.color.setHex(DEAD_AVATAR_COLOR);
		} else {
			selfBody.material.color.setHex(playersMeshes[myId].userData.baseColor);
		}

		// Invulnerability shimmer: semi-transparent when i-frames are active (not when dead)
		if (!isDead && me && me.isInvulnerable) {
			selfBody.material.transparent = true;
			selfBody.material.opacity = 0.5;
			selfBody.material.depthWrite = false;
		} else {
			selfBody.material.transparent = false;
			selfBody.material.opacity = 1;
			selfBody.material.depthWrite = true;
		}

		// Shield VFX: ensure visible while blocking (re-trigger if expired)
		if (!isDead && me && me.isBlocking && !shieldVFX[myId]) {
			triggerShieldVFX(myId);
		}
		// Update shield position to follow player; clean up when blocking ends
		if (shieldVFX[myId]) {
			if (!isDead && me && me.isBlocking) {
				const s = shieldVFX[myId];
				const yaw = playersMeshes[myId].rotation.y + Math.PI / 2;
				s.mesh.position.set(
					playersMeshes[myId].position.x + Math.cos(yaw) * SHIELD_OFFSET_DIST,
					playersMeshes[myId].position.y + 0.5,
					playersMeshes[myId].position.z + Math.sin(yaw) * SHIELD_OFFSET_DIST,
				);
				s.mesh.rotation.y = playersMeshes[myId].rotation.y;
			} else if (shieldVFX[myId]) {
				// Blocking ended — let existing VFX finish its fade, don't re-trigger
			}
		}

		// Detect local player HP drop — flash red + spawn damage number
		if (me && previousPlayerHp[myId] !== undefined && me.hp < previousPlayerHp[myId]) {
			const damageAmount = previousPlayerHp[myId] - me.hp;
			flashMesh(playersMeshes[myId], 0xff0000, 200);
			spawnDamageNumber(myX, 1.5, myZ, damageAmount, '#ff0000');
		}
		if (me) {
			previousPlayerHp[myId] = me.hp;
		}

		// ── Nameplate for self-player ──
		const selfUsername = getAccountProfile().username;
		if (selfUsername) {
			if (!playerNameplates[myId] || playerNameplates[myId].userData.username !== selfUsername) {
				if (playerNameplates[myId]) disposeNameplate(myId);
				const np = createNameplate(selfUsername);
				scene.add(np);
				playerNameplates[myId] = np;
			}
			const selfAvatar = playersMeshes[myId];
			playerNameplates[myId].position.set(
				selfAvatar.position.x,
				selfAvatar.position.y + NAMEPLATE_OFFSET_Y,
				selfAvatar.position.z,
			);
		}
	}

	// ── Clean up nameplates for players who left ──
	for (const id of Object.keys(playerNameplates)) {
		if (!gs.players[id]) {
			disposeNameplate(id);
		}
	}

	// ── Clean up slow markers for players who left ──
	for (const id of Object.keys(playerSlowMarkers)) {
		if (!gs.players[id]) {
			disposeOne(playerSlowMarkers, id, scene);
		}
	}

	// ── Clean up burn markers for players who left ──
	for (const id of Object.keys(playerBurnMarkers)) {
		if (!gs.players[id]) {
			disposeOne(playerBurnMarkers, id, scene);
		}
	}

	// ── Clean up card wind-up markers for players who left ──
	for (const id of Object.keys(playerCardWindupMarkers)) {
		if (!gs.players[id]) {
			disposeOne(playerCardWindupMarkers, id, scene);
			playerCardWindupFlashing.delete(id);
		}
	}

	// ── Clean up flying shadows for players who left ──
	for (const id of Object.keys(playerShadows)) {
		if (!gs.players[id]) {
			disposeOne(playerShadows, id, scene);
		}
	}

	// ── Smoke Bomb VFX: show a puff at each player's active smoke zone ──
	// The zone is fixed at the cast point (smokeBombX/Z), so the puff is
	// re-triggered while the zone is active if its VFX has faded out. Skip
	// the tail end so a near-expired zone doesn't spawn a fresh 2s puff.
	const smokeNow = Date.now();
	for (const id of Object.keys(gs.players)) {
		const pData = gs.players[id];
		if (!pData) continue;
		const remaining = (pData.smokeBombUntil || 0) - smokeNow;
		if (remaining > 300 && !smokeVFX[id]) {
			triggerSmokeVFX({ x: pData.smokeBombX, y: 0, z: pData.smokeBombZ }, id);
		}
	}
}
