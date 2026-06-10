/**
 * Optional stage-boss encounter metadata on a quest tier (wired in sub-ticket 05).
 * @typedef {Object} EncounterConfig
 * @property {string} [bossType] - Enemy type for the stage boss (default `miniboss`).
 * @property {string} [landmark] - Layout landmark type for boss spawn (e.g. `arena_dais`).
 * @property {number} [addCount] - Regular adds spawned from the quest enemy pool (boss excluded).
 * @property {{ x: number, z: number }} [spawnAnchor] - Encounter state anchor override.
 */

/**
 * Inline named-rare variant on a scripted quest spawn.
 * @typedef {Object} QuestScriptNamedRareVariant
 * @property {string} name
 * @property {number} [hpMult]
 * @property {number} [damageMult]
 * @property {string} [tint]
 * @property {number} [scaleMult]
 * @property {{ cardId?: string, currency?: number }} drop
 */

/**
 * Guild-counter client copy shown on the quest board before deploy.
 * @typedef {Object} QuestClientConfig
 * @property {string} name - Named client NPC for this contract.
 * @property {string} briefing - Short mission briefing shown before ready-up.
 */

/**
 * Dialogue trigger for mid-run radio lines (fired server-side in a later sub-ticket).
 * @typedef {'run_start' | 'objective_complete' | { itemCollected: number } | { waveCleared: number }} DialogueTrigger
 */

/**
 * Scripted dialogue beat keyed by trigger.
 * @typedef {Object} DialogueEntry
 * @property {DialogueTrigger} trigger
 * @property {string} text
 */

/**
 * Hand-authored scripted wave encounter metadata on a quest tier.
 * @typedef {import('./scriptedEncounters').ScriptedEncounterConfig} ScriptedEncounterConfig
 */

/**
 * Escort NPC metadata on a quest tier using `objectiveType: 'escort'`.
 * @typedef {Object} EscortNpcConfig
 * @property {string} name - Display name for the escort NPC.
 * @property {number} [maxHp] - Escort minion HP (default 80).
 */

/**
 * Escort extraction target on a quest tier.
 * @typedef {Object} EscortDestinationConfig
 * @property {string} [landmark] - Layout landmark type (e.g. `vault_dais`).
 * @property {string} [roomRole] - Room role fallback (e.g. `treasure`).
 */

/**
 * Optional escort objective fields on a quest tier.
 * @property {EscortNpcConfig} [escortNpc] - Friendly NPC to protect and extract.
 * @property {EscortDestinationConfig} [escortDestination] - Extraction landmark or room role.
 * @property {boolean} [escortFailOnDeath=true] - Fail the run when the escort dies.
 */

/**
 * Hand-placed spawn entry for a scripted quest wave.
 * @typedef {Object} QuestScriptSpawn
 * @property {string} type - Enemy type id.
 * @property {number} x - World X coordinate.
 * @property {number} z - World Z coordinate.
 * @property {QuestScriptNamedRareVariant} [variant] - Optional named-rare override.
 */

/**
 * Room binding for a scripted wave trigger (center coords or layout landmark).
 * @typedef {{ x: number, z: number } | { landmark: string }} QuestScriptRoom
 */

/**
 * One authored wave in a quest script.
 * @typedef {Object} QuestScriptWave
 * @property {string} id - Stable wave id for chaining (`waveCleared` triggers).
 * @property {QuestScriptRoom} [room] - Room the wave is bound to.
 * @property {'run_start' | 'enter_room' | { waveCleared: string }} trigger
 * @property {QuestScriptSpawn[]} spawns - Hand-placed enemies for this wave.
 */

/**
 * Normalized quest script returned by `getQuestScript`.
 * @typedef {Object} QuestScript
 * @property {QuestScriptWave[]} waves
 */

const { normalizeNamedRareVariant } = require('./namedRareVariants');
const { generateLayout, questLayoutSeed } = require('./dungeon');

function roundSpawnCoord(value) {
  return Math.round(value * 10) / 10;
}

function spawnOffsetsInRoom(room, count, radiusFrac = 0.22) {
  const radius = Math.min(room.width, room.depth) * radiusFrac;
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    positions.push({
      x: roundSpawnCoord(room.x + Math.cos(angle) * radius),
      z: roundSpawnCoord(room.z + Math.sin(angle) * radius),
    });
  }
  return positions;
}

/**
 * Authored wave script for ember_descent tier 1. Spawn coords are derived from
 * the canonical fire-cavern layout seed so hand-placed enemies stay stable.
 */
function buildEmberDescentTier1Script() {
  const questId = 'ember_descent';
  const tier = 1;
  const seed = questLayoutSeed(questId, tier);
  const layout = generateLayout(seed, 'fire-cavern', { slopes: true, layoutMode: 'default' });
  const rimRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const basinRoom = layout.rooms.find((room) => room.band === 'basin');
  const startPositions = spawnOffsetsInRoom(rimRoom, 5);
  const runStartTypes = ['grunt', 'grunt', 'grunt', 'skirmisher', 'skirmisher'];
  const runStartSpawns = runStartTypes.map((type, index) => ({
    type,
    x: startPositions[index].x,
    z: startPositions[index].z,
  }));
  const cinderghastX = roundSpawnCoord(basinRoom.x);
  const cinderghastZ = roundSpawnCoord(basinRoom.z + basinRoom.depth * 0.15);

  return {
    waves: [
      {
        id: 'wave_run_start',
        trigger: 'run_start',
        spawns: runStartSpawns,
      },
      {
        id: 'wave_inner_cavern',
        trigger: 'enter_room',
        room: { x: basinRoom.x, z: basinRoom.z },
        spawns: [
          {
            type: 'ember_wraith',
            x: cinderghastX,
            z: cinderghastZ,
            variant: {
              name: 'Cinderghast',
              hpMult: 1.5,
              damageMult: 1.25,
              tint: '#f97316',
              scaleMult: 1.1,
              drop: { cardId: 'dragons_breath' },
            },
          },
        ],
      },
    ],
  };
}

