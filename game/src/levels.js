// SHADOW PROTOCOL — level definitions and grid helpers.
// Legend: # wall, . floor, S shadow, B bush, G tall grass, C closet,
// L lamp, K crate (solid), P player start, E exit, A artifact/item.
// Every grid is 32 columns x 20 rows; parseLevel turns it into a playable
// level. Guards, cameras and the dog are defined by tile waypoints.
import { TILE, COLS, ROWS, PALETTES } from './config.js';

export const LEVELS = [
  {
    name: 'Museum After Dark',
    sub: 'Level 1 · 3 guards · 1 camera',
    palette: 'museum',
    itemKind: 'relic',
    itemLabel: 'Relic',
    briefing: 'Slip through the galleries, take the relic and leave by the west door — unseen.',
    grid: [
      '################################',
      '#......#........#..............#',
      '#..E...#...A....#......L.......#',
      '#......#........#..............#',
      '#..............................#',
      '#......#........#..............#',
      '###.####..#######.......###.####',
      '#.......#.......#.....#........#',
      '#..S....#...L...#..B..#....C...#',
      '#.......#.......#.....#........#',
      '#.####.#####.######.#####.####.#',
      '#........#......#.....#........#',
      '#...L....#..S...#..G..#........#',
      '#........#......#.....#........#',
      '####.#######.########.####.#####',
      '#......#..........#............#',
      '#..B...#....L....#.....C.......#',
      '#..P...#..........#............#',
      '#......#..........#............#',
      '################################',
    ],
    guards: [
      { path: [[10, 4], [21, 4], [21, 5], [10, 5]] },
      { path: [[24, 8], [24, 12], [28, 12], [28, 8]] },
      { path: [[3, 11], [3, 13], [6, 13], [6, 11]] },
    ],
    cameras: [{ c: 16, r: 1, angle: Math.PI / 2, sweep: 0.8 }],
    dog: null,
  },
  {
    name: 'The Office Tower',
    sub: 'Level 2 · 4 guards · 2 cameras',
    palette: 'office',
    itemKind: 'files',
    itemLabel: 'Files',
    briefing: 'The 12th floor never sleeps. Grab the files from the corner office and vanish.',
    grid: [
      '################################',
      '#....#......#......#....L......#',
      '#..P.#..A...#..E...#...........#',
      '#....#......#......#....S......#',
      '#..............................#',
      '#.###.####.#####.####.###.###.##',
      '#.#...#....#.....#....#...#....#',
      '#.#.L.#.S..#.B...#....#.G.#..C.#',
      '#.#...#....#.....#....#...#....#',
      '#...#...#.....#.....#...#....#.#',
      '###.#####.#######.#####.###.###.',
      '#......#.......#......#........#',
      '#..B...#...L...#..S...#....G...#',
      '#......#.......#......#........#',
      '#.####.#######.####.#####.###.##',
      '#....#.....#......#....#.......#',
      '#....#..C..#..L...#....#...S...#',
      '#....#.....#......#....#.......#',
      '#....#.....#......#....#.......#',
      '################################',
    ],
    guards: [
      { path: [[2, 4], [14, 4], [14, 3], [2, 3]] },
      { path: [[18, 4], [29, 4], [29, 2], [18, 2]] },
      { path: [[2, 12], [6, 12], [6, 11], [2, 11]] },
      { path: [[24, 12], [24, 16], [28, 16], [28, 12]] },
    ],
    cameras: [
      { c: 12, r: 14, angle: -Math.PI / 2, sweep: 0.7 },
      { c: 22, r: 14, angle: -Math.PI / 2, sweep: 0.7 },
    ],
    dog: null,
  },
  {
    name: 'The Vault Core',
    sub: 'Level 3 · 4 guards · 3 cameras · dog',
    palette: 'vault',
    itemKind: 'ingot',
    itemLabel: 'Gold Ingot',
    briefing: 'Two gold ingots sit behind the vault rings. The dog hears everything.',
    grid: [
      '################################',
      '#.....#..........#.............#',
      '#..P..#....A.....#......L......#',
      '#.....#..........#.............#',
      '#..............................#',
      '####.########.##########.#######',
      '#.....#.......#........#.G.G.G.#',
      '#..S..#...L...#...B....#.G.A.G.#',
      '#.....#.......#........#.......#',
      '#.#####.#######.########.#####.#',
      '#.....#........#......#........#',
      '#..L..#...S....#..G...#....C...#',
      '#.....#........#......#........#',
      '####.####.##########.####.######',
      '#........#........#............#',
      '#...B....#...L....#.....S......#',
      '#........#........#............#',
      '#....E...#........#............#',
      '#........#........#............#',
      '################################',
    ],
    guards: [
      { path: [[8, 4], [16, 4], [16, 3], [8, 3]] },
      { path: [[18, 4], [29, 4], [29, 2], [18, 2]] },
      { path: [[8, 10], [14, 10], [14, 12], [8, 12]] },
      { path: [[17, 10], [21, 10], [21, 12], [17, 12]] },
    ],
    cameras: [
      { c: 17, r: 1, angle: Math.PI / 2, sweep: 0.8 },
      { c: 20, r: 9, angle: Math.PI / 2, sweep: 0.7 },
      { c: 18, r: 14, angle: -Math.PI / 2, sweep: 0.7 },
    ],
    dog: { path: [[20, 16], [29, 16]] },
  },
  {
    name: 'The Rooftop Garden',
    sub: 'Level 4 · 4 guards · 2 cameras · dog',
    palette: 'garden',
    itemKind: 'orchid',
    itemLabel: 'Moon Orchid',
    briefing: 'Moonlight, hedges and tall grass. The grass hides you — unless a guard is close.',
    grid: [
      '################################',
      '#..G...G....G.....G....G.......#',
      '#..P...G....A.....G....E.......#',
      '#..G...G....G.....G....G.......#',
      '#...G....G......G...G....G.....#',
      '#......G....G......G....G......#',
      '##.#####.######.#######.####.###',
      '#..G...G...G....G....G....G....#',
      '#..G...G...G....G....G....G....#',
      '#..G...G...G....G....G....G....#',
      '#..G..B....G....G....G...B.....#',
      '#..G...G...G....G....G....G....#',
      '#..G...G...G....G....G....G....#',
      '##.#####.######.#######.####.###',
      '#..G...G...G.....G....G...G....#',
      '#..G...G...G..L..G....G...G....#',
      '#..G...G...G.....G....G...G....#',
      '#..G...G...G.....G....G...G....#',
      '#..G...G...G.....G....G...G....#',
      '################################',
    ],
    guards: [
      { path: [[2, 4], [14, 4], [14, 5], [2, 5]] },
      { path: [[18, 4], [29, 4], [29, 5], [18, 5]] },
      { path: [[2, 14], [14, 14], [14, 16], [2, 16]] },
      { path: [[18, 14], [29, 14], [29, 16], [18, 16]] },
    ],
    cameras: [
      { c: 15, r: 0, angle: Math.PI / 2, sweep: 0.9 },
      { c: 15, r: 19, angle: -Math.PI / 2, sweep: 0.9 },
    ],
    dog: { path: [[10, 8], [21, 8], [21, 11], [10, 11]] },
  },
  {
    name: "The Duke's Keep",
    sub: 'Level 5 · 7 guards · 4 cameras · dog',
    palette: 'keep',
    itemKind: 'jewel',
    itemLabel: 'Crown Jewel',
    briefing: 'Three crown jewels in the throne wing. Seven guards, four cameras, one very good dog.',
    grid: [
      '################################',
      '#......#.......#......#........#',
      '#..A...#...A...#..A...#...E....#',
      '#......#.......#......#........#',
      '#..............................#',
      '####.#####.########.#####.######',
      '#.....#......#.......#.........#',
      '#..S..#..L...#...B...#....C....#',
      '#.....#......#.......#.........#',
      '#.####.######.#######.####.###.#',
      '#......#......#......#.........#',
      '#..L...#..S...#..G...#....S....#',
      '#......#......#......#.........#',
      '####.#####.########.#####.######',
      '#.......#........#.............#',
      '#...B...#...L....#......S......#',
      '#.......#........#.............#',
      '#...P...#........#.............#',
      '#.......#........#.............#',
      '################################',
    ],
    guards: [
      { path: [[2, 4], [6, 4], [6, 3], [2, 3]] },
      { path: [[23, 4], [29, 4], [29, 2], [23, 2]] },
      { path: [[2, 10], [6, 10], [6, 12], [2, 12]] },
      { path: [[9, 10], [13, 10], [13, 12], [9, 12]] },
      { path: [[22, 10], [25, 10], [25, 12], [22, 12]] },
      { path: [[2, 16], [7, 16], [7, 14], [2, 14]] },
      { path: [[9, 3], [14, 3], [14, 4], [9, 4]] },
    ],
    cameras: [
      { c: 7, r: 1, angle: Math.PI / 2, sweep: 0.8 },
      { c: 15, r: 1, angle: Math.PI / 2, sweep: 0.8 },
      { c: 22, r: 1, angle: Math.PI / 2, sweep: 0.8 },
      { c: 15, r: 9, angle: -Math.PI / 2, sweep: 0.7 },
    ],
    dog: { path: [[9, 10], [12, 10], [12, 12], [9, 12]] },
  },
];

