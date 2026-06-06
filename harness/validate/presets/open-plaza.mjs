/**
 * Open Plaza / Arena Trials preset — Tier-2 arena_champion stage boss.
 *
 * Unlike the rooms preset, no arena-specific near-adds / boss-approach /
 * boss-low-hp debug scenarios exist. The run therefore relies on the deploy's
 * live adds, a natural walk-into-trigger encounter activation, and a real
 * full-HP boss defeat. Those scenario fields are intentionally omitted so the
 * driver's optional-scenario guards take the live-gameplay path.
 */
export default {
	questId: 'arena_trials',
	questTier: 2,
	bossType: 'arena_champion',
	deployScenario: 'arena-trials-tier-2',
	encounterTriggerRadius: 8,
	addsTimeoutMs: 90000,
	encounterTimeoutMs: 60000,
};