const QUEST_DEFS = {
  training_caverns: {
    id: 'training_caverns',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
    ],
    tier2EnemyPool: [{ type: 'field_medic', weight: 1 }],
    tiers: {
      1: {
        name: 'Initiate Vault',
        description: 'Sweep annex holding pens in scripted waves and breach the deeper vault wing.',
        clientNpc: 'Annex Liaison Kade',
        briefing:
          'Salvage crews have barricaded the annex holding pens. '
          + 'Clear each wave, break through the sealed passages, and reach the sealed vault wing.',
        objectiveType: 'defeat_enemies',
        rewardCurrency: 10,
        rewardCardId: 'saber_of_light',
        layoutProfile: 'crowded',
        scriptedEncounters: {
          rooms: [
            {
              roomIndex: 0,
              waves: [
                { spawns: [{ type: 'grunt', count: 2 }] },
              ],
            },
            {
              roomIndex: 1,
              waves: [
                { spawns: [{ type: 'skirmisher', count: 2 }] },
              ],
            },
            {
              roomIndex: 2,
              waves: [
                {
                  spawns: [
                    { type: 'grunt', count: 1 },
                    {
                      type: 'grunt',
                      count: 1,
                      namedRare: {
                        id: 'annex_vault_stalker',
                        displayName: 'Vault Stalker',
                        variantId: 'warded',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          passageLocks: [
            {
              afterWave: { roomIndex: 0, waveIndex: 0 },
              fromRoomIndex: 0,
            },
            {
              afterWave: { roomIndex: 1, waveIndex: 0 },
              fromRoomIndex: 1,
            },
          ],
        },
        dialogueBeacons: [
          {
            beaconId: 'training_start_room',
            trigger: 'onRoomEntered',
            roomIndex: 0,
            speaker: 'Annex Liaison Kade',
            line: 'Entry annex is live. Close with WASD and strike with your melee weapon — two grunts block the bulkhead.',
          },
          {
            beaconId: 'training_wave0_clear',
            trigger: 'onWaveCleared',
            roomIndex: 0,
            waveIndex: 0,
            speaker: 'Annex Liaison Kade',
            line: 'Bulkhead released. Select a card from your hand and play it on the next pack — spells and creatures hit harder than fists alone.',
          },
          {
            beaconId: 'training_annex_enter',
            trigger: 'onRoomEntered',
            roomIndex: 1,
            speaker: 'Annex Liaison Kade',
            line: 'Mid annex ahead. Watch enemy attack telegraphs — dodge roll when you see a wind-up before they connect.',
          },
          {
            beaconId: 'training_vault_enter',
            trigger: 'onRoomEntered',
            roomIndex: 2,
            speaker: 'Annex Liaison Kade',
            line: 'Vault wing unlocked. Vault Stalker is warded — break the shield, then finish the pair.',
          },
        ],
        client: {
          name: 'Rewa',
          briefing:
            'Annex clearance contract. Six hostiles guard the vault sector — neutralize them and I will release your reward stones.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Rewa on channel. Move with WASD, close on the opening grunts, and strike with your melee weapon to start the sweep.',
          },
          {
            trigger: 'objective_complete',
            text: 'Annex sector is clear. Your reward stones are transferring — solid work out there.',
          },
        ],
      },
      2: {
        tier: 2,
        name: 'Initiate Vault — Tier II',
        description: 'Advanced clearance of the derelict annex sector.',
        objectiveType: 'stage_boss',
        rewardCurrency: 10,
        layoutProfile: 'crowded',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'training_caverns', tier: 1 },
        encounter: {
          bossType: 'annex_overseer',
          landmark: 'vault_dais',
          addCount: 4,
        },
        client: {
          name: 'Rewa',
          briefing:
            'Annex overseer contract — Tier II. The vault dais holds an annex overseer with four marked supports; drop them all and your ten reward stones stay on the manifest.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Rewa on annex channel. Overseer signature on the vault dais — clear the supports before you engage.',
          },
          {
            trigger: { waveCleared: 2 },
            text: 'Half the marked supports are down. Overseer is still broadcasting — finish the sweep.',
          },
          {
            trigger: 'objective_complete',
            text: 'Overseer neutralized and annex secure. Stones transferring — Tier II clearance logged.',
          },
        ],
      },
    },
  },
  crystal_rescue: {
    id: 'crystal_rescue',
    enemyPool: [
      { type: 'skirmisher', weight: 3 },
      { type: 'grunt', weight: 2 },
    ],
    tier2EnemyPool: [{ type: 'field_medic', weight: 1 }],
    tiers: {
      1: {
        name: 'Prism Salvage',
        description: 'Recover resonance prisms while clearing scripted guard waves.',
        clientNpc: 'Lattice Custodian Mira',
        briefing:
          'Resonance prisms are still singing in the collapsed lattice. '
          + 'Recover every prism and clear the guard swarms holding each chamber.',
        objectiveType: 'collect_items',
        itemCount: 3,
        rewardCurrency: 12,
        rewardCardId: 'mana_prism',
        layoutProfile: 'open',
        scriptedEncounters: {
          rooms: [
            {
              roomIndex: 0,
              waves: [{ spawns: [{ type: 'skirmisher', count: 2 }] }],
            },
            {
              roomIndex: 1,
              waves: [{ spawns: [{ type: 'grunt', count: 2 }] }],
            },
            {
              roomIndex: 2,
              waves: [{ spawns: [{ type: 'skirmisher', count: 1 }, { type: 'grunt', count: 1 }] }],
            },
          ],
        },
        finalAmbush: {
          spawns: [
            { type: 'skirmisher', count: 2 },
            { type: 'grunt', count: 1 },
          ],
        },
        extractionDestination: { roomRole: 'start' },
        dialogueBeacons: [
          {
            beaconId: 'prism_first',
            trigger: 'onCrystalCollected',
            crystalIndex: 1,
            speaker: 'Lattice Custodian Mira',
            line: 'First prism secured — the lattice hum is stabilizing.',
          },
          {
            beaconId: 'prism_second',
            trigger: 'onCrystalCollected',
            crystalIndex: 2,
            speaker: 'Lattice Custodian Mira',
            line: 'Two down. One more resonance knot and we can seal the breach.',
          },
          {
            beaconId: 'prism_third',
            trigger: 'onCrystalCollected',
            crystalIndex: 3,
            speaker: 'Lattice Custodian Mira',
            line: 'Final prism locked — lattice swarms are converging on your position.',
          },
          {
            beaconId: 'prism_extraction_start',
            trigger: 'onExtractionStart',
            speaker: 'Lattice Custodian Mira',
            line: 'Ambush broken. Fall back to the entry dock — I will hold the channel open.',
          },
          {
            beaconId: 'prism_extraction_dock',
            trigger: 'onExtractionComplete',
            speaker: 'Lattice Custodian Mira',
            line: 'Entry dock secured. Telepipe is hot — step through on my mark.',
          },
        ],
        signatureCardId: 'mana_prism',
        rewardCards: ['mana_prism', 'harvesting_scythe'],
        client: {
          name: 'Lysa',
          briefing:
            'Prism salvage contract. Three resonance prisms remain in the collapsed lattice — recover them intact and your twelve reward stones are already earmarked.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Lysa on salvage channel. Three prisms still resonate in the lattice — bring them back intact.',
          },
          {
            trigger: { itemCollected: 1 },
            text: 'First prism reads stable. Two more signatures on my scope.',
          },
          {
            trigger: { itemCollected: 2 },
            text: 'Second prism locked. One resonance left — stay sharp, hostiles will press.',
          },
          {
            trigger: { itemCollected: 3 },
            text: 'Final prism secured — brace for a lattice ambush at your position.',
          },
          {
            trigger: 'extraction_start',
            text: 'Ambush cleared. Get back to the entry dock before the breach seals.',
          },
          {
            trigger: 'objective_complete',
            text: 'Dock secured. Lattice harmonics stabilizing — extract on my mark.',
          },
        ],
      },
      2: {
        tier: 2,
        name: 'Prism Salvage — Tier II',
        description: 'Recover resonance prisms from the rigid collapsed lattice.',
        objectiveType: 'collect_items',
        itemCount: 5,
        enemyCount: 5,
        rewardCurrency: 18,
        layoutProfile: 'open',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'crystal_rescue', tier: 1 },
        signatureCardId: 'mana_prism',
        rewardCards: ['mana_prism', 'harvesting_scythe'],
        client: {
          name: 'Lysa',
          briefing:
            'Deep prism salvage — Tier II. Five resonance prisms remain in the rigid lattice — recover each intact and eighteen stones are reserved on my ledger.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Lysa on salvage channel. Five prisms in the rigid lattice — each one must come back clean.',
          },
          {
            trigger: { itemCollected: 1 },
            text: 'First prism reads stable. Four more signatures on my scope.',
          },
          {
            trigger: { itemCollected: 2 },
            text: 'Second prism locked. Three left — hostiles are pressing the lattice.',
          },
          {
            trigger: { itemCollected: 3 },
            text: 'Third prism secured. Half the haul accounted for — stay sharp.',
          },
          {
            trigger: { itemCollected: 4 },
            text: 'Fourth prism harmonized. One resonance left in the collapse zone.',
          },
          {
            trigger: { itemCollected: 5 },
            text: 'Final prism secured. All five signatures accounted for.',
          },
          {
            trigger: 'objective_complete',
            text: 'Lattice harmonics stabilizing. Telepipe is live — extract on my mark.',
          },
        ],
      },
    },
  },
  arena_trials: {
    id: 'arena_trials',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
      { type: 'miniboss', weight: 1 },
    ],
    tiers: {
      1: {
        name: 'Arena Trials',
        description: 'Survive the open plaza and rout the trial wardens.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 15,
        layoutProfile: 'open-plaza',
        client: {
          name: 'Venn',
          briefing:
            'Arena trial contract. Six wardens hold the open plaza — rout them and claim the fifteen stones posted to this listing.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Venn monitoring the trials. Six wardens in the plaza — show them why you took this contract.',
          },
          {
            trigger: 'objective_complete',
            text: 'Plaza clear. Trial passed — your stones are released.',
          },
        ],
      },
      2: {
        tier: 2,
        name: 'Arena Trials — Tier II',
        description: 'Face the rigid trial grounds where every warden bears a twisted mark.',
        objectiveType: 'stage_boss',
        rewardCurrency: 15,
        layoutProfile: 'open-plaza',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'arena_trials', tier: 1 },
        encounter: {
          bossType: 'arena_champion',
          landmark: 'arena_dais',
          addCount: 4,
        },
        client: {
          name: 'Venn',
          briefing:
            'Trial grounds contract — Tier II. Face the arena champion on the dais with four twisted supports; fifteen stones post to the winner.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Venn on trial feed. Champion and four marked wardens on the dais — earn your tier.',
          },
          {
            trigger: { waveCleared: 2 },
            text: 'Two supports spent. Champion is still circling the dais — keep pressure on.',
          },
          {
            trigger: 'objective_complete',
            text: 'Champion down. Trial grounds acknowledge the win — stones released.',
          },
        ],
      },
    },
  },
  frost_crossing: {
    id: 'frost_crossing',
    // Signature foe that must always appear in this level's combat spawn set.
    // Level-scoped: only quests that declare this force a guaranteed type.
    guaranteedEnemyType: 'glacial_thrower',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
      // Ice-level signature foe — a ranged thrower that lobs slow ice balls.
      // Level-exclusive: do not add to non-ice quests.
      { type: 'glacial_thrower', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Frost Crossing',
        description:
          'Clear the stone dock, cross the ice band, defeat Rimecast the Slow, '
          + 'and bring down the Permafrost Warden at the south cairn.',
        clientNpc: 'Ice-Watch Courier Sela',
        briefing:
          'The ice band is slick with rimecast ambushes. '
          + 'Cross the ramps, clear the thrower waves, bring down Rimecast the Slow, '
          + 'then defeat the Permafrost Warden guarding the south cairn.',
        objectiveType: 'stage_boss',
        encounter: {
          bossType: 'permafrost_warden',
          landmark: 'ice_cairn',
          addCount: 0,
        },
        rewardCurrency: 14,
        rewardCardId: 'frost_nova',
        layoutProfile: 'ice-cavern',
        scriptedEncounters: {
          rooms: [
            {
              roomIndex: 0,
              waves: [{ spawns: [{ type: 'grunt', count: 2 }] }],
            },
            {
              band: 'ice',
              waves: [
                {
                  spawns: [
                    { type: 'glacial_thrower', count: 1, offset: { x: -9, z: 8 } },
                    { type: 'glacial_thrower', count: 1, offset: { x: 9, z: 8 } },
                  ],
                },
                {
                  spawns: [
                    {
                      type: 'glacial_thrower',
                      count: 1,
                      offset: { x: 0, z: -6 },
                      namedRare: {
                        id: 'frost_rimecast',
                        displayName: 'Rimecast the Slow',
                        variantId: 'frenzied',
                        enemyType: 'glacial_thrower',
                      },
                    },
                    { type: 'skirmisher', count: 1, offset: { x: 7, z: -3 } },
                  ],
                },
              ],
            },
          ],
          passageLocks: [
            {
              afterWave: { roomIndex: 0, waveIndex: 0 },
              fromRoomIndex: 0,
            },
          ],
        },
        dialogueBeacons: [
          {
            beaconId: 'frost_dock_enter',
            trigger: 'onRoomEntered',
            roomIndex: 0,
            speaker: 'Ice-Watch Courier Sela',
            line: 'Stone dock is live. Two grunts hold the ramp gate — clear them before you step onto the ice.',
          },
          {
            beaconId: 'frost_dock_clear',
            trigger: 'onWaveCleared',
            roomIndex: 0,
            waveIndex: 0,
            speaker: 'Ice-Watch Courier Sela',
            line: 'Ramp gate is open. Cross carefully — glacial throwers have the far side of the sheet.',
          },
          {
            beaconId: 'frost_ice_band_enter',
            trigger: 'onRoomEntered',
            band: 'ice',
            speaker: 'Ice-Watch Courier Sela',
            line: 'You are on the ice band — watch your footing and clear the throwers.',
          },
          {
            beaconId: 'frost_rimecast_wave',
            trigger: 'onWaveCleared',
            band: 'ice',
            waveIndex: 0,
            speaker: 'Ice-Watch Courier Sela',
            line: 'First thrower line is down. Rimecast the Slow is winding up across the sheet — finish the crossing.',
          },
          {
            beaconId: 'frost_cairn_warden',
            trigger: 'onWaveCleared',
            band: 'ice',
            waveIndex: 1,
            speaker: 'Ice-Watch Courier Sela',
            line: 'Rimecast is down. The Permafrost Warden sleeps at the south cairn — cross the sheet and wake it when you are ready.',
          },
        ],
        signatureCardId: 'ice_ball',
        rewardCards: ['ice_ball', 'frost_nova', 'permafrost_lance'],
        client: {
          name: 'Cairn',
          briefing:
            'Frost crossing escort. Clear the stone dock, cross the ice sheet, bring down Rimecast the Slow, '
            + 'and defeat the Permafrost Warden at the south cairn for fourteen stones from the research fund.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Cairn on ice-watch channel. Two hostiles guard the stone dock — clear them, cross the ice band, and the Permafrost Warden waits at the south cairn.',
          },
          {
            trigger: { waveCleared: 1 },
            text: 'Ice-band arc is clear. Permafrost Warden signature on the south cairn — engage when you reach the treasure pad.',
          },
          {
            trigger: 'objective_complete',
            text: 'Permafrost Warden down and the crossing is secure. Research fund transfer pending — well done.',
          },
        ],
      },
    },
  },
  canyon_descent: {
    id: 'canyon_descent',
    enemyPool: [
      { type: 'skirmisher', weight: 2 },
      { type: 'grunt', weight: 2 },
      { type: 'miniboss', weight: 1 },
    ],
    tier2EnemyPool: [{ type: 'field_medic', weight: 1 }],
    tiers: {
      1: {
        name: 'Canyon Descent',
        description: 'Clear hostiles from the sunken canyon below the plateau overlook.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 14,
        layoutProfile: 'sunken-canyon',
        client: {
          name: 'Torvek',
          briefing:
            'Canyon descent sweep. Hostiles infest the sunken canyon below the plateau — purge six of them for fourteen reward stones.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Torvek on overwatch. Hostiles are thick on the canyon floor — sweep them before they flank the plateau.',
          },
          {
            trigger: 'objective_complete',
            text: 'Canyon floor is quiet. Fourteen stones are yours — extract when ready.',
          },
        ],
      },
      2: {
        tier: 2,
        name: 'Canyon Descent — Tier II',
        description:
          'Purge the fixed canyon descent where marked hostiles lurk on plateau and floor alike.',
        objectiveType: 'stage_boss',
        rewardCurrency: 14,
        layoutProfile: 'sunken-canyon',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'canyon_descent', tier: 1 },
        encounter: {
          bossType: 'miniboss',
          landmark: 'canyon_monolith',
          addCount: 4,
        },
        client: {
          name: 'Torvek',
          briefing:
            'Canyon warden contract — Tier II. A canyon warden holds the monolith with four marked hostiles; purge the nest for fourteen stones from my survey fund.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Torvek on overwatch. Warden signature at the canyon monolith — thin the supports first.',
          },
          {
            trigger: { waveCleared: 2 },
            text: 'Canyon floor is thinning. Warden is still anchored at the monolith.',
          },
          {
            trigger: 'objective_complete',
            text: 'Warden down and canyon secure. Fourteen stones heading your way.',
          },
        ],
      },
    },
  },
  ember_descent: {
    id: 'ember_descent',
    enemyPool: [
      { type: 'grunt', weight: 3 },
      { type: 'skirmisher', weight: 2 },
      { type: 'ember_wraith', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Ember Descent',
        description: 'Purge hostiles from the volcanic rim overlooking the molten basin.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 14,
        layoutProfile: 'fire-cavern',
        signatureCardId: 'fireball',
        rewardCards: ['fireball', 'dragons_breath'],
        script: buildEmberDescentTier1Script(),
        client: {
          name: 'Ashvelle',
          briefing:
            'Ember rim clearance. Six hostiles patrol the volcanic overlook — neutralize them and collect fourteen stones from my basin survey account.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Ashvelle on the rim feed. Hostiles are circling the basin edge — keep them off my survey lines.',
          },
          {
            trigger: 'objective_complete',
            text: 'Rim is clear. Basin survey proceeds — your stones are transferring now.',
          },
        ],
      },
    },
  },
  spire_ascent: {
    id: 'spire_ascent',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 1 },
      { type: 'miniboss', weight: 1 },
      { type: 'spawner', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Spire Ascent',
        description: 'Fight your way up the tower tiers to claim the summit treasure.',
        objectiveType: 'defeat_enemies',
        enemyCount: 6,
        rewardCurrency: 16,
        layoutProfile: 'spire-ascent',
        signatureCardId: 'gravity_well',
        rewardCards: ['gravity_well'],
        client: {
          name: 'Sela',
          briefing:
            'Spire ascent contract. Fight through six hostiles on the tower tiers — summit treasure aside, sixteen stones are queued for you.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Sela tracking your ascent. Six hostiles between you and the upper tiers — push through.',
          },
          {
            trigger: 'objective_complete',
            text: 'Upper tiers are clear. Sixteen stones released — good climbing.',
          },
        ],
      },
      2: {
        tier: 2,
        name: 'Spire Ascent — Tier II',
        description: 'Ascend the fixed spire where marked hostiles bear twisted power on every tier.',
        objectiveType: 'stage_boss',
        rewardCurrency: 16,
        layoutProfile: 'spire-ascent',
        layoutMode: 'rigid',
        unlockRequires: { questId: 'spire_ascent', tier: 1 },
        signatureCardId: 'gravity_well',
        rewardCards: ['gravity_well'],
        encounter: {
          bossType: 'spire_warden',
          landmark: 'spire_summit',
          addCount: 5,
        },
        client: {
          name: 'Sela',
          briefing:
            'Spire summit contract — Tier II. The summit warden commands five twisted supports across the fixed tiers; sixteen stones queue for a full ascent.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Sela tracking your climb. Summit warden and five marked hostiles between you and the top.',
          },
          {
            trigger: { waveCleared: 3 },
            text: 'Three supports cleared. Summit warden is still holding the upper tier.',
          },
          {
            trigger: 'objective_complete',
            text: 'Summit warden defeated. Ascent logged — sixteen stones released.',
          },
        ],
      },
    },
  },
  annex_escort: {
    id: 'annex_escort',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 1 },
    ],
    tiers: {
      1: {
        name: 'Annex Evacuation',
        description: 'Escort the archivist to the annex treasure vault through ambush lanes.',
        clientNpc: 'Annex Liaison Kade',
        briefing:
          'Archivist Vale carries the annex registry codes. '
          + 'Escort them to the treasure vault and clear every ambush wave along the route.',
        objectiveType: 'escort',
        escortNpc: { name: 'Archivist Vale', maxHp: 70 },
        escortDestination: { roomRole: 'treasure' },
        rewardCurrency: 14,
        rewardCardId: 'echo_blade',
        layoutProfile: 'crowded',
        scriptedEncounters: {
          rooms: [
            {
              roomIndex: 0,
              waves: [{ spawns: [{ type: 'grunt', count: 2 }] }],
            },
            {
              roomIndex: 1,
              waves: [{ spawns: [{ type: 'skirmisher', count: 2 }] }],
            },
          ],
        },
        dialogueBeacons: [
          {
            beaconId: 'escort_start',
            trigger: 'onRoomEntered',
            roomIndex: 0,
            speaker: 'Annex Liaison Kade',
            line: 'Vale is on channel. Keep them alive and reach the vault.',
          },
        ],
      },
    },
  },
  endless_siege: {
    id: 'endless_siege',
    enemyPool: [
      { type: 'grunt', weight: 2 },
      { type: 'skirmisher', weight: 2 },
    ],
    tiers: {
      1: {
        name: 'Endless Siege',
        description: 'Outlast the staggered assault until every attacker has fallen.',
        objectiveType: 'survive',
        totalSpawns: 10,
        minibossCount: 2,
        rewardCurrency: 20,
        layoutProfile: 'open-plaza',
        client: {
          name: 'Marshal Koss',
          briefing:
            'Endless siege hold. Outlast ten staggered attackers including two wardens — hold the line and twenty stones are already on the manifest.',
        },
        dialogue: [
          {
            trigger: 'run_start',
            text: 'Marshal Koss on command. Waves are inbound — hold your ground until every attacker falls.',
          },
          {
            trigger: { waveCleared: 5 },
            text: 'Half the assault spent. Keep the line — wardens are still in the rotation.',
          },
          {
            trigger: 'objective_complete',
            text: 'Siege broken. All hostiles down — twenty stones to the victors.',
          },
        ],
      },
    },
  },
};