// ---- Grid helpers -------------------------------------------------------

export function parseLevel(def) {
  const grid = def.grid.map((row) => row.split(''));
  const level = {
    name: def.name,
    sub: def.sub,
    palette: PALETTES[def.palette],
    paletteKey: def.palette,
    itemKind: def.itemKind,
    itemLabel: def.itemLabel,
    briefing: def.briefing,
    grid,
    playerStart: { x: 0, y: 0, c: 0, r: 0 },
    exit: { c: 0, r: 0, x: 0, y: 0 },
    items: [],
    lamps: [],
    guards: def.guards.map((g) => ({ path: g.path.map(([c, r]) => [c, r]) })),
    cameras: def.cameras.map((c) => ({ ...c })),
    dog: def.dog ? { path: def.dog.path.map(([c, r]) => [c, r]) } : null,
  };
  let itemId = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;
      if (t === 'P') level.playerStart = { x: cx, y: cy, c, r };
      else if (t === 'E') level.exit = { c, r, x: cx, y: cy };
      else if (t === 'A') level.items.push({ id: itemId++, kind: def.itemKind, c, r, x: cx, y: cy, taken: false });
      else if (t === 'L') level.lamps.push({ c, r, x: cx, y: cy });
    }
  }
  return level;
}

export function tileAt(level, c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
  return level.grid[r][c];
}

export function isWallTile(level, c, r) {
  const t = tileAt(level, c, r);
  return t === '#' || t === 'K';
}

export function isWalkable(level, c, r) {
  return !isWallTile(level, c, r);
}

export function tileAtPx(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function isHidingTile(level, x, y) {
  const t = tileAtPx(level, x, y);
  return t === 'S' || t === 'B' || t === 'G' || t === 'C';
}

export function isClosetTile(level, x, y) {
  return tileAtPx(level, x, y) === 'C';
}

// Nearest walkable tile to (c, r) by BFS (used to nudge thrown coins out of walls).
export function nearestWalkable(level, c, r) {
  if (isWalkable(level, c, r)) return [c, r];
  const seen = new Set([`${c},${r}`]);
  const queue = [[c, r]];
  while (queue.length) {
    const [cc, rr] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cc + dc;
      const nr = rr + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isWalkable(level, nc, nr)) return [nc, nr];
      queue.push([nc, nr]);
    }
  }
  return [c, r];
}

// Line of sight between two pixel points: blocked when a sampled point
// lands on a solid tile.
export function losBlocked(level, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (isWallTile(level, Math.floor(x / TILE), Math.floor(y / TILE))) return true;
  }
  return false;
}
