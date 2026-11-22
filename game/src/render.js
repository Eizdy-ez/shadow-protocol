// SHADOW PROTOCOL — everything drawn: the world, the guards, the player,
// the light and the vision cones. Cones are raycast against the walls so
// they stop at corners instead of shining through them, and the darkness
// overlay leaves light pools around lamps, the player and the objectives —
// the lighting itself tells the player where it is safe to stand.

import { CONFIG } from './config.js';
import { tileAt } from './levels.js';

const { TILE, COLS, ROWS, WIDTH, HEIGHT } = CONFIG;
const C = CONFIG.COLORS;

// Offscreen canvas for the darkness overlay (reused every frame).
let darkCanvas = null;

function hash(c, r) {
  return ((c * 73856093) ^ (r * 19349663)) >>> 0;
}

// March a ray from (x,y) along angle until a wall; return the distance.
function rayLength(level, x, y, angle, maxLen) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = 8; d <= maxLen; d += 8) {
    if (tileAt(level, x + dx * d, y + dy * d) === '#') return d;
  }
  return maxLen;
}

function drawCone(ctx, level, x, y, dir, range, angle, fill, edge) {
  const rays = 26;
  const pts = [];
  for (let i = 0; i <= rays; i++) {
    const a = dir - angle / 2 + (angle * i) / rays;
    const len = rayLength(level, x, y, a, range);
    pts.push([x + Math.cos(a) * len, y + Math.sin(a) * len]);
  }
  const grad = ctx.createRadialGradient(x, y, 10, x, y, range);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, fill.replace(/[\d.]+\)$/, '0)'));
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(pts[0][0], pts[0][1]);
  ctx.moveTo(x, y);
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.stroke();
}

function drawGuardFigure(ctx, g, time) {
  const bob = g.state === 'patrol' ? Math.sin(time * 4 + g.x) * 1.5 : 0;
  ctx.save();
  ctx.translate(g.x, g.y + bob);
  // Body
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fillStyle = g.kind === 'dog' ? C.dog : C.guardSuit;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = g.kind === 'dog' ? '#5d4632' : '#7d1f1f';
  ctx.stroke();
  // Facing tick / snout
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(g.dir) * 18, Math.sin(g.dir) * 18);
  ctx.strokeStyle = '#ffd9d9';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (g.kind === 'dog') {
    // Ears
    ctx.fillStyle = '#5d4632';
    ctx.beginPath();
    ctx.arc(-8, -9, 4, 0, Math.PI * 2);
    ctx.arc(8, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    // Tail at the back, snout at the front.
    ctx.beginPath();
    ctx.moveTo(-Math.cos(g.dir) * 12, -Math.sin(g.dir) * 12);
    ctx.lineTo(-Math.cos(g.dir) * 19, -Math.sin(g.dir) * 19);
    ctx.strokeStyle = '#5d4632';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(Math.cos(g.dir) * 15, Math.sin(g.dir) * 15, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2e2118';
    ctx.fill();
  } else {
    // Visor
    ctx.beginPath();
    ctx.arc(Math.cos(g.dir) * 5, Math.sin(g.dir) * 5, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    // Rim light (top-left), matching the player's light source.
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI * 0.9, Math.PI * 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // State markers
  if (g.state === 'alerted') {
    drawMarker(ctx, g.x, g.y - 30, '!', '#ff3b3b');
  } else if (g.state === 'suspicious') {
    drawMarker(ctx, g.x, g.y - 30, '?', '#ff9a2a');
  } else if (g.nearPlayer) {
    drawMarker(ctx, g.x, g.y - 30, '…', '#cfd6e4');
  }
}

function drawMarker(ctx, x, y, text, color) {
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawItem(ctx, item, time) {
  const bob = Math.sin(time * 2.5 + item.x * 0.05) * 3;
  const x = item.x;
  const y = item.y + bob;
  // Glow
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
  const col = item.kind === 'keycard' ? '57,197,216' : item.kind === 'vault' ? '255,207,63' : '255,207,63';
  glow.addColorStop(0, `rgba(${col},0.5)`);
  glow.addColorStop(1, `rgba(${col},0)`);
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  if (item.kind === 'keycard') {
    ctx.fillStyle = C.keycard;
    ctx.fillRect(x - 11, y - 7, 22, 14);
    ctx.fillStyle = '#0b2b31';
    ctx.fillRect(x - 8, y - 4, 8, 3);
    ctx.fillRect(x - 8, y + 1, 12, 2);
  } else if (item.kind === 'vault') {
    ctx.fillStyle = C.vault;
    ctx.fillRect(x - 16, y - 14, 32, 28);
    ctx.strokeStyle = '#5d6577';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 16, y - 14, 32, 28);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#3c4356';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = C.artifact;
    ctx.fill();
    // Handle bar under the dial.
    ctx.fillStyle = '#3c4356';
    ctx.fillRect(x - 10, y + 9, 20, 3);
  } else {
    // Artifact / document: a bright diamond (artifact) or paper (document).
    if (item.kind === 'document') {
      ctx.fillStyle = C.document;
      ctx.fillRect(x - 8, y - 10, 16, 20);
      ctx.strokeStyle = '#9a9a8a';
      ctx.lineWidth = 1;
      for (let i = -6; i <= 4; i += 5) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y + i);
        ctx.lineTo(x + 5, y + i);
        ctx.stroke();
      }
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = C.artifact;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = '#a87e00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-8, -8, 16, 16);
      // Facet lines across the gem.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
      ctx.restore();
      // Sparkle above the gem.
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 14);
      ctx.lineTo(x + 8, y - 6);
      ctx.moveTo(x + 4, y - 10);
      ctx.lineTo(x + 12, y - 10);
      ctx.stroke();
    }
  }
}