const { THEME } = require('./theme');
const CARD_DEFS = require('../shared/cardDefs.json');

const DEFAULT_QUEST_ID = 'training_caverns';
const DEFAULT_QUEST_TIER = 1;

function normalizeQuestTier(tier) {
  if (tier === undefined || tier === null) {
    return DEFAULT_QUEST_TIER;
  }
  const n = Number(tier);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_QUEST_TIER;
}

function getQuestTierDef(questId, tier) {
  const quest = QUEST_DEFS[questId];
  if (!quest || !quest.tiers) {
    return null;
  }
  return quest.tiers[tier] || null;
}

function isValidQuestId(questId) {
  return typeof questId === 'string' && Object.prototype.hasOwnProperty.call(QUEST_DEFS, questId);
}

function isValidQuestSelection(questId, tier) {
  if (!isValidQuestId(questId)) {
    return false;
  }
  const normalizedTier = normalizeQuestTier(tier);
  return getQuestTierDef(questId, normalizedTier) != null;
}

function getQuest(questId, tier) {
  if (!isValidQuestId(questId)) {
    return null;
  }
  const normalizedTier = normalizeQuestTier(tier);
  const tierDef = getQuestTierDef(questId, normalizedTier);
  if (!tierDef) {
    return null;
  }
  const signatureCardId = getSignatureCardId(questId, normalizedTier);
  return {
    id: questId,
    questId,
    tier: normalizedTier,
    ...tierDef,
    dialogue: tierDef.dialogue ?? [],
    signatureCardId,
    signatureCardName: signatureCardId ? CARD_DEFS[signatureCardId]?.name ?? null : null,
  };
}

