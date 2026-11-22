// SHADOW PROTOCOL — the five levels.
// Levels are built with a small builder (border walls, wall rectangles, then
// features placed by tile coordinate) instead of ASCII art, so a typo can
// never silently shift a whole row. Every level is validated by
// tools/validate-levels.mjs before screenshots are taken.
//
// Tile legend (what the builder writes into the grid):
//   '#' wall   '.' floor   'S' shadow (dark, guards cannot see inside)
//   'B' bush / plant (hide)   'G' tall grass (hide — guards cannot see inside)
//   'C' closet (press E to hide inside)
//   'L' lamp floor (warm light pool)   'P' player start   'E' exit
//   '1','2','3' artifacts / documents   'K' keycard   'V' vault / safe

import { CONFIG } from './config.js';

const { COLS, ROWS } = CONFIG;

function blankGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push(c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1 ? '#' : '.');
    }
    grid.push(row);
  }
  return grid;
}

function wallRect(grid, c0, r0, w, h) {
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) grid[r][c] = '#';
  }
}

function set(grid, c, r, ch) {
  grid[r][c] = ch;
}

function shadowRect(grid, c0, r0, w, h) {
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) if (grid[r][c] === '.') grid[r][c] = 'S';
  }
}

// Tall grass: a hiding patch. Walkable, and a player standing in it is
// invisible to vision cones (see player.js / guards.js).
function grassRect(grid, c0, r0, w, h) {
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) if (grid[r][c] === '.') grid[r][c] = 'G';
  }
}

function tileCenter(c, r) {
  return { x: c * CONFIG.TILE + CONFIG.TILE / 2, y: r * CONFIG.TILE + CONFIG.TILE / 2 };
}

// ---------------------------------------------------------------- level 1
function buildMuseum() {
  const grid = blankGrid();
  // Gallery walls: two horizontal partitions with door gaps, one vertical.
  wallRect(grid, 10, 5, 12, 1); // top partition, gap at cols 14-15 left open below
  grid[5][14] = '.'; grid[5][15] = '.';
  wallRect(grid, 16, 10, 1, 6); // vertical divider, gap at row 12
  grid[12][16] = '.';
  wallRect(grid, 4, 12, 8, 1); // lower-left partition, gap at col 7
  grid[12][7] = '.';
  wallRect(grid, 24, 3, 1, 7); // right divider, gap at row 6
  grid[6][24] = '.';
  wallRect(grid, 20, 15, 9, 1); // lower-right partition, gap at col 24
  grid[15][24] = '.';

  // Shadow corridors: the safe routes a patient player finds.
  shadowRect(grid, 6, 1, 2, 4);
  shadowRect(grid, 8, 9, 2, 3);
  shadowRect(grid, 5, 16, 2, 3);
  shadowRect(grid, 27, 13, 2, 4);

  // Tall grass: one patch beside the middle gallery (next to the jade
  // statue), one below the top-right patrol.
  grassRect(grid, 10, 6, 3, 2);
  grassRect(grid, 24, 11, 2, 2);

  // Two solid crates: obstacles in wide rooms, never on a patrol line.
  set(grid, 26, 14, '#');
  set(grid, 8, 16, '#');

  set(grid, 12, 8, 'B'); // potted plant
  set(grid, 20, 3, 'B');
  set(grid, 7, 13, 'B');
  set(grid, 26, 9, 'B');
  set(grid, 28, 5, 'C'); // storage closet
  set(grid, 8, 2, 'L');
  set(grid, 22, 10, 'L');
  set(grid, 14, 17, 'L');

  set(grid, 26, 2, '1'); // artifact: golden mask, top-right gallery
  set(grid, 10, 9, '2'); // artifact: jade statue, middle gallery
  set(grid, 2, 2, 'P');
  set(grid, 29, 17, 'E');

  return {
    name: 'Museum After Dark',
    sub: 'Level 1 — Learn the shadows',
    briefing: 'Two artifacts are on display. Slip past the night guards, take them, and reach the green exit. Shift sneaks. Bushes, dark corners and tall grass hide you — guards cannot see inside grass.',
    objective: 'Steal 2 artifacts, then reach the exit',
    itemLabel: 'Artifacts',
    itemKind: 'artifact',
    itemsNeeded: 2,
    coins: 3,
    par: 150,
    // Warm marble halls: gold lamps, warm grey stone.
    palette: { floorA: '#282b34', floorB: '#22252e', wall: '#474e61', wallTop: '#5d657d', shadow: '#141a2c' },
    // Decor: red carpet runners, framed paintings on the partitions,
    // potted plants, a marble statue, and the two solid crates above.
    decor: [
      { type: 'carpet', c: 12, r: 2 }, { type: 'carpet', c: 13, r: 2 }, { type: 'carpet', c: 14, r: 2 },
      { type: 'carpet', c: 25, r: 16 }, { type: 'carpet', c: 26, r: 16 }, { type: 'carpet', c: 27, r: 16 },
      { type: 'painting', c: 11, r: 5 }, { type: 'painting', c: 19, r: 5 }, { type: 'painting', c: 24, r: 5 },
      { type: 'plant', c: 5, r: 3 }, { type: 'plant', c: 21, r: 8 }, { type: 'plant', c: 27, r: 14 },
      { type: 'statue', c: 3, r: 10 },
      { type: 'crate', c: 26, r: 14, solid: true }, { type: 'crate', c: 8, r: 16, solid: true },
    ],
    grid,
    guards: [
      { path: [[4, 4], [4, 9], [9, 9], [9, 4]], pause: 1.2 },
      { path: [[26, 2], [29, 2], [29, 8], [26, 8]], pause: 1.0 },
      { path: [[6, 14], [14, 14], [14, 18], [6, 18]], pause: 1.4 },
    ],
    cameras: [{ c: 16, r: 1, base: Math.PI / 2, sweep: 0.9, speed: 0.45 }],
    dog: null,
    vault: null,
  };
}

