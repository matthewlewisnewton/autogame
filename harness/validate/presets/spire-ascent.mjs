/** Spire Ascent preset — Summit Warden / spire_warden validation (ticket 280). */
export default {
	questId: 'spire_ascent',
	questTier: 2,
	bossType: 'spire_warden',
	deployScenario: 'spire-ascent-tier-2',
	nearAddsScenario: 'spire-ascent-near-adds',
	bossApproachScenario: 'spire-ascent-boss-approach',
	bossLowHpScenario: 'spire-ascent-boss-low-hp',
	addTypes: ['grunt', 'skirmisher', 'miniboss', 'spawner'],
	encounterTriggerRadius: 8,
	addsTimeoutMs: 90000,
	encounterTimeoutMs: 60000,
	lobbyName: 'Spire Ascent Validation',
	// Run the boss health-bar / encounter-HUD + distinct-visual probe during the
	// active boss phase (tickets 283 / 284). Gated so other presets are unaffected.
	probeBossUi: true,
	// Run the slow/burn mutual-exclusivity + heal/cleanse status-card probe during
	// the active boss phase (tickets 301 / 299). Names the live-run card-grant
	// scenarios so the probe stays self-contained. Gated; other presets unaffected.
	probeStatusCards: true,
	statusSlowScenario: 'spire-ascent-status-cards',
	statusBurnScenario: 'spire-ascent-status-burn',
	healCleanseScenario: 'purifying-pulse-ready',
	// Run the wind-up card input-lock + charge-telegraph probe during the active
	// boss phase (ticket 308). The grant scenario is additive so the boss
	// encounter stays intact for the victory step. Gated; other presets unaffected.
	probeWindUp: true,
	windUpScenario: 'spire-ascent-windup-ready',
	// Run the post-combat lifecycle probes (tickets 287 / 289): Telepipe-up vitals
	// persistence and card-charge reset on a fresh sortie. They run after victory
	// as a dedicated re-deploy cycle and reuse a fresh spire launch-booth deploy.
	// Gated; other presets unaffected.
	probeTelepipePersistence: true,
	probeCardChargeReset: true,
	lifecycleScenario: 'spire-ascent-launch-ready',
};