function getDefaultQuestId() {
  return DEFAULT_QUEST_ID;
}

function listQuests() {
  return Object.keys(QUEST_DEFS)
    .map((questId) => {
      const resolved = getQuest(questId, DEFAULT_QUEST_TIER);
      if (!resolved) return null;
      return {
        ...resolved,
        objectiveSummary: formatObjectiveSummary(resolved),
        rewardSummary: formatRewardSummary(resolved),
        ...questBriefingFields(resolved),
      };
    })
    .filter(Boolean);
}

function formatObjectiveSummary(quest) {
  if (!quest) {
    return '';
  }
  if (quest.objectiveType === 'collect_items') {
    const itemCount = quest.itemCount ?? 0;
    const guardCount = countScriptedEnemiesInQuest(quest);
    if (quest.extractionDestination && quest.finalAmbush) {
      return `Recover ${itemCount} prisms, clear guards and the ambush, extract to entry dock`;
    }
    if (guardCount > 0) {
      return `Recover ${itemCount} prisms and clear ${guardCount} guards`;
    }
    return `Recover ${itemCount} prisms`;
  }
  if (quest.objectiveType === 'defeat_enemies') {
    const scriptedCount = countScriptedEnemiesInQuest(quest);
    const questId = quest.questId || quest.id;
    if (questId === 'frost_crossing' && scriptedCount > 0) {
      return `Cross the ice band and clear ${scriptedCount} scripted hostiles`;
    }
    if (scriptedCount > 0) {
      return `Clear ${scriptedCount} scripted hostiles`;
    }
    return `Neutralize ${quest.enemyCount ?? 0} hostiles`;
  }
  if (quest.objectiveType === 'survive') {
    const totalSpawns = quest.totalSpawns ?? 0;
    const minibossCount = quest.minibossCount ?? 0;
    return `Survive ${totalSpawns} hostiles (${minibossCount} wardens)`;
  }
  if (quest.objectiveType === 'stage_boss') {
    const encounter = getEncounterConfig(quest);
    const addCount = encounter?.addCount ?? 0;
    const questId = quest.questId || quest.id;
    if (questId === 'spire_ascent') {
      if (addCount > 0) {
        return THEME.objectives.defeatSummitWardenWithSupports.replace(
          '{addCount}',
          String(addCount),
        );
      }
      return THEME.objectives.defeatSummitWarden;
    }
    if (questId === 'canyon_descent') {
      if (addCount > 0) {
        return THEME.objectives.defeatCanyonWardenWithSupports.replace(
          '{addCount}',
          String(addCount),
        );
      }
      return THEME.objectives.defeatCanyonWarden;
    }
    if (questId === 'frost_crossing') {
      if (addCount > 0) {
        return THEME.objectives.defeatPermafrostWardenWithSupports.replace(
          '{addCount}',
          String(addCount),
        );
      }
      return THEME.objectives.defeatPermafrostWarden;
    }
    const annexOverseer = encounter?.bossType === 'annex_overseer';
    if (addCount > 0) {
      const template = annexOverseer
        ? THEME.objectives.defeatAnnexOverseerWithSupports
        : THEME.objectives.defeatTrialWardenWithSupports;
      return template.replace('{addCount}', String(addCount));
    }
    return annexOverseer
      ? THEME.objectives.defeatAnnexOverseer
      : THEME.objectives.defeatTrialWarden;
  }
  if (quest.objectiveType === 'escort') {
    const npc = quest.escortNpc?.name || 'VIP';
    const dest = quest.escortDestination?.landmark
      || quest.escortDestination?.roomRole
      || 'extraction';
    return `Escort ${npc} to ${String(dest).replace(/_/g, ' ')}`;
  }
  return quest.description || '';
}