// ---------------------------------------------------------------- level 2
function buildOffice() {
  const grid = blankGrid();
  // Office cubicles: blocks with gaps, so patrols weave between desks.
  wallRect(grid, 6, 4, 5, 1);
  wallRect(grid, 6, 8, 5, 1);
  wallRect(grid, 14, 4, 5, 1);
  wallRect(grid, 14, 8, 5, 1);
  wallRect(grid, 22, 4, 5, 1);
  wallRect(grid, 22, 8, 5, 1);
  wallRect(grid, 10, 12, 1, 5); // vertical cubicle wall, gap at row 14
  grid[14][10] = '.';
  wallRect(grid, 20, 12, 1, 5); // vertical cubicle wall, gap at row 14
  grid[14][20] = '.';
  wallRect(grid, 5, 16, 6, 1); // meeting-room wall, gap at col 8
  grid[16][8] = '.';

  // Shadow routes: the dim service corridor on the left and the back aisle.
  shadowRect(grid, 2, 2, 2, 7);
  shadowRect(grid, 2, 11, 2, 6);
  shadowRect(grid, 24, 13, 2, 4);
  shadowRect(grid, 12, 16, 6, 1);

  // Tall grass: one patch on the first guard's route, one on the fourth's.
  grassRect(grid, 12, 6, 2, 2);
  grassRect(grid, 24, 10, 3, 2);

  // Two solid crates, inside the patrol rectangles, never on a patrol line.
  set(grid, 15, 13, '#');
  set(grid, 27, 13, '#');

  set(grid, 10, 5, 'B');
  set(grid, 21, 12, 'B');
  set(grid, 8, 16, 'B');
  set(grid, 25, 8, 'B');
  set(grid, 2, 9, 'C');
  set(grid, 29, 10, 'C');
  set(grid, 16, 2, 'L');
  set(grid, 6, 10, 'L');
  set(grid, 24, 16, 'L');

  set(grid, 4, 16, 'K'); // keycard, in the meeting room
  set(grid, 28, 2, 'V'); // safe, top-right corner office
  set(grid, 2, 2, 'P');
  set(grid, 29, 18, 'E');

  return {
    name: 'The Office Tower',
    sub: 'Level 2 — Keycard and safe',
    briefing: 'The safe needs a keycard. Find the card in the meeting room, open the safe, then reach the exit. The watcher at the central desk never walks — but he always looks.',
    objective: 'Find the keycard, open the safe, then reach the exit',
    itemLabel: 'Safe',
    itemsNeeded: 1, // the vault
    coins: 3,
    par: 210,
    // Cold office blue: fluorescent carpet tiles, steel partitions.
    palette: { floorA: '#1f2836', floorB: '#1a2230', wall: '#39465a', wallTop: '#4c5d76', shadow: '#0e1624' },
    // Decor: blue rugs, framed prints on the cubicle walls, potted plants,
    // desks with monitors, and the two solid crates above.
    decor: [
      { type: 'rug', c: 13, r: 2 }, { type: 'rug', c: 14, r: 2 }, { type: 'rug', c: 15, r: 2 },
      { type: 'rug', c: 16, r: 16 }, { type: 'rug', c: 17, r: 16 },
      { type: 'painting', c: 7, r: 4 }, { type: 'painting', c: 24, r: 8 },
      { type: 'plant', c: 3, r: 5 }, { type: 'plant', c: 28, r: 6 }, { type: 'plant', c: 12, r: 14 },
      { type: 'desk', c: 18, r: 6 }, { type: 'desk', c: 26, r: 6 },
      { type: 'crate', c: 15, r: 13, solid: true }, { type: 'crate', c: 27, r: 13, solid: true },
    ],
    grid,
    guards: [
      { path: [[5, 3], [12, 3], [12, 6], [5, 6]], pause: 1.0 },
      { path: [[20, 2], [28, 2], [28, 3], [20, 3]], pause: 1.0 },
      { path: [[4, 11], [8, 11], [8, 15], [4, 15]], pause: 1.2 },
      { path: [[23, 11], [28, 11], [28, 15], [23, 15]], pause: 1.2 },
      { path: [[13, 10], [17, 10], [17, 18], [13, 18]], pause: 0.8 },
      // The watcher: a stationary guard who only turns his head.
      { path: [[16, 9]], pause: 0, stationary: true },
    ],
    cameras: [
      { c: 10, r: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.5 },
      { c: 22, r: 18, base: -Math.PI / 2, sweep: 1.0, speed: 0.5 },
    ],
    dog: null,
    vault: { c: 28, r: 2 },
  };
}

