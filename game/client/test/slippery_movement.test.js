import { describe, it, expect } from 'vitest';
import { tryPlayerMove, computeWalkableAABBs, computeDungeonBounds } from '../dungeon.js';
import { tickMovementPrediction } from '../movementPrediction.js';
import {
	MOVE_SPEED,
	TICK_RATE,
	SLIPPERY_ACCEL,
	SLIPPERY_FRICTION,
	NORMAL_STOP_FRICTION,
} from '../config.js';

function buildSurfaceLayout(floorSurface) {
	return {
		rooms: [{
			x: 0,
			z: 0,
			width: 30,
			depth: 30,
			floorSurface,
			walls: [],
		}],
		passages: [],
	};
}

function makeContext(layout) {
	const walkableAABBs = computeWalkableAABBs(layout);
	const bounds = computeDungeonBounds(layout);
	const colliders = [];
	return { layout, walkableAABBs, bounds, colliders };
}

function tickPrediction(state, context, ticks, input = {}) {
	const {
		inputDx = 0,
		inputDz = 0,
		inputActive = false,
		speedScale = 1,
	} = input;

	for (let i = 0; i < ticks; i++) {
		const next = tickMovementPrediction({
			x: state.x,
			z: state.z,
			vx: state.vx,
			vz: state.vz,
			layout: context.layout,
			inputDx,
			inputDz,
			inputActive,
			speedScale,
			tryPlayerMove,
			colliders: context.colliders,
			walkableAABBs: context.walkableAABBs,
			bounds: context.bounds,
			tickRate: TICK_RATE,
			moveSpeed: MOVE_SPEED,
			slipperyAccel: SLIPPERY_ACCEL,
			slipperyFriction: SLIPPERY_FRICTION,
			normalStopFriction: NORMAL_STOP_FRICTION,
		});
		state.x = next.x;
		state.z = next.z;
		state.vx = next.vx;
		state.vz = next.vz;
	}
}

describe('tickMovementPrediction() — slippery floors', () => {
	it('carries momentum after input release on a slippery floor', () => {
		const context = makeContext(buildSurfaceLayout('slippery'));
		const state = { x: 0, z: 0, vx: 0, vz: 0 };

		tickPrediction(state, context, 12, {
			inputActive: true,
			inputDx: 1,
			inputDz: 0,
		});
		const xAfterInput = state.x;

		tickPrediction(state, context, 5, { inputActive: false });
		expect(state.x).toBeGreaterThan(xAfterInput);
	});

	it('stops immediately on normal floors when input ends', () => {
		const context = makeContext(buildSurfaceLayout('normal'));
		const state = { x: 0, z: 0, vx: 0, vz: 0 };

		tickPrediction(state, context, 12, {
			inputActive: true,
			inputDx: 1,
			inputDz: 0,
		});
		const xAfterInput = state.x;

		tickPrediction(state, context, 8, { inputActive: false });
		expect(state.x).toBeCloseTo(xAfterInput, 5);
		expect(state.vx).toBe(0);
		expect(state.vz).toBe(0);
	});

	it('drifts farther on slippery than normal after input ends', () => {
		const slipperyContext = makeContext(buildSurfaceLayout('slippery'));
		const slipperyState = { x: 0, z: 0, vx: 0, vz: 0 };
		tickPrediction(slipperyState, slipperyContext, 12, {
			inputActive: true,
			inputDx: 1,
			inputDz: 0,
		});
		const slipperyStartX = slipperyState.x;
		tickPrediction(slipperyState, slipperyContext, 8, { inputActive: false });
		const slipperyDrift = slipperyState.x - slipperyStartX;

		const normalContext = makeContext(buildSurfaceLayout('normal'));
		const normalState = { x: 0, z: 0, vx: 0, vz: 0 };
		tickPrediction(normalState, normalContext, 12, {
			inputActive: true,
			inputDx: 1,
			inputDz: 0,
		});
		const normalStartX = normalState.x;
		tickPrediction(normalState, normalContext, 8, { inputActive: false });
		const normalDrift = normalState.x - normalStartX;

		expect(slipperyDrift).toBeGreaterThan(normalDrift);
		expect(normalDrift).toBeCloseTo(0, 5);
	});
});