function getEncounterConfig(quest) {
  if (!quest || !quest.encounter || typeof quest.encounter !== 'object') {
    return null;
  }
  return quest.encounter;
}

/** Test/debug fixture quest def — not registered in QUEST_DEFS. */
const ESCORT_OBJECTIVE_FIXTURE_DEF = {
  id: 'escort_objective_fixture',
  enemyPool: [{ type: 'grunt', weight: 1 }],
  tiers: {
    1: {
      name: 'Escort Objective Fixture',
      description: 'Test-only escort objective with scripted ambush waves.',
      clientNpc: 'Extraction Handler',
      briefing: 'Escort the archivist to the arena dais while clearing ambush waves.',
      objectiveType: 'escort',
      escortNpc: { name: 'Archivist Vale', maxHp: 60 },
      escortDestination: { landmark: 'arena_dais' },
      rewardCurrency: 1,
      layoutProfile: 'open-plaza',
      scriptedEncounters: {
        rooms: [
          {
            roomIndex: 0,
            waves: [
              { spawns: [{ type: 'grunt', count: 1 }] },
            ],
          },
        ],
      },
    },
  },
};

/** Test/debug fixture quest def — not registered in QUEST_DEFS. */
const SCRIPTED_ENCOUNTER_FIXTURE_DEF = {
  id: 'scripted_encounter_fixture',
  enemyPool: [{ type: 'grunt', weight: 1 }],
  tiers: {
    1: {
      name: 'Scripted Encounter Fixture',
      description: 'Test-only scripted wave sequencing.',
      clientNpc: 'Test Handler',
      briefing: 'Fixture contract for scripted wave and dialogue beacon QA.',
      objectiveType: 'defeat_enemies',
      rewardCurrency: 1,
      layoutProfile: 'crowded',
      scriptedEncounters: {
        rooms: [
          {
            roomIndex: 0,
            waves: [
              { spawns: [{ type: 'grunt', count: 2 }] },
              { spawns: [{ type: 'skirmisher', count: 1 }] },
            ],
          },
          {
            roomIndex: 1,
            waves: [
              { spawns: [{ type: 'grunt', count: 1 }] },
            ],
          },
          {
            roomIndex: 2,
            waves: [],
          },
        ],
        passageLocks: [
          {
            afterWave: { roomIndex: 0, waveIndex: 0 },
            fromRoomIndex: 0,
          },
          {
            afterWave: { roomIndex: 1, waveIndex: 0 },
            fromRoomIndex: 1,
          },
        ],
      },
      dialogueBeacons: [
        {
          beaconId: 'fixture_wave0_clear',
          trigger: 'onWaveCleared',
          roomIndex: 0,
          waveIndex: 0,
          speaker: 'Test Handler',
          line: 'Bulkhead released — move up.',
        },
      ],
    },
  },
};