// ---------------------------------------------------------------- level 3
function buildVault() {
  const grid = blankGrid();
  // The vault core: a central strong room with two guarded doors and
  // overlapping patrols in the corridors around it.
  wallRect(grid, 13, 7, 6, 1); // strong-room top wall, doors at cols 14 and 17
  grid[7][14] = '.'; grid[7][17] = '.';
  wallRect(grid, 13, 12, 6, 1); // strong-room bottom wall, door at col 15
  grid[12][15] = '.';
  wallRect(grid, 13, 8, 1, 4); // strong-room left wall
  wallRect(grid, 18, 8, 1, 4); // strong-room right wall
  wallRect(grid, 5, 5, 4, 1);
  wallRect(grid, 23, 5, 4, 1);
  wallRect(grid, 5, 14, 4, 1);
  wallRect(grid, 23, 14, 4, 1);
  wallRect(grid, 10, 2, 1, 3); // top corridor divider
  wallRect(grid, 21, 2, 1, 3);
  wallRect(grid, 10, 15, 1, 3); // bottom corridor divider
  grid[17][10] = '.';
  wallRect(grid, 21, 15, 1, 3);
  grid[17][21] = '.';

  // Shadows are scarce here — the vault is meant to feel exposed.
  shadowRect(grid, 2, 8, 2, 3);
  shadowRect(grid, 28, 8, 2, 3);
  shadowRect(grid, 15, 4, 2, 2);

  // Tall grass: one patch on the fifth guard's route, one on the dog's.
  grassRect(grid, 12, 13, 2, 2);
  grassRect(grid, 19, 6, 2, 2);

  // Two solid crates in the wide corridors, never on a patrol line.
  set(grid, 12, 2, '#');
  set(grid, 19, 18, '#');

  set(grid, 6, 6, 'B');
  set(grid, 25, 6, 'B');
  set(grid, 6, 16, 'B');
  set(grid, 25, 16, 'B');
  set(grid, 2, 17, 'C');
  set(grid, 29, 2, 'C');
  set(grid, 4, 10, 'L');
  set(grid, 27, 10, 'L');
  set(grid, 16, 10, 'L'); // the strong room glows — and is watched

  set(grid, 3, 3, '1'); // document: blueprints
  set(grid, 28, 3, '2'); // document: ledger
  set(grid, 16, 10, '3'); // document: master codes, inside the strong room
  set(grid, 2, 2, 'P');
  set(grid, 29, 17, 'E');

  return {
    name: 'The Vault Core',
    sub: 'Level 3 — Overlapping patrols',
    briefing: 'Three documents, one strong room, and patrols that overlap on purpose. The guard dog hears running from far away — sneak near it. Coins are your best friend in the corridors.',
    objective: 'Steal 3 documents, then reach the exit',
    itemLabel: 'Documents',
    itemKind: 'document',
    itemsNeeded: 3,
    coins: 4,
    par: 260,
    // Steel and rust red: the vault core is the most exposed, hardest place.
    palette: { floorA: '#2c2126', floorB: '#261c21', wall: '#4d3d45', wallTop: '#634f59', shadow: '#170f13' },
    // Decor: dark red runners, hazard signs on the strong-room walls,
    // steel barrels in the corners, and the two solid crates above.
    decor: [
      { type: 'carpet', c: 16, r: 4 }, { type: 'carpet', c: 17, r: 4 },
      { type: 'carpet', c: 15, r: 18 }, { type: 'carpet', c: 16, r: 18 },
      { type: 'sign', c: 15, r: 7 }, { type: 'sign', c: 16, r: 7 },
      { type: 'barrel', c: 3, r: 6 }, { type: 'barrel', c: 28, r: 6 },
      { type: 'barrel', c: 3, r: 16 }, { type: 'barrel', c: 28, r: 16 },
      { type: 'crate', c: 12, r: 2, solid: true }, { type: 'crate', c: 19, r: 18, solid: true },
    ],
    grid,
    guards: [
      { path: [[4, 3], [9, 3], [9, 4], [4, 4]], pause: 0.9 },
      { path: [[22, 3], [27, 3], [27, 4], [22, 4]], pause: 0.9 },
      { path: [[3, 9], [11, 9], [11, 11], [3, 11]], pause: 0.9 },
      { path: [[20, 9], [28, 9], [28, 11], [20, 11]], pause: 0.9 },
      { path: [[4, 13], [12, 13], [12, 17], [4, 17]], pause: 0.9 },
      { path: [[19, 13], [27, 13], [27, 17], [19, 17]], pause: 0.9 },
    ],
    cameras: [
      { c: 8, r: 1, base: Math.PI / 2, sweep: 0.9, speed: 0.55 },
      { c: 24, r: 1, base: Math.PI / 2, sweep: 0.9, speed: 0.55 },
      { c: 16, r: 9, base: Math.PI / 2, sweep: 1.2, speed: 0.4 },
    ],
    dog: { path: [[12, 6], [19, 6], [19, 13], [12, 13]], pause: 0.6 },
    vault: null,
  };
}