function drawPlayer(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hidden) {
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,200,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Hooded figure
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fillStyle = p.sneaking ? C.playerSneak : C.player;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4a4a44';
  ctx.stroke();
  // Hood point + eyes facing the movement direction
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.dir) * 6, Math.sin(p.dir) * 6);
  ctx.lineTo(Math.cos(p.dir) * 17, Math.sin(p.dir) * 17);
  ctx.strokeStyle = '#2b2b28';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Rim light (top-left, the level's light source) and eyes.
  ctx.beginPath();
  ctx.arc(0, 0, p.r - 2, Math.PI * 0.9, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#20201d';
  ctx.beginPath();
  ctx.arc(Math.cos(p.dir - 0.35) * 7, Math.sin(p.dir - 0.35) * 7, 1.8, 0, Math.PI * 2);
  ctx.arc(Math.cos(p.dir + 0.35) * 7, Math.sin(p.dir + 0.35) * 7, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (p.hidden && !p.inCloset) {
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(190,215,255,0.95)';
    ctx.fillText('HIDDEN', p.x, p.y + 30);
  }
}

// A tuft of tall grass: dozens of thin, upright blades with varied length,
// lean and shade, so the patch reads as a rough green block instead of a
// flat surface — the way the top entry's grass does. The back layer is
// darker and shorter; the front layer is taller and brighter and overlaps a
// player standing inside, so a hiding player still shows as a small shape
// half-covered by blades. Every blade is placed from the tile's hash, so
// the patch is identical on every run.
function drawGrassBlades(ctx, x, y, time, seed, front) {
  const sway = Math.sin(time * 1.6 + seed * 1.7) * 1.2;
  const count = front ? 9 : 12;
  const shades = front
    ? [C.grassBladeDark, C.grassBlade, C.grassBladeLight]
    : [C.grassDark, C.grassBladeDark, C.grassBlade];
  for (let i = 0; i < count; i++) {
    const h = hash(seed, i * 31 + (front ? 7 : 3));
    const bx = 3 + (h % 34);
    const len = front ? 16 + (h % 14) : 10 + (h % 10);
    const lean = ((h >> 4) % 9) - 4 + sway;
    const tipX = bx + lean;
    const tipY = 38 - len;
    ctx.fillStyle = shades[h % shades.length];
    ctx.beginPath();
    ctx.moveTo(x + bx - 1, y + 38);
    ctx.lineTo(x + tipX, y + tipY);
    ctx.lineTo(x + bx + 1, y + 38);
    ctx.closePath();
    ctx.fill();
  }
}

// One decorative object, drawn at its tile's top-left corner.
function drawDecor(ctx, type, x, y) {
  const T = TILE;
  if (type === 'carpet') {
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(x + 2, y + 6, T - 4, T - 12);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 9, T - 10, T - 18);
  } else if (type === 'rug') {
    ctx.fillStyle = '#24406b';
    ctx.fillRect(x + 3, y + 7, T - 6, T - 14);
    ctx.strokeStyle = '#5b7fb8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 10, T - 12, T - 20);
  } else if (type === 'plant') {
    ctx.fillStyle = '#8a5a34';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 24);
    ctx.lineTo(x + 28, y + 24);
    ctx.lineTo(x + 25, y + 36);
    ctx.lineTo(x + 15, y + 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.bushLeaf;
    ctx.beginPath();
    ctx.arc(x + 14, y + 18, 7, 0, Math.PI * 2);
    ctx.arc(x + 26, y + 16, 7, 0, Math.PI * 2);
    ctx.arc(x + 20, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'statue') {
    ctx.fillStyle = '#6b6f7d';
    ctx.fillRect(x + 12, y + 24, 16, 12);
    ctx.fillStyle = '#c8ccd8';
    ctx.beginPath();
    ctx.arc(x + 20, y + 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 16, y + 20, 8, 6);
  } else if (type === 'desk') {
    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(x + 4, y + 18, T - 8, 12);
    ctx.fillStyle = '#2b2f38';
    ctx.fillRect(x + 10, y + 6, 16, 11);
    ctx.fillStyle = '#7fd4ff';
    ctx.fillRect(x + 12, y + 8, 12, 7);
  } else if (type === 'barrel') {
    ctx.fillStyle = '#5d6b7a';
    ctx.beginPath();
    ctx.ellipse(x + 20, y + 20, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#39424e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 20, y + 20, 11, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 14);
    ctx.lineTo(x + 31, y + 14);
    ctx.moveTo(x + 9, y + 26);
    ctx.lineTo(x + 31, y + 26);
    ctx.stroke();
  } else if (type === 'painting') {
    ctx.fillStyle = '#8a6b2f';
    ctx.fillRect(x + 6, y + 8, T - 12, T - 16);
    ctx.fillStyle = '#3f6b8a';
    ctx.fillRect(x + 9, y + 11, T - 18, T - 22);
    ctx.fillStyle = '#7a9a4a';
    ctx.fillRect(x + 9, y + T - 16, T - 18, 5);
  } else if (type === 'sign') {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x + 10, y + 10, T - 20, T - 20);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x + T / 2, y + T / 2 + 1);
  } else if (type === 'crate') {
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
    ctx.strokeStyle = '#4a3517';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + T - 3, y + T - 3);
    ctx.moveTo(x + T - 3, y + 3);
    ctx.lineTo(x + 3, y + T - 3);
    ctx.stroke();
  }
}