function getScriptedEncounterConfig(quest) {
  if (!quest || !quest.scriptedEncounters || typeof quest.scriptedEncounters !== 'object') {
    return null;
  }
  const rooms = quest.scriptedEncounters.rooms;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null;
  }
  return quest.scriptedEncounters;
}

function countScriptedEnemiesInQuest(quest) {
  const config = getScriptedEncounterConfig(quest);
  if (!config) return 0;
  let total = 0;
  for (const roomDef of config.rooms) {
    if (!Array.isArray(roomDef.waves)) continue;
    for (const wave of roomDef.waves) {
      if (!Array.isArray(wave.spawns)) continue;
      for (const spawn of wave.spawns) {
        const count = Number.isFinite(spawn?.count) ? spawn.count : 1;
        total += Math.max(1, Math.floor(count));
      }
    }
  }
  return total;
}

function countFinalAmbushEnemies(quest) {
  const spawns = quest?.finalAmbush?.spawns;
  if (!Array.isArray(spawns) || spawns.length === 0) return 0;
  let total = 0;
  for (const spawn of spawns) {
    const count = Number.isFinite(spawn?.count) ? spawn.count : 1;
    total += Math.max(1, Math.floor(count));
  }
  return total;
}

function normalizeQuestScriptSpawn(spawn) {
  if (!spawn || typeof spawn !== 'object') {
    return null;
  }
  if (typeof spawn.type !== 'string' || !spawn.type) {
    return null;
  }
  if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.z)) {
    return null;
  }
  const normalized = { type: spawn.type, x: spawn.x, z: spawn.z };
  const variant = normalizeNamedRareVariant(spawn.variant);
  if (variant) {
    normalized.variant = variant;
  }
  return normalized;
}