// ---------------------------------------------------------------- level 4
function buildGarden() {
  const grid = blankGrid();
  // Rooftop garden: hedge partitions with door gaps, a central fountain
  // plaza, and grass everywhere — the garden is the grass mechanic's home.
  wallRect(grid, 10, 5, 12, 1); // top hedge, gaps at cols 14-15
  grid[5][14] = '.'; grid[5][15] = '.';
  wallRect(grid, 5, 10, 6, 1); // lower-left hedge, gap at col 8
  grid[10][8] = '.';
  wallRect(grid, 21, 10, 6, 1); // lower-right hedge, gap at col 24
  grid[10][24] = '.';
  wallRect(grid, 15, 14, 1, 4); // fountain hedge, gap at row 16
  grid[16][15] = '.';

  // Shadow: the dim corners under the trellises.
  shadowRect(grid, 2, 6, 2, 4);
  shadowRect(grid, 28, 6, 2, 4);
  shadowRect(grid, 14, 16, 4, 2);

  // Tall grass: four patches — the garden hides you if you use them.
  grassRect(grid, 6, 6, 3, 2);
  grassRect(grid, 24, 6, 3, 2);
  grassRect(grid, 12, 12, 3, 2);
  grassRect(grid, 20, 15, 2, 2);

  // Two solid crates (planters' boxes), off every patrol segment.
  set(grid, 12, 2, '#');
  set(grid, 26, 15, '#');

  set(grid, 8, 3, 'B');
  set(grid, 23, 3, 'B');
  set(grid, 12, 16, 'B');
  set(grid, 19, 16, 'B');
  set(grid, 29, 3, 'C'); // garden shed
  set(grid, 2, 15, 'C');
  set(grid, 6, 11, 'L'); // garden lanterns
  set(grid, 24, 11, 'L');
  set(grid, 15, 2, 'L');

  set(grid, 26, 2, '1'); // relic: jade crane, top-right bed
  set(grid, 5, 17, '2'); // relic: golden koi, bottom-left bed
  set(grid, 2, 2, 'P');
  set(grid, 29, 17, 'E');

  return {
    name: 'The Rooftop Garden',
    sub: 'Level 4 — Moonlit garden',
    briefing: 'A garden at night, and grass everywhere. The tall grass is your best cover here — guards cannot see inside it, so cross the open lawns from patch to patch. The garden dog hears running from far away.',
    objective: 'Steal 2 relics, then reach the exit',
    itemLabel: 'Relics',
    itemKind: 'artifact',
    itemsNeeded: 2,
    coins: 3,
    par: 240,
    // Moonlit green: mossy hedges, dark lawn, pale stone paths.
    palette: { floorA: '#1e2b22', floorB: '#18231b', wall: '#46523f', wallTop: '#5a6b52', shadow: '#0d1a10' },
    // Decor: potted plants, a fountain statue at the plaza, planter
    // barrels in the corners, and the two solid crates above.
    decor: [
      { type: 'plant', c: 5, r: 3 }, { type: 'plant', c: 21, r: 8 },
      { type: 'plant', c: 27, r: 14 }, { type: 'plant', c: 10, r: 16 },
      { type: 'statue', c: 15, r: 10 },
      { type: 'barrel', c: 3, r: 18 }, { type: 'barrel', c: 28, r: 18 },
      { type: 'crate', c: 12, r: 2, solid: true }, { type: 'crate', c: 26, r: 15, solid: true },
    ],
    grid,
    guards: [
      { path: [[4, 2], [9, 2], [9, 4], [4, 4]], pause: 1.0 },
      { path: [[22, 2], [28, 2], [28, 4], [22, 4]], pause: 1.0 },
      { path: [[4, 12], [9, 12], [9, 17], [4, 17]], pause: 1.2 },
      { path: [[20, 12], [28, 12], [28, 17], [20, 17]], pause: 1.2 },
    ],
    cameras: [
      { c: 16, r: 1, base: Math.PI / 2, sweep: 0.9, speed: 0.5 },
      { c: 16, r: 18, base: -Math.PI / 2, sweep: 0.9, speed: 0.5 },
    ],
    dog: { path: [[13, 8], [18, 8], [18, 11], [13, 11]], pause: 0.6 },
    vault: null,
  };
}

