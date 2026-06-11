import eventsCatalog from '../../shared/events.json' with { type: 'json' };
import { renderCardUsed } from '../cardRenderers.js';

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/**
 * Context bundle handed to per-card renderers — created once per bind so the
 * CARD_USED handler does not re-allocate on every event. `myId` is read via a
 * getter so renderers always see the current local player.
 */
function createCardRenderCtx(ctx) {
	return {
		spawnAttackEffect: ctx.spawnAttackEffect,
		spawnSummonEffect: ctx.spawnSummonEffect,
		spawnMinionSummonInEffect: ctx.spawnMinionSummonInEffect,
		spawnLegionMarshalRallyEffect: ctx.spawnLegionMarshalRallyEffect,
		spawnDivineGraceEffect: ctx.spawnDivineGraceEffect,
		spawnEventHorizonEffect: ctx.spawnEventHorizonEffect,
		spawnPurifyingPulseEffect: ctx.spawnPurifyingPulseEffect,
		spawnPurifyingPulseHealRing: ctx.spawnPurifyingPulseHealRing,
		spawnCleanseBurstEffect: ctx.spawnCleanseBurstEffect,
		spawnInfernoPillarEffect: ctx.spawnInfernoPillarEffect,
		spawnGlacierRuptureEffect: ctx.spawnGlacierRuptureEffect,
		spawnManaPrismEffect: ctx.spawnManaPrismEffect,
		spawnEtherSiphonEffect: ctx.spawnEtherSiphonEffect,
		spawnSpikeTrapEffect: ctx.spawnSpikeTrapEffect,
		spawnVolatileExplosionEffect: ctx.spawnVolatileExplosionEffect,
		spawnChainLightningEffect: ctx.spawnChainLightningEffect,
		spawnLightningArc: ctx.spawnLightningArc,
		flashMesh: ctx.flashMesh,
		markCardHitEnemies: ctx.markCardHitEnemies,
		spawnHitSpark: ctx.spawnHitSpark,
		spawnParticleBurst: ctx.spawnParticleBurst,
		spawnProjectileTrail: ctx.spawnProjectileTrail,
		spawnImpactDecal: ctx.spawnImpactDecal,
		spawnTelegraphRing: ctx.spawnTelegraphRing,
		spawnMirrorWardShellEffect: ctx.spawnMirrorWardShellEffect,
		dismissMirrorWardShellEffect: ctx.dismissMirrorWardShellEffect,
		spawnMirrorWardReflectBurst: ctx.spawnMirrorWardReflectBurst,
		enemyMeshes: () => ctx.getMeshMaps().enemiesMeshes,
		playSound: ctx.playSound,
		scheduleAfter: (ms, fn) => setTimeout(fn, ms),
		get myId() { return ctx.myId; },
	};
}

/** Card-use rendering and lightweight combat-feedback Socket.IO listeners. */
export function bindCardHandlers(s, ctx) {
	const cardRenderCtx = createCardRenderCtx(ctx);

	s.on(SERVER_TO_CLIENT.CARD_USED, (data) => {
		if (!data || !ctx.getScene()) return;
		renderCardUsed(data, cardRenderCtx);
	});

	s.on(SERVER_TO_CLIENT.VOLATILE_EXPLOSION, (data) => {
		if (!data || !ctx.getScene()) return;
		const { x, z, radius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		ctx.playSound('volatileExplosion');
		ctx.spawnVolatileExplosionEffect(
			{ x, z },
			Number.isFinite(radius) ? radius : 5,
		);
	});

	// Synced hit feedback: erupt the spike VFX where the server reports a trap
	// firing. Purely additive — no new network traffic or server payload.
	s.on(SERVER_TO_CLIENT.SPIKE_TRAP_TRIGGERED, (data) => {
		if (!data || !ctx.getScene()) return;
		const { x, z, radius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		if (typeof ctx.spawnSpikeTrapEffect !== 'function') return;
		ctx.spawnSpikeTrapEffect(
			{ x, z },
			Number.isFinite(radius) ? radius : 2.5,
		);
	});

	s.on(SERVER_TO_CLIENT.LEECH_HEAL, (data) => {
		if (!data) return;
		ctx.playSound('leechHeal');
	});

	s.on(SERVER_TO_CLIENT.SHIELD_BREAK, (data) => {
		if (!data) return;
		ctx.playSound('shieldBreak');
	});

	s.on(SERVER_TO_CLIENT.QUEST_DIALOGUE, (payload) => {
		ctx.handleQuestDialogue(payload);
	});

	s.on(SERVER_TO_CLIENT.CARD_ERROR, (data) => {
		if (!data || !data.reason) return;
		console.log(`[cardError] ${data.reason}`);
		ctx.showCardErrorToast(data.reason);
		if (data.reason === ctx.THEME.resource.insufficient && ctx.lastUsedSlot >= 0) {
			const slot = ctx.getCardSlotEl(ctx.lastUsedSlot);
			if (slot) slot.classList.add('no-ms');
		}
		ctx.lastUsedSlot = -1;
	});
}