function normalizeQuestScriptWave(wave) {
  if (!wave || typeof wave !== 'object') {
    return null;
  }
  if (typeof wave.id !== 'string' || !wave.id) {
    return null;
  }
  if (!Array.isArray(wave.spawns)) {
    return null;
  }
  const spawns = wave.spawns
    .map(normalizeQuestScriptSpawn)
    .filter(Boolean);
  const normalized = {
    id: wave.id,
    trigger: wave.trigger,
    spawns,
  };
  if (wave.room != null && typeof wave.room === 'object') {
    normalized.room = wave.room;
  }
  return normalized;
}

/**
 * Returns normalized `script.waves` for a quest tier, or `null` when absent.
 * @param {ReturnType<typeof getQuest> | null | undefined} quest
 * @returns {QuestScript | null}
 */
function getQuestScript(quest) {
  if (!quest || !quest.script || typeof quest.script !== 'object') {
    return null;
  }
  if (!Array.isArray(quest.script.waves) || quest.script.waves.length === 0) {
    return null;
  }
  const waves = quest.script.waves
    .map(normalizeQuestScriptWave)
    .filter(Boolean);
  if (waves.length === 0) {
    return null;
  }
  return { waves };
}

/**
 * Sums authored spawn entries across all scripted waves (objective total).
 * @param {QuestScript | null | undefined} script
 * @returns {number}
 */
function countScriptedEnemies(script) {
  if (!script || !Array.isArray(script.waves)) {
    return 0;
  }
  return script.waves.reduce(
    (sum, wave) => sum + (Array.isArray(wave.spawns) ? wave.spawns.length : 0),
    0,
  );
}

function formatRewardSummary(quest) {
  if (!quest) {
    return 'Reward: —';
  }

  const rewardCardName = typeof quest.rewardCardId === 'string' && CARD_DEFS[quest.rewardCardId]
    ? CARD_DEFS[quest.rewardCardId].name
    : null;
  const signatureCardName = !rewardCardName
    ? (quest.signatureCardName
      ?? (quest.signatureCardId ? CARD_DEFS[quest.signatureCardId]?.name ?? null : null))
    : null;
  const cardName = rewardCardName || signatureCardName;

  if (rewardCardName && quest.rewardCurrency != null) {
    return `Reward: ${rewardCardName} + ${quest.rewardCurrency} stones`;
  }
  if (quest.rewardCurrency != null && cardName) {
    return `Reward: ${quest.rewardCurrency} stones + ${cardName}`;
  }
  if (quest.rewardCurrency != null) {
    return `Reward: ${quest.rewardCurrency} stones`;
  }
  if (cardName) {
    return `Reward: ${cardName}`;
  }
  return 'Reward: —';
}

function formatBriefingSummary(quest) {
  if (!quest) return '';
  const body = typeof quest.briefing === 'string' ? quest.briefing.trim() : '';
  if (!body) return quest.description || '';
  const npc = typeof quest.clientNpc === 'string' ? quest.clientNpc.trim() : '';
  if (npc) return `${npc}: ${body}`;
  return body;
}

function formatBriefingRewardLine(quest) {
  if (!quest) return formatRewardSummary(quest);
  if (typeof quest.briefingRewardLine === 'string' && quest.briefingRewardLine.trim()) {
    return quest.briefingRewardLine.trim();
  }
  return formatRewardSummary(quest);
}

function questBriefingFields(quest) {
  if (!quest) return {};
  return {
    clientNpc: quest.clientNpc || null,
    briefing: quest.briefing || null,
    briefingSummary: formatBriefingSummary(quest),
    briefingRewardLine: quest.briefingRewardLine || null,
    briefingRewardText: formatBriefingRewardLine(quest),
  };
}

function listQuestVariants() {
  const variants = [];
  for (const questId of Object.keys(QUEST_DEFS)) {
    const quest = QUEST_DEFS[questId];
    const tierKeys = Object.keys(quest.tiers)
      .map(Number)
      .sort((a, b) => a - b);
    for (const tier of tierKeys) {
      const resolved = getQuest(questId, tier);
      if (!resolved) {
        continue;
      }
      variants.push({
        questId,
        tier,
        id: questId,
        name: resolved.name,
        description: resolved.description,
        objectiveType: resolved.objectiveType,
        objectiveSummary: formatObjectiveSummary(resolved),
        rewardSummary: formatRewardSummary(resolved),
        rewardCurrency: resolved.rewardCurrency,
        isTier2: tier === 2,
        unlockRequires: resolved.unlockRequires || null,
        ...(resolved.client ? { client: resolved.client } : {}),
        ...(resolved.rewardSignatureCard ? { rewardSignatureCard: resolved.rewardSignatureCard } : {}),
        dialogue: resolved.dialogue ?? [],
        ...questBriefingFields(resolved),
      });
    }
  }
  return variants;
}

