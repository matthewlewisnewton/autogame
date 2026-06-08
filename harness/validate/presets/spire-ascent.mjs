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
};