// ---------------------------------------------------------------- level 5
function buildKeep() {
  const grid = blankGrid();
  // The Duke's keep: a grand throne room with two guarded doors, corner
  // bastions, and patrols that overlap on purpose — the hardest level.
  wallRect(grid, 11, 6, 10, 1); // keep top wall, doors at cols 14 and 17
  grid[6][14] = '.'; grid[6][17] = '.';
  wallRect(grid, 11, 13, 10, 1); // keep bottom wall, door at col 15
  grid[13][15] = '.';
  wallRect(grid, 11, 7, 1, 6); // keep left wall
  wallRect(grid, 20, 7, 1, 6); // keep right wall
  wallRect(grid, 4, 4, 4, 1); // corner bastions
  wallRect(grid, 24, 4, 4, 1);
  wallRect(grid, 4, 15, 4, 1);
  wallRect(grid, 24, 15, 4, 1);
  wallRect(grid, 8, 15, 1, 2); // bottom dividers (kept off row 17, the patrol line)
  wallRect(grid, 23, 15, 1, 2);

  // Shadows are scarce — the keep is meant to feel exposed.
  shadowRect(grid, 2, 8, 2, 3);
  shadowRect(grid, 28, 8, 2, 3);
  shadowRect(grid, 15, 15, 2, 2);

  // Tall grass: one patch on the fifth guard's route, one on the sixth's.
  grassRect(grid, 10, 15, 2, 2);
  grassRect(grid, 21, 15, 2, 2);

  // Two solid crates in the wide halls, never on a patrol segment.
  set(grid, 13, 2, '#');
  set(grid, 18, 17, '#');

  set(grid, 6, 6, 'B');
  set(grid, 25, 6, 'B');
  set(grid, 6, 16, 'B');
  set(grid, 25, 16, 'B');
  set(grid, 2, 17, 'C');
  set(grid, 29, 2, 'C');
  set(grid, 4, 10, 'L');
  set(grid, 27, 10, 'L');
  set(grid, 16, 10, 'L'); // the throne room glows — and is watched

  set(grid, 3, 3, '1'); // jewel: crown, top-left bastion
  set(grid, 28, 3, '2'); // jewel: sceptre, top-right bastion
  set(grid, 15, 9, '3'); // jewel: orb, inside the throne room
  set(grid, 2, 2, 'P');
  set(grid, 29, 17, 'E');

  return {
    name: "The Duke's Keep",
    sub: 'Level 5 — The grand finale',
    briefing: 'Three crown jewels, a throne room watched by its own camera, seven guards, four cameras and a dog that hears everything. Use the grass, the shadows and your sonar — this is the hardest infiltration of the night.',
    objective: 'Steal 3 crown jewels, then reach the exit',
    itemLabel: 'Jewels',
    itemKind: 'artifact',
    itemsNeeded: 3,
    coins: 4,
    par: 300,
    // Royal purple and gold: the keep is the grandest, hardest place.
    palette: { floorA: '#2a2233', floorB: '#241d2d', wall: '#4a3f5e', wallTop: '#5f5178', shadow: '#120e1a' },
    // Decor: purple carpet runners, portraits on the keep walls, potted
    // plants, a statue before the keep doors, barrels, and the crates above.
    decor: [
      { type: 'carpet', c: 14, r: 2 }, { type: 'carpet', c: 15, r: 2 }, { type: 'carpet', c: 16, r: 2 },
      { type: 'carpet', c: 15, r: 18 }, { type: 'carpet', c: 16, r: 18 },
      { type: 'painting', c: 13, r: 6 }, { type: 'painting', c: 18, r: 6 },
      { type: 'plant', c: 3, r: 6 }, { type: 'plant', c: 28, r: 6 }, { type: 'plant', c: 15, r: 16 },
      { type: 'statue', c: 15, r: 4 },
      { type: 'barrel', c: 3, r: 18 }, { type: 'barrel', c: 28, r: 18 },
      { type: 'crate', c: 13, r: 2, solid: true }, { type: 'crate', c: 18, r: 17, solid: true },
    ],
    grid,
    guards: [
      { path: [[3, 2], [10, 2], [10, 3], [3, 3]], pause: 0.9 },
      { path: [[21, 2], [28, 2], [28, 3], [21, 3]], pause: 0.9 },
      { path: [[3, 7], [9, 7], [9, 11], [3, 11]], pause: 0.9 },
      { path: [[22, 7], [28, 7], [28, 11], [22, 11]], pause: 0.9 },
      { path: [[3, 14], [9, 14], [9, 17], [3, 17]], pause: 0.9 },
      { path: [[22, 14], [28, 14], [28, 17], [22, 17]], pause: 0.9 },
      // The seventh guard walks the top corridor, watching the keep's
      // doors from outside — no guard stands inside the throne room, so a
      // patient thief can slip in past its camera.
      { path: [[12, 3], [19, 3], [19, 4], [12, 4]], pause: 0.9 },
    ],
    cameras: [
      { c: 8, r: 1, base: Math.PI / 2, sweep: 0.9, speed: 0.55 },
      { c: 24, r: 1, base: Math.PI / 2, sweep: 0.9, speed: 0.55 },
      { c: 16, r: 4, base: Math.PI / 2, sweep: 1.2, speed: 0.4 },
      { c: 16, r: 9, base: Math.PI / 2, sweep: 1.2, speed: 0.4 }, // watches the throne room
    ],
    dog: { path: [[10, 5], [21, 5], [21, 14], [10, 14]], pause: 0.6 },
    vault: null,
  };
}