export function drawWorld(ctx, G) {
  const { level, time } = G;
  const T = TILE;
  // Each level has its own palette, so the five levels read as five
  // different places at a glance, not one map recoloured.
  const P = { ...C, ...(level.palette || {}) };
  // Decor by tile, for the floor and wall passes below.
  const decorMap = new Map((level.decor || []).map((d) => [`${d.c},${d.r}`, d.type]));

  // --- patrol routes: faint dotted lines through each guard's waypoints,
  // so the patrols are visibly learnable (criterion #2), and a dashed arc
  // showing how far each camera sweeps.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 9]);
  for (const g of G.guards) {
    if (g.stationary || g.waypoints.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(g.waypoints[0].x, g.waypoints[0].y);
    for (let i = 1; i < g.waypoints.length; i++) {
      ctx.lineTo(g.waypoints[i].x, g.waypoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (const wp of g.waypoints) {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const cam of G.cameras) {
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 46, cam.base - cam.sweep, cam.base + cam.sweep);
    ctx.strokeStyle = 'rgba(120,200,255,0.16)';
    ctx.stroke();
  }
  ctx.restore();

  // --- floor
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = level.grid[r][c];
      const x = c * T;
      const y = r * T;
      const h = hash(c, r) % 3;
      if (ch === '#') continue; // walls drawn later, on top
      ctx.fillStyle = ch === 'S' ? P.shadow : (c + r) % 2 === 0 ? P.floorA : P.floorB;
      ctx.fillRect(x, y, T, T);
      // Fine grain: two deterministic speckles per tile, so the floor reads
      // as stone/carpet instead of flat colour at 2x.
      const sp1 = hash(c * 3 + 1, r * 5 + 2) % 36;
      const sp2 = hash(c * 7 + 3, r * 2 + 5) % 36;
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(x + 2 + sp1, y + 2 + ((sp1 * 7) % 34), 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      ctx.fillRect(x + 2 + sp2, y + 2 + ((sp2 * 11) % 34), 2, 2);
      if (h === 0 && ch !== 'S') {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
      }
      if (ch === 'S') {
        ctx.fillStyle = 'rgba(120,160,255,0.10)';
        ctx.fillRect(x, y, T, T);
      }
      if (ch === 'L') {
        const glow = ctx.createRadialGradient(x + T / 2, y + T / 2, 4, x + T / 2, y + T / 2, 85);
        glow.addColorStop(0, 'rgba(255,217,138,0.20)');
        glow.addColorStop(1, 'rgba(255,217,138,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 30, y - 30, T + 60, T + 60);
        // Lamp fixture: a slim post with a glowing bulb.
        ctx.fillStyle = '#3a3f4a';
        ctx.fillRect(x + T / 2 - 1, y + T / 2 - 2, 2, 12);
        ctx.beginPath();
        ctx.arc(x + T / 2, y + T / 2 - 4, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.lampGlow;
        ctx.fill();
      }
      if (ch === 'G') {
        // Tall grass: a dark green bed with swaying blades. Standing in it
        // hides the player from every vision cone.
        ctx.fillStyle = C.grass;
        ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        drawGrassBlades(ctx, x, y, time, hash(c, r), false);
      }
      // Floor decor for this tile (carpets, rugs, plants, statues, desks,
      // barrels) — purely visual, never blocking.
      const decorType = decorMap.get(`${c},${r}`);
      if (decorType && decorType !== 'painting' && decorType !== 'sign' && decorType !== 'crate') {
        drawDecor(ctx, decorType, x, y);
      }
      if (ch === 'B') {
        // Bush: cluster of leaves
        ctx.fillStyle = C.bush;
        ctx.beginPath();
        ctx.arc(x + 12, y + 22, 11, 0, Math.PI * 2);
        ctx.arc(x + 26, y + 16, 12, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 28, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.bushLeaf;
        ctx.beginPath();
        ctx.arc(x + 12, y + 20, 6, 0, Math.PI * 2);
        ctx.arc(x + 26, y + 14, 6, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 26, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ch === 'C') {
        ctx.fillStyle = C.closet;
        ctx.fillRect(x + 5, y + 4, T - 10, T - 8);
        ctx.strokeStyle = '#2e2115';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 5, y + 4, T - 10, T - 8);
        ctx.beginPath();
        ctx.moveTo(x + T / 2, y + 4);
        ctx.lineTo(x + T / 2, y + T - 4);
        ctx.stroke();
      }
    }
  }

  // --- exit door
  const ex = level.exit;
  const objectivesDone = objectivesComplete(G);
  ctx.save();
  ctx.translate(ex.x, ex.y);
  const exitGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
  exitGlow.addColorStop(0, objectivesDone ? 'rgba(57,217,138,0.55)' : 'rgba(120,130,120,0.25)');
  exitGlow.addColorStop(1, 'rgba(57,217,138,0)');
  ctx.fillStyle = exitGlow;
  ctx.fillRect(-60, -60, 120, 120);
  ctx.fillStyle = objectivesDone ? C.exit : '#5a6b5a';
  ctx.fillRect(-16, -18, 32, 36);
  ctx.strokeStyle = '#123524';
  ctx.lineWidth = 2;
  ctx.strokeRect(-16, -18, 32, 36);
  ctx.fillStyle = '#0d2b1a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(objectivesDone ? 'EXIT' : 'LOCK', 0, 1);
  ctx.restore();

  // --- walls (drawn over the floor edges)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (level.grid[r][c] !== '#') continue;
      const x = c * T;
      const y = r * T;
      const wallDecor = decorMap.get(`${c},${r}`);
      if (wallDecor === 'crate') {
        // A solid crate reads as a crate, not a plain wall block.
        drawDecor(ctx, 'crate', x, y);
        continue;
      }
      ctx.fillStyle = C.wall;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = P.wallTop;
      ctx.fillRect(x, y, T, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      // Paintings and hazard signs hang on the wall face.
      if (wallDecor === 'painting' || wallDecor === 'sign') {
        drawDecor(ctx, wallDecor, x, y);
      }
    }
  }

  // --- soft shadows under everything that stands on the floor, so the
  // light-dark contrast reads even in a small screenshot.
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  const dropShadow = (x, y, rx, ry) => {
    ctx.beginPath();
    ctx.ellipse(x, y + 8, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const g of G.guards) dropShadow(g.x, g.y, 15, 7);
  for (const item of level.items) if (!item.taken) dropShadow(item.x, item.y, 11, 5);
  if (!G.player.inCloset) dropShadow(G.player.x, G.player.y, 14, 6);
  for (const d of level.decor || []) {
    if (d.type === 'plant' || d.type === 'statue' || d.type === 'barrel' || d.type === 'crate') {
      dropShadow(d.c * T + T / 2, d.r * T + T / 2, 14, 6);
    }
  }
  ctx.restore();

  // --- items
  for (const item of level.items) {
    if (!item.taken) drawItem(ctx, item, time);
  }

  // --- thrown coin
  if (G.player.coinFlight) {
    const cf = G.player.coinFlight;
    ctx.beginPath();
    ctx.arc(cf.x, cf.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = C.artifact;
    ctx.fill();
    ctx.strokeStyle = '#a87e00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // --- noise ripples (coin rings bright, running-noise rings faint)
  for (const rip of G.ripples) {
    ctx.beginPath();
    ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
    const baseA = rip.faint ? 0.3 : 0.7;
    ctx.strokeStyle = `rgba(255,220,120,${Math.max(0, baseA * (1 - rip.t / rip.life))})`;
    ctx.lineWidth = rip.faint ? 1.5 : 2;
    ctx.stroke();
  }

  // --- cameras (small wall-mounted units)
  for (const cam of G.cameras) {
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.rotate(cam.dir);
    ctx.fillStyle = cam.seesPlayer ? '#ff5d5d' : '#3c4356';
    ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = cam.seesPlayer ? '#ff2020' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(10, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- guards and dog
  for (const g of G.guards) drawGuardFigure(ctx, g, time);

  // --- player
  if (!G.player.inCloset) drawPlayer(ctx, G.player, time);

  // --- tall grass, front blades: they overlap a player standing inside,
  // so a hiding player reads as half-concealed in the grass.
  for (const key of level.grass) {
    const [c, r] = key.split(',').map(Number);
    drawGrassBlades(ctx, c * T, r * T, time, hash(c, r), true);
  }

  // --- darkness with light pools
  if (!darkCanvas) {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = WIDTH;
    darkCanvas.height = HEIGHT;
  }
  const dctx = darkCanvas.getContext('2d');
  dctx.clearRect(0, 0, WIDTH, HEIGHT);
  dctx.globalCompositeOperation = 'source-over';
  dctx.fillStyle = 'rgba(3,5,14,0.44)';
  dctx.fillRect(0, 0, WIDTH, HEIGHT);
  dctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const g = dctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(x, y, r, 0, Math.PI * 2);
    dctx.fill();
  };
  hole(G.player.x, G.player.y, 175);
  for (const lamp of level.lamps) hole(lamp.x, lamp.y, 150, 0.85);
  hole(ex.x, ex.y, 90, 0.8);
  for (const item of level.items) if (!item.taken) hole(item.x, item.y, 55, 0.7);
  for (const g of G.guards) hole(g.x, g.y, 100, 0.75);
  ctx.drawImage(darkCanvas, 0, 0);

  // --- vision cones (drawn over the darkness so they glow)
  for (const g of G.guards) {
    const isDog = g.kind === 'dog';
    const range = isDog ? CONFIG.DOG_CONE_RANGE : CONFIG.CONE_RANGE;
    const angle = isDog ? CONFIG.DOG_CONE_ANGLE : CONFIG.CONE_ANGLE;
    const [fill, edge] =
      g.state === 'alerted'
        ? [C.coneAlerted, C.coneAlertedEdge]
        : g.state === 'suspicious'
          ? [C.coneSuspicious, C.coneSuspiciousEdge]
          : [C.conePatrol, C.conePatrolEdge];
    drawCone(ctx, level, g.x, g.y, g.dir, range, angle, fill, edge);
  }
  for (const cam of G.cameras) {
    drawCone(ctx, level, cam.x, cam.y, cam.dir, CONFIG.CAMERA_RANGE, CONFIG.CAMERA_ANGLE, C.coneCamera, C.coneCameraEdge);
  }

  // --- Sonar Pulse: the expanding ring, and every guard's destination
  // revealed through the walls while the pulse lasts (dashed line to where
  // the guard is heading, ringed in its current state's colour).
  if (G.sonar) {
    const p = G.player;
    const k = G.sonar.t / G.sonar.life;
    const R = 40 + k * 520;
    ctx.save();
    ctx.strokeStyle = `rgba(110,225,255,${0.85 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(110,225,255,${0.4 * (1 - k)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(10, R - 26), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 2;
    for (const g of G.guards) {
      const col = g.state === 'alerted' ? '#ff5d5d' : g.state === 'suspicious' ? '#ff9d45' : '#ffd76a';
      const dest = g.target || (g.waypoints.length > 1 ? g.waypoints[g.wpIndex % g.waypoints.length] : null);
      if (dest) {
        ctx.strokeStyle = `rgba(110,225,255,${0.75 * (1 - k)})`;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(dest.x, dest.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(110,225,255,${0.9 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(dest.x, dest.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // --- floating texts
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    const a = Math.max(0, 1 - f.t / f.life);
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color || '#fff';
    ctx.fillText(f.text, f.x, f.y - f.t * 22);
  }
  ctx.globalAlpha = 1;
}

export function objectivesComplete(G) {
  const { level } = G;
  if (level.vault) {
    // Office: keycard + vault opened.
    return level.vaultOpen;
  }
  const got = level.items.filter((i) => i.taken && i.kind !== 'vault').length;
  const need = level.items.filter((i) => i.kind !== 'vault').length;
  return got >= need;
}

export function objectivesText(G) {
  const { level } = G;
  if (level.vault) {
    if (!level.hasKeycard) return 'Find the keycard';
    if (!level.vaultOpen) return 'Open the safe (E)';
    return 'Reach the exit';
  }
  const got = level.items.filter((i) => i.taken).length;
  const need = level.items.length;
  if (got < need) return `${level.itemLabel}: ${got}/${need}`;
  return 'Reach the exit';
}
