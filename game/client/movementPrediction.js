import { sampleFloorSurface } from '../shared/floorSampling.esm.js';

/**
 * Match server playerMoveSpeedScale for slippery prediction parity.
 * @param {object|null|undefined} player
 * @param {number} [now]
 * @returns {number}
 */
export function clientMoveSpeedScale(player, now = Date.now()) {
	if (!player) return 1;
	let scale = 1;
	if (now < (player.blockingUntil || 0)) scale *= 0.2;
	if (now < (player.rallyUntil || 0)) scale *= (player.rallySpeedMultiplier || 1);
	if (now < (player.anchorUntil || 0)) scale *= (player.anchorSpeedMultiplier || 0.7);
	return scale;
}

/**
 * One fixed-tick step of local player movement prediction.
 * Mirrors server/simulation.js applyPlayerMovement for a single player.
 *
 * @param {object} params
 * @returns {{ x: number, z: number, vx: number, vz: number }}
 */
export function tickMovementPrediction({
	x,
	z,
	vx = 0,
	vz = 0,
	layout,
	inputDx = 0,
	inputDz = 0,
	inputActive = false,
	speedScale = 1,
	tryPlayerMove,
	colliders,
	walkableAABBs,
	bounds,
	tickRate,
	moveSpeed,
	slipperyAccel,
	slipperyFriction,
	normalStopFriction,
}) {
	let nextVx = vx;
	let nextVz = vz;
	let nextX = x;
	let nextZ = z;
	const tickDt = 1 / tickRate;
	const floorSurface = sampleFloorSurface(layout, x, z);

	if (floorSurface === 'slippery') {
		const maxSpeed = moveSpeed * speedScale;

		if (inputActive) {
			let inputMag = Math.hypot(inputDx, inputDz);
			if (inputMag >= 1e-8) {
				let dirX = inputDx;
				let dirZ = inputDz;
				if (inputMag > 1) {
					dirX /= inputMag;
					dirZ /= inputMag;
				} else {
					inputMag = Math.min(1, inputMag);
				}

				const accel = (slipperyAccel / tickRate) * inputMag * speedScale;
				nextVx += dirX * accel;
				nextVz += dirZ * accel;
			}
		} else {
			nextVx *= slipperyFriction;
			nextVz *= slipperyFriction;
		}

		let speed = Math.hypot(nextVx, nextVz);
		if (speed > maxSpeed) {
			nextVx = (nextVx / speed) * maxSpeed;
			nextVz = (nextVz / speed) * maxSpeed;
			speed = maxSpeed;
		}

		const prevX = x;
		const prevZ = z;

		if (speed >= 1e-4) {
			const dispX = nextVx / tickRate;
			const dispZ = nextVz / tickRate;
			const dispMag = Math.hypot(dispX, dispZ);
			const result = tryPlayerMove(
				x,
				z,
				dispX / dispMag,
				dispZ / dispMag,
				dispMag,
				colliders,
				walkableAABBs,
				bounds,
			);
			nextX = result.x;
			nextZ = result.z;
			nextVx = (result.x - prevX) * tickRate;
			nextVz = (result.z - prevZ) * tickRate;
		} else {
			nextVx = 0;
			nextVz = 0;
		}
	} else {
		nextVx *= normalStopFriction;
		nextVz *= normalStopFriction;
		if (normalStopFriction === 0) {
			nextVx = 0;
			nextVz = 0;
		}

		if (inputActive) {
			const mag = Math.hypot(inputDx, inputDz);
			if (mag >= 1e-8) {
				let dx = inputDx;
				let dz = inputDz;
				if (mag > 1) {
					dx /= mag;
					dz /= mag;
				}

				const result = tryPlayerMove(
					x,
					z,
					dx,
					dz,
					moveSpeed * tickDt * speedScale,
					colliders,
					walkableAABBs,
					bounds,
				);
				nextX = result.x;
				nextZ = result.z;
			}
		}
	}

	return { x: nextX, z: nextZ, vx: nextVx, vz: nextVz };
}