// Parse a built level into the runtime shape the engine uses.
export function parseLevel(def) {
  const items = [];
  let playerStart = null;
  let exit = null;
  const walls = new Set();
  const shadows = new Set();
  const bushes = new Set();
  const grass = new Set();
  const closets = new Set();
  const lamps = [];
  const crates = new Set();
  for (const d of def.decor || []) {
    if (d.solid) crates.add(`${d.c},${d.r}`);
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = def.grid[r][c];
      const key = `${c},${r}`;
      if (ch === '#') walls.add(key);
      else if (ch === 'S') shadows.add(key);
      else if (ch === 'B') bushes.add(key);
      else if (ch === 'G') grass.add(key);
      else if (ch === 'C') closets.add(key);
      else if (ch === 'L') lamps.push(tileCenter(c, r));
      else if (ch === 'P') playerStart = tileCenter(c, r);
      else if (ch === 'E') exit = { ...tileCenter(c, r), c, r };
      else if (ch === '1' || ch === '2' || ch === '3') {
        items.push({ ...tileCenter(c, r), c, r, id: ch, kind: def.itemKind || 'artifact', taken: false });
      } else if (ch === 'K') {
        items.push({ ...tileCenter(c, r), c, r, id: 'K', kind: 'keycard', taken: false });
      } else if (ch === 'V') {
        items.push({ ...tileCenter(c, r), c, r, id: 'V', kind: 'vault', taken: false });
      }
    }
  }

  return {
    ...def,
    walls,
    shadows,
    bushes,
    grass,
    crates,
    closets,
    lamps,
    items,
    playerStart,
    exit,
    vaultOpen: false,
    hasKeycard: false,
  };
}

export const LEVELS = [buildMuseum(), buildOffice(), buildVault(), buildGarden(), buildKeep()];

// Helpers the engine and the validator share.
export function tileAt(level, x, y) {
  const c = Math.floor(x / CONFIG.TILE);
  const r = Math.floor(y / CONFIG.TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
  return level.grid[r][c];
}

export function isWallTile(level, c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return level.grid[r][c] === '#';
}

// Straight-line line of sight between two points (walls block it).
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (tileAt(level, x0 + dx * t, y0 + dy * t) === '#') return false;
  }
  return true;
}
