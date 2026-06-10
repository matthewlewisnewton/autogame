import * as THREE from 'three';
import { disposeOne } from './disposeMesh.js';
import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from '../collision.js';
import { FLOOR_Y } from '../dungeon.js';
import { getCardDef } from '../cards.js';
import { getAccentHex } from '../cardRenderers.js';

const GROUND_OVERLAY_Y = FLOOR_Y + 0.07;
const DEAD_AVATAR_COLOR = 0x808080;
const NAMEPLATE_OFFSET_Y = 1.0;
const PHASE_STEP_RANGE = 6;

const WINDUP_DEFAULT_ACCENT = 0x38bdf8;
const WINDUP_RING_MIN_SCALE = 0.55;
const WINDUP_RING_MAX_SCALE = 1.5;
const WINDUP_RING_MIN_EMISSIVE = 0.4;
const WINDUP_RING_MAX_EMISSIVE = 2.0;
const WINDUP_RING_MIN_OPACITY = 0.3;
const WINDUP_RING_MAX_OPACITY = 0.7;
const WINDUP_FLASH_MIN_EMISSIVE = 0.35;
const WINDUP_FLASH_MAX_EMISSIVE = 1.6;

/** @type {object | null} */
let ctx = null;

function requireCtx() {
	if (!ctx) throw new Error('playerSync: call createPlayerSync before using player sync helpers');
	return ctx;
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function isPlayerCardWindup(player) {
	return player?.cardUseState === 'windup';
}

/**
 * Normalized 0→1 charge ratio for a card wind-up.
 */
export function computeWindupChargeRatio(now, windupUntil, windUpMs) {
	if (!Number.isFinite(windUpMs) || windUpMs <= 0) return 1;
	if (!Number.isFinite(windupUntil) || windupUntil <= 0) return 0;
	const remaining = windupUntil - now;
	const ratio = 1 - remaining / windUpMs;
	if (ratio <= 0) return 0;
	if (ratio >= 1) return 1;
	return ratio;
}

/** Accent tint (hex int) for a wind-up card, falling back to the default blue. */
export function resolveWindupAccentHex(cardId) {
	const hex = getAccentHex(cardId);
	return hex === undefined ? WINDUP_DEFAULT_ACCENT : hex;
}

function createPhaseStepAllyRing() {
	const geo = new THREE.RingGeometry(0.6, 0.85, 28);
	const mat = new THREE.MeshBasicMaterial({
		color: 0x22d3ee,
		transparent: true,
		opacity: 0.85,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

function createPlayerCardWindupTelegraph(accentHex = WINDUP_DEFAULT_ACCENT) {
	const geo = new THREE.RingGeometry(0.38, 0.58, 32);
	const mat = new THREE.MeshStandardMaterial({
		color: accentHex,
		emissive: accentHex,
		emissiveIntensity: WINDUP_RING_MIN_EMISSIVE,
		transparent: true,
		opacity: WINDUP_RING_MIN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

/**
 * @param {object} context
 */
export function createPlayerSync(context) {
	ctx = context;

	const playerNameplates = {};
	const playerSlowMarkers = {};
	const playerBurnMarkers = {};
	const playerCardWindupMarkers = {};
	const playerCardWindupFlashing = new Set();
	const previousPlayerHp = {};
	let phaseStepTargetId = null;
	let phaseStepAllyRing = null;

	function applyPlayerCardWindupFlash(playerId, isWindup, accentHex = WINDUP_DEFAULT_ACCENT, ratio = 0) {
		const avatar = requireCtx().getPlayersMeshes()[playerId];
		const body = avatar?.userData?.bodyMesh;
		if (!body?.material?.emissive) return;

		if (isWindup) {
			if (!playerCardWindupFlashing.has(playerId)) {
				body.material.emissive.set(accentHex);
				playerCardWindupFlashing.add(playerId);
			}
			body.material.emissiveIntensity = lerp(WINDUP_FLASH_MIN_EMISSIVE, WINDUP_FLASH_MAX_EMISSIVE, ratio);
		} else if (playerCardWindupFlashing.has(playerId)) {
			body.material.emissive.set(0x000000);
			body.material.emissiveIntensity = 0;
			playerCardWindupFlashing.delete(playerId);
		}
	}

	function applyPlayerCardWindupIndicator(id, player, x, z, now = Date.now()) {
		const windup = isPlayerCardWindup(player);
		const targetScene = (typeof window !== 'undefined' && window.___test_scene) || requireCtx().getScene();
		if (windup) {
			const accentHex = resolveWindupAccentHex(player.cardWindupCardId);
			const windUpMs = getCardDef(player.cardWindupCardId)?.windUpMs;
			const ratio = computeWindupChargeRatio(now, player.cardWindupUntil, windUpMs);

			applyPlayerCardWindupFlash(id, true, accentHex, ratio);
			if (!playerCardWindupMarkers[id]) {
				const ring = createPlayerCardWindupTelegraph(accentHex);
				targetScene.add(ring);
				playerCardWindupMarkers[id] = ring;
			}
			const ring = playerCardWindupMarkers[id];
			ring.position.set(x, GROUND_OVERLAY_Y + 0.02, z);
			ring.scale.setScalar(lerp(WINDUP_RING_MIN_SCALE, WINDUP_RING_MAX_SCALE, ratio));
			if (ring.material) {
				ring.material.emissiveIntensity = lerp(WINDUP_RING_MIN_EMISSIVE, WINDUP_RING_MAX_EMISSIVE, ratio);
				ring.material.opacity = lerp(WINDUP_RING_MIN_OPACITY, WINDUP_RING_MAX_OPACITY, ratio);
			}
		} else {
			disposeOne(playerCardWindupMarkers, id, targetScene);
			applyPlayerCardWindupFlash(id, false);
		}
	}

	function createNameplate(username) {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 128;
		const canvasCtx = canvas.getContext('2d');

		canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
		const radius = 20;
		const w = canvas.width;
		const h = canvas.height;
		canvasCtx.beginPath();
		canvasCtx.moveTo(radius, 0);
		canvasCtx.lineTo(w - radius, 0);
		canvasCtx.quadraticCurveTo(w, 0, w, radius);
		canvasCtx.lineTo(w, h - radius);
		canvasCtx.quadraticCurveTo(w, h, w - radius, h);
		canvasCtx.lineTo(radius, h);
		canvasCtx.quadraticCurveTo(0, h, 0, h - radius);
		canvasCtx.lineTo(0, radius);
		canvasCtx.quadraticCurveTo(0, 0, radius, 0);
		canvasCtx.closePath();
		canvasCtx.fill();

		canvasCtx.fillStyle = '#ffffff';
		canvasCtx.font = 'bold 48px sans-serif';
		canvasCtx.textAlign = 'center';
		canvasCtx.textBaseline = 'middle';
		canvasCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		canvasCtx.shadowBlur = 6;
		canvasCtx.fillText(username, w / 2, h / 2);

		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;

		const material = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: false,
		});

		const sprite = new THREE.Sprite(material);
		sprite.scale.set(1.2, 0.3, 1);
		sprite.userData.username = username;

		return sprite;
	}

	function disposeNameplate(playerId) {
		const sprite = playerNameplates[playerId];
		if (!sprite) return;

		if (sprite.parent) {
			sprite.parent.remove(sprite);
		}
		if (sprite.material) {
			if (sprite.material.map) sprite.material.map.dispose();
			sprite.material.dispose();
		}
		delete playerNameplates[playerId];
	}

	function syncPhaseStepAllyHighlight(gs, myId) {
		let nearestId = null;
		const me = myId != null ? gs.players[myId] : null;
		if (
			requireCtx().getGamePhase() === 'playing'
			&& me && !me.dead && !me.extracted
			&& me.equippedKeyItemId === 'phase_step'
		) {
			let bestDist = Infinity;
			for (const [id, p] of Object.entries(gs.players)) {
				if (id === myId || !p || p.dead || p.extracted) continue;
				const d = Math.hypot(p.x - me.x, p.z - me.z);
				if (d <= PHASE_STEP_RANGE && d < bestDist) {
					bestDist = d;
					nearestId = id;
				}
			}
		}

		phaseStepTargetId = nearestId;

		const scene = requireCtx().getScene();
		if (nearestId && gs.players[nearestId]) {
			if (!phaseStepAllyRing) {
				phaseStepAllyRing = createPhaseStepAllyRing();
				scene.add(phaseStepAllyRing);
			}
			const ally = gs.players[nearestId];
			phaseStepAllyRing.position.set(ally.x, GROUND_OVERLAY_Y + 0.02, ally.z);
			phaseStepAllyRing.visible = true;
		} else if (phaseStepAllyRing) {
			phaseStepAllyRing.visible = false;
		}
	}

	/**
	 * Per-frame player mesh sync: positioning, nameplates, status indicators,
	 * shield/smoke VFX follow, and departed-player cleanup.
	 */
	function syncPlayersFrame({ gs, myId }) {
		if (!gs) return;

		const c = requireCtx();
		const scene = c.getScene();
		if (!scene) return;

		const playersMeshes = c.getPlayersMeshes();
		const myX = c.getMyX();
		const myZ = c.getMyZ();
		const playerRotation = c.getPlayerRotation();
		const applySlowIndicator = c.applySlowIndicator;
		const applyBurnIndicator = c.applyBurnIndicator;

		for (const [id, pData] of Object.entries(gs.players)) {
			if (id === myId) {
				applySlowIndicator(playerSlowMarkers, id, {
					slowedUntil: pData.slowedUntil,
					x: myX,
					z: myZ,
				});
				applyBurnIndicator(playerBurnMarkers, id, {
					burningUntil: pData.burningUntil,
					x: myX,
					z: myZ,
				});
			} else {
				applySlowIndicator(playerSlowMarkers, id, pData);
				applyBurnIndicator(playerBurnMarkers, id, pData);
			}

			const windupX = id === myId ? myX : pData.x;
			const windupZ = id === myId ? myZ : pData.z;
			applyPlayerCardWindupIndicator(id, pData, windupX, windupZ, Date.now());

			if (id === myId) continue;

			const body = playersMeshes[id].userData.bodyMesh;
			playersMeshes[id].position.set(pData.x, pData.y || 0.5, pData.z);
			if (Number.isFinite(pData.rotation)) {
				playersMeshes[id].rotation.y = pData.rotation - Math.PI / 2;
			}

			if (pData.dead) {
				body.material.color.setHex(DEAD_AVATAR_COLOR);
			} else {
				body.material.color.setHex(playersMeshes[id].userData.baseColor);
			}

			if (previousPlayerHp[id] !== undefined && pData.hp < previousPlayerHp[id]) {
				c.flashMesh(playersMeshes[id], 0xff0000, 200);
			}
			previousPlayerHp[id] = pData.hp;

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
			playersMeshes[myId].position.set(myX, floorY, myZ);
			playersMeshes[myId].rotation.y = playerRotation - Math.PI / 2;

			const me = gs.players[myId];
			const isDead = me && me.dead;
			const wasDead = c.getWasDead();

			if (wasDead && !isDead) {
				c.resetLocalPlayerOnRespawn();
			}
			if (isDead) {
				c.clearLockOnOnDeath();
			}
			c.setWasDead(isDead);

			const selfBody = playersMeshes[myId].userData.bodyMesh;
			if (isDead) {
				selfBody.material.color.setHex(DEAD_AVATAR_COLOR);
			} else {
				selfBody.material.color.setHex(playersMeshes[myId].userData.baseColor);
			}

			if (!isDead && me && me.isInvulnerable) {
				selfBody.material.transparent = true;
				selfBody.material.opacity = 0.5;
				selfBody.material.depthWrite = false;
			} else {
				selfBody.material.transparent = false;
				selfBody.material.opacity = 1;
				selfBody.material.depthWrite = true;
			}

			if (!isDead && me && me.isBlocking && !c.getShieldVFX(myId)) {
				c.triggerShieldVFX(myId);
			}
			if (c.getShieldVFX(myId)) {
				if (!isDead && me && me.isBlocking) {
					const s = c.getShieldVFX(myId);
					const yaw = playersMeshes[myId].rotation.y + Math.PI / 2;
					const shieldOffset = c.getShieldOffsetDist();
					s.mesh.position.set(
						playersMeshes[myId].position.x + Math.cos(yaw) * shieldOffset,
						playersMeshes[myId].position.y + 0.5,
						playersMeshes[myId].position.z + Math.sin(yaw) * shieldOffset,
					);
					s.mesh.rotation.y = playersMeshes[myId].rotation.y;
				}
			}

			const localX = c.getMyX();
			const localZ = c.getMyZ();
			if (me && previousPlayerHp[myId] !== undefined && me.hp < previousPlayerHp[myId]) {
				const damageAmount = previousPlayerHp[myId] - me.hp;
				c.flashMesh(playersMeshes[myId], 0xff0000, 200);
				c.spawnDamageNumber(localX, 1.5, localZ, damageAmount, '#ff0000');
			}
			if (me) {
				previousPlayerHp[myId] = me.hp;
			}

			const selfUsername = c.getAccountProfile().username;
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

		for (const id of Object.keys(playerNameplates)) {
			if (!gs.players[id]) {
				disposeNameplate(id);
			}
		}

		for (const id of Object.keys(playerSlowMarkers)) {
			if (!gs.players[id]) {
				disposeOne(playerSlowMarkers, id, scene);
			}
		}

		for (const id of Object.keys(playerBurnMarkers)) {
			if (!gs.players[id]) {
				disposeOne(playerBurnMarkers, id, scene);
			}
		}

		for (const id of Object.keys(playerCardWindupMarkers)) {
			if (!gs.players[id]) {
				disposeOne(playerCardWindupMarkers, id, scene);
				playerCardWindupFlashing.delete(id);
			}
		}

		const smokeNow = Date.now();
		for (const [id, pData] of Object.entries(gs.players)) {
			const remaining = (pData.smokeBombUntil || 0) - smokeNow;
			if (remaining > 300 && !c.hasSmokeVFX(id)) {
				c.triggerSmokeVFX({ x: pData.smokeBombX, y: 0, z: pData.smokeBombZ }, id);
			}
		}

		syncPhaseStepAllyHighlight(gs, myId);
	}

	return {
		syncPlayersFrame,
		getPlayerMeshMaps: () => ({
			playerNameplates,
			playerSlowMarkers,
			playerBurnMarkers,
			playerCardWindupMarkers,
		}),
		createNameplate,
		disposeNameplate,
		applyPlayerCardWindupIndicator,
		getPhaseStepTargetId: () => phaseStepTargetId,
		getPlayerCardWindupFlashing: () => playerCardWindupFlashing,
	};
}
