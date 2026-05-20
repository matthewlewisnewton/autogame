import fs from 'fs';
import path from 'path';

const evolutions = [
	{ id: '063', base: 'Iron Sword', evolved: 'Steel Claymore', effect: 'Increased range and heavy knockback.' },
	{ id: '064', base: 'Flame Blade', evolved: 'Magma Greatsword', effect: 'Leaves a trail of fire on the ground.' },
	{ id: '065', base: 'Battle Familiar', evolved: 'Astral Guardian', effect: 'Attacks faster and grants a small shield.' },
	{ id: '066', base: 'Dungeon Drake', evolved: 'Ancient Wyrm', effect: 'Larger size, higher HP, and occasional fire breath.' },
	{ id: '067', base: 'Saber of Light', evolved: 'Excalibur Photon', effect: 'Massive attack speed; hits twice per swing.' },
	{ id: '068', base: 'Photon Slicer', evolved: 'Infinite Disk', effect: 'Slicer splits into three on the return path.' },
	{ id: '069', base: 'Frost Nova', evolved: 'Glacier Collapse', effect: 'Deals massive damage to frozen targets.' },
	{ id: '070', base: 'Healing Font', evolved: 'Divine Grace', effect: 'Also restores a small amount of Magic Stones.' },
	{ id: '071', base: 'Skeleton Knight', evolved: 'Undead Commander', effect: 'Summons 2 smaller skeletons when played.' },
	{ id: '072', base: 'Storm Eagle', evolved: 'Thunderbird', effect: 'Projectiles now chain between nearby enemies.' },
	{ id: '073', base: 'Gravity Well', evolved: 'Event Horizon', effect: 'Enemies at the center take crushing damage.' },
	{ id: '074', base: 'Echo Blade', evolved: 'Resonance Edge', effect: 'Shockwave now triggers on every second hit.' },
	{ id: '075', base: 'Mana Leach', evolved: 'Soul Drain', effect: 'Also leaches a small amount of HP.' },
	{ id: '076', base: 'Dragon\'s Breath', evolved: 'Inferno Pillar', effect: 'Fire cone is now a full 360° radial burst.' },
];

const commitHash = '70123f1';
const date = '2026-05-19';

for (const evo of evolutions) {
	const dirName = `${evo.id}-evo-${evo.evolved.toLowerCase().replace(/ /g, '-')}`;
	const fullPath = path.join('/home/matt/workspace/autogame/tickets/063-card-evolutions', dirName);
	
	if (!fs.existsSync(fullPath)) {
		fs.mkdirSync(fullPath, { recursive: true });
	}
	
	const content = `# Ticket: Evolution - ${evo.evolved}

> [!NOTE]
> **Staleness note.** This ticket was written against commit \`${commitHash}\` (${date}). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Goal
Implement the evolved form of **${evo.base}**: the **${evo.evolved}**.

## Requirements
- **Stats**: Inherit base stats from ${evo.base} but apply a significant buff (e.g., +50% damage).
- **Special Effect**: ${evo.effect}
- **Visuals**: Define a new icon and color theme for this card.
- **Recipe**: This card is obtained by evolving a \`${evo.base} +10\`.

## Implementation Tasks
- [ ] Add \`${evo.evolved.toLowerCase().replace(/ /g, '_')}\` definition to \`CARD_DEFS\`.
- [ ] Implement the unique ability logic in the server-side \`useCard\` handler.
- [ ] Add visual feedback (particles/sound) for the new effect on the client.

## Verification Plan
1. Evolve a ${evo.base} into a ${evo.evolved}.
2. Verify the special effect triggers correctly during gameplay.
`;

	fs.writeFileSync(path.join(fullPath, 'ticket.md'), content);
}

console.log('Generated 14 evolution tickets.');