function getSelectedQuest(gameState) {
  const questId = gameState && gameState.selectedQuestId;
  const tier = gameState && gameState.selectedQuestTier;
  return getQuest(questId, tier) || getQuest(DEFAULT_QUEST_ID, DEFAULT_QUEST_TIER);
}

function buildSharedQuestUpdatePayload(gameState) {
  const selectedQuestId = (gameState && gameState.selectedQuestId) || DEFAULT_QUEST_ID;
  const selectedQuestTier = (gameState && gameState.selectedQuestTier) ?? DEFAULT_QUEST_TIER;
  return {
    selectedQuestId,
    selectedQuestTier,
    quests: listQuests(),
    questVariants: listQuestVariants(),
  };
}

function buildQuestUpdatePayload(gameState, playerAccountId) {
  const payload = buildSharedQuestUpdatePayload(gameState);
  if (playerAccountId) {
    const { getUnlockedQuestTiers } = require('./users');
    payload.unlockedQuestTiers = getUnlockedQuestTiers(playerAccountId) || {};
  }
  return payload;
}

function getLayoutProfileForQuest(questId, tier) {
  const quest = getQuest(questId, tier);
  const fallback = getQuest(DEFAULT_QUEST_ID, DEFAULT_QUEST_TIER);
  return (quest && quest.layoutProfile) || (fallback && fallback.layoutProfile) || 'crowded';
}

/**
 * Layout generation options for a quest tier: slopes always enabled for quest
 * layouts; optional `layoutMode` on the tier def (defaults to 'default').
 */
function getLayoutGenerationOptions(questId, tier) {
  const quest = getQuest(questId, tier);
  const rawMode = quest && quest.layoutMode;
  const layoutMode = rawMode === 'rigid' ? 'rigid' : 'default';
  return { slopes: true, layoutMode };
}

// Returns the enemy spawn pool for a quest, falling back to the default quest's
// pool for an unknown/invalid quest id. Tier 2 merges the base pool with an
// optional quest-level tier2EnemyPool (weights add to the draw).
function getEnemyPool(questId, tier = DEFAULT_QUEST_TIER) {
  const def = isValidQuestId(questId) ? QUEST_DEFS[questId] : null;
  if (!def || !def.enemyPool) {
    return QUEST_DEFS[DEFAULT_QUEST_ID].enemyPool;
  }
  const normalizedTier = normalizeQuestTier(tier);
  if (
    normalizedTier === 2
    && Array.isArray(def.tier2EnemyPool)
    && def.tier2EnemyPool.length > 0
  ) {
    return [...def.enemyPool, ...def.tier2EnemyPool];
  }
  return def.enemyPool;
}

// Returns the quest's guaranteed/signature enemy type (the foe that must always
// appear in its combat spawn set), or null when the quest declares none. Quests
// without a declared type are unaffected — no enemy is forced.
function getGuaranteedEnemyType(questId) {
  const def = isValidQuestId(questId) ? QUEST_DEFS[questId] : null;
  return def && typeof def.guaranteedEnemyType === 'string' ? def.guaranteedEnemyType : null;
}

// Returns the tier's signature reward card id (the card always offered as the
// first post-victory choice), falling back to the first entry of the tier's
// rewardCards pool. Unknown quests/tiers and quests without either field return
// null — no signature card is injected for them.
function getSignatureCardId(questId, tier) {
  const tierDef = isValidQuestId(questId)
    ? getQuestTierDef(questId, normalizeQuestTier(tier))
    : null;
  if (!tierDef) {
    return null;
  }
  if (typeof tierDef.signatureCardId === 'string') {
    return tierDef.signatureCardId;
  }
  if (Array.isArray(tierDef.rewardCards) && tierDef.rewardCards.length > 0) {
    return tierDef.rewardCards[0];
  }
  return null;
}

// Returns the tier's reward card pool for the empty-choices victory fallback,
// falling back to [signatureCardId] when only that is set. Unknown quests/tiers
// and quests without either field return null so callers use the global
// VICTORY_REWARD_ROTATION.
function getQuestRewardCards(questId, tier) {
  const tierDef = isValidQuestId(questId)
    ? getQuestTierDef(questId, normalizeQuestTier(tier))
    : null;
  if (!tierDef) {
    return null;
  }
  if (Array.isArray(tierDef.rewardCards) && tierDef.rewardCards.length > 0) {
    return tierDef.rewardCards;
  }
  if (typeof tierDef.signatureCardId === 'string') {
    return [tierDef.signatureCardId];
  }
  return null;
}

// Draws an enemy `type` from a `[{ type, weight }]` pool in proportion to the
// weights. Deterministic for a given `rng` (defaults to Math.random).
function pickWeightedEnemyType(pool, rng = Math.random) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry.type;
  }
  // Floating-point fallback: return the last entry's type.
  return pool[pool.length - 1].type;
}

module.exports = {
  QUEST_DEFS,
  SCRIPTED_ENCOUNTER_FIXTURE_DEF,
  ESCORT_OBJECTIVE_FIXTURE_DEF,
  DEFAULT_QUEST_ID,
  DEFAULT_QUEST_TIER,
  isValidQuestId,
  isValidQuestSelection,
  normalizeQuestTier,
  getQuest,
  getDefaultQuestId,
  listQuests,
  listQuestVariants,
  getSelectedQuest,
  getLayoutProfileForQuest,
  getLayoutGenerationOptions,
  buildSharedQuestUpdatePayload,
  buildQuestUpdatePayload,
  formatObjectiveSummary,
  formatRewardSummary,
  formatBriefingSummary,
  formatBriefingRewardLine,
  questBriefingFields,
  getEncounterConfig,
  getScriptedEncounterConfig,
  countScriptedEnemiesInQuest,
  countFinalAmbushEnemies,
  getQuestScript,
  countScriptedEnemies,
  getEnemyPool,
  getGuaranteedEnemyType,
  getSignatureCardId,
  getQuestRewardCards,
  pickWeightedEnemyType,
};
