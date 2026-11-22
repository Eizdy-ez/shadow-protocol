// SHADOW PROTOCOL — all drawing: the world, the lighting, the entities.
// Deterministic: every fine detail is hashed from tile coordinates, never
// Math.random(), so two runs of the same scene look byte-identical.
// The canvas backing store is 2x the CSS size; render() sets the transform
// once and draws in CSS pixels.
// Performance: the static scenery (floor, walls, decor, grass beds) is
// painted once per level into two offscreen canvases — a back layer under
// the entities and a front layer (grass blades, bush tops) over them —
// so each frame only draws the two layers plus the moving things.
import {
  TILE, COLS, ROWS, SS, VIEW_W, VIEW_H, DARKNESS_ALPHA, LAMP_RADIUS,
  PLAYER_LIGHT_RADIUS, hash2, dist,
} from './config.js';

function conePath(ctx, x, y, dir, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.closePath();
}

function drawCone(ctx, x, y, dir, range, halfAngle, rgb, alpha) {
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  conePath(ctx, x, y, dir, range, halfAngle);
  ctx.fill();
  // Solid edge lines — never dashed.
  ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha + 0.35)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(dir - halfAngle) * range, y + Math.sin(dir - halfAngle) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(dir + halfAngle) * range, y + Math.sin(dir + halfAngle) * range);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.stroke();
}

// Tall grass: ~21 thin pointed blades per tile, three greens, dark bed.
// The player hiding in grass is drawn first and the blades over the top,
// so a hidden player is still slightly visible among them.
export function drawGrassTile(ctx, pal, x, y, seed, front) {
  if (!front) {
    ctx.fillStyle = pal.grassBed;
    ctx.fillRect(x, y, TILE, TILE);
    return;
  }
  for (let i = 0; i < 21; i++) {
    const h1 = hash2(x / TILE, y / TILE, seed * 100 + i * 7 + 1);
    const h2 = hash2(x / TILE, y / TILE, seed * 100 + i * 7 + 2);
    const h3 = hash2(x / TILE, y / TILE, seed * 100 + i * 7 + 3);
    const bx = x + 3 + h1 * (TILE - 6);
    const len = 17 + h2 * 13;
    const tilt = (h3 - 0.5) * 12;
    const shade = pal.grass[Math.floor(h1 * 3) % 3];
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(bx - 2.2, y + TILE);
    ctx.lineTo(bx + tilt * 0.4, y + TILE - len);
    ctx.lineTo(bx + 2.2, y + TILE);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBush(ctx, pal, x, y, seed, front) {
  if (!front) {
    ctx.fillStyle = pal.bush;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.42, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 0; i < 9; i++) {
    const h1 = hash2(x / TILE, y / TILE, seed * 50 + i * 3 + 1);
    const h2 = hash2(x / TILE, y / TILE, seed * 50 + i * 3 + 2);
    ctx.fillStyle = h1 > 0.5 ? pal.bushLight : pal.bush;
    ctx.beginPath();
    ctx.arc(x + 6 + h1 * (TILE - 12), y + 6 + h2 * (TILE - 12), 5 + h2 * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrate(ctx, pal, x, y) {
  ctx.fillStyle = pal.crate;
  ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.strokeStyle = pal.crateEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + TILE - 3, y + TILE - 3);
  ctx.moveTo(x + TILE - 3, y + 3);
  ctx.lineTo(x + 3, y + TILE - 3);
  ctx.stroke();
}

function drawCloset(ctx, pal, x, y, occupied) {
  ctx.fillStyle = pal.closet;
  ctx.fillRect(x + 5, y + 2, TILE - 10, TILE - 4);
  ctx.strokeStyle = pal.closetEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 2, TILE - 10, TILE - 4);
  ctx.beginPath();
  ctx.moveTo(x + TILE / 2, y + 4);
  ctx.lineTo(x + TILE / 2, y + TILE - 4);
  ctx.stroke();
  if (occupied) {
    ctx.fillStyle = 'rgba(255,220,120,0.85)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', x + TILE / 2, y - 4);
  }
}

function drawLampFixture(ctx, pal, x, y) {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  ctx.fillStyle = 'rgba(255,200,110,0.16)';
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.fillRect(cx - 2, cy - 14, 4, 28);
  ctx.fillStyle = pal.lampCore;
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.lamp;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawShadow(ctx, x, y, r, alpha) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Static layers, painted once per level --------------------------------
let staticCache = { level: null, back: null, front: null };

function paintStaticLayers(game) {
  const { level } = game;
  const pal = level.palette;
  const back = document.createElement('canvas');
  back.width = VIEW_W * SS;
  back.height = VIEW_H * SS;
  const b = back.getContext('2d');
  b.setTransform(SS, 0, 0, SS, 0, 0);
  const front = document.createElement('canvas');
  front.width = VIEW_W * SS;
  front.height = VIEW_H * SS;
  const f = front.getContext('2d');
  f.setTransform(SS, 0, 0, SS, 0, 0);

  // Floor, shadow tiles, grass and bush beds.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE;
      const y = r * TILE;
      const tile = level.grid[r][c];
      const checker = (c + r) % 2 === 0;
      b.fillStyle = checker ? pal.floor : pal.floorAlt;
      b.fillRect(x, y, TILE, TILE);
      const h = hash2(c, r, 11);
      if (h > 0.72) {
        b.fillStyle = 'rgba(255,255,255,0.03)';
        b.fillRect(x + 6 + h * 20, y + 6 + hash2(c, r, 23) * 20, 3, 3);
      }
      if (tile === 'S') {
        b.fillStyle = pal.shadowTile;
        b.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        b.fillStyle = 'rgba(0,0,0,0.35)';
        b.beginPath();
        b.arc(x + TILE / 2, y + TILE / 2, 9, 0, Math.PI * 2);
        b.fill();
      } else if (tile === 'G') {
        drawGrassTile(b, pal, x, y, 3, false);
      } else if (tile === 'B') {
        drawBush(b, pal, x, y, 5, false);
      }
    }
  }

  // Patrol routes (dotted).
  b.fillStyle = 'rgba(255,255,255,0.20)';
  for (const g of game.guards) {
    for (let i = 0; i < g.path.length; i++) {
      const a = g.path[i];
      const b2 = g.path[(i + 1) % g.path.length];
      const d = dist(a.x, a.y, b2.x, b2.y);
      const steps = Math.floor(d / 14);
      for (let s = 0; s <= steps; s++) {
        const px = a.x + ((b2.x - a.x) * s) / Math.max(1, steps);
        const py = a.y + ((b2.y - a.y) * s) / Math.max(1, steps);
        b.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
    }
  }

  // Walls, crates, closets, lamps.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = level.grid[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (tile === '#') {
        b.fillStyle = pal.wall;
        b.fillRect(x, y, TILE, TILE);
        b.fillStyle = pal.wallTop;
        b.fillRect(x, y, TILE, 4);
        const h = hash2(c, r, 31);
        if (h > 0.6) {
          b.fillStyle = 'rgba(255,255,255,0.05)';
          b.fillRect(x + 4 + h * 24, y + 10, 6, 3);
        }
      } else if (tile === 'K') {
        drawCrate(b, pal, x, y);
      } else if (tile === 'C') {
        drawCloset(b, pal, x, y, false);
      } else if (tile === 'L') {
        drawLampFixture(b, pal, x, y);
      }
    }
  }

  // Front layer: grass blades and bush tops (drawn over the player).
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = level.grid[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (tile === 'G') drawGrassTile(f, pal, x, y, 3, true);
      else if (tile === 'B') drawBush(f, pal, x, y, 5, true);
    }
  }
  staticCache = { level, back, front };
  return staticCache;
}

export function renderWorld(ctx, game, t) {
  const { level, player } = game;
  const pal = level.palette;
  const { back, front } = staticCache.level === level ? staticCache : paintStaticLayers(game);

  // Back layer (identity transform: the offscreen canvas is already 2x).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VIEW_W * SS, VIEW_H * SS);
  ctx.drawImage(back, 0, 0);
  ctx.setTransform(SS, 0, 0, SS, 0, 0);

  // ---- Exit and items (dynamic: the exit lights up when all are taken) ---
  const exit = level.exit;
  const allTaken = level.items.every((it) => it.taken);
  ctx.save();
  ctx.fillStyle = allTaken ? 'rgba(120,255,150,0.9)' : 'rgba(150,200,255,0.55)';
  ctx.fillRect(exit.x - 16, exit.y - 16, 32, 32);
  ctx.strokeStyle = allTaken ? '#b6ffd0' : '#cfe6ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x - 16, exit.y - 16, 32, 32);
  ctx.fillStyle = '#0e1a12';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exit.x, exit.y + 4);
  ctx.restore();
  for (const item of level.items) {
    if (item.taken) continue;
    const bob = Math.sin(t * 2.4 + item.c) * 3;
    const sparkle = 0.6 + 0.4 * Math.sin(t * 3.1 + item.r * 2);
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    ctx.fillStyle = `rgba(255,215,110,${0.25 * sparkle})`;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c8';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Closet "HIDDEN" label when the player is inside one.
  if (player.inCloset) {
    const cc = Math.floor(player.x / TILE);
    const cr = Math.floor(player.y / TILE);
    ctx.fillStyle = 'rgba(255,220,120,0.85)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', cc * TILE + TILE / 2, cr * TILE - 4);
  }

  // ---- Thrown coins -------------------------------------------------------
  for (const coin of game.coins) {
    const p = coin.landed ? 1 : Math.min(1, coin.t * 4);
    const cx = coin.sx + (coin.x - coin.sx) * p;
    const cy = coin.sy + (coin.y - coin.sy) * p - Math.sin(p * Math.PI) * 26;
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87e1e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ---- Vision cones -------------------------------------------------------
  for (const cam of game.cameras) {
    const rgb = cam.suspicion > 0.4 ? '255,80,60' : pal.cone;
    drawCone(ctx, cam.x, cam.y, cam.dir, 244, 0.52, rgb, cam.suspicion > 0.4 ? 0.3 : 0.16);
  }
  for (const g of game.guards) {
    const alerted = g.state === 'alerted';
    const suspicious = g.state === 'suspicious';
    const rgb = alerted ? '255,60,40' : suspicious ? '255,200,60' : pal.cone;
    drawCone(ctx, g.x, g.y, g.dir, 232, 0.62, rgb, alerted ? 0.32 : suspicious ? 0.26 : 0.15);
  }
  if (game.dog) {
    drawCone(ctx, game.dog.x, game.dog.y, game.dog.dir, 172, 0.72, '255,150,90', 0.14);
  }

  // ---- Sonar reveal -------------------------------------------------------
  if (player.sonarT > 0) {
    const a = Math.min(1, player.sonarT);
    ctx.strokeStyle = `rgba(120,220,255,${0.7 * a})`;
    ctx.lineWidth = 2;
    for (const g of game.guards) {
      const dest = g.path[g.wp] || g.path[0];
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(dest.x, dest.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(120,220,255,${0.8 * a})`;
      ctx.beginPath();
      ctx.arc(dest.x, dest.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const pulseR = (3.5 - player.sonarT) * 260;
    ctx.strokeStyle = `rgba(120,220,255,${0.45 * a})`;
    ctx.beginPath();
    ctx.arc(player.x, player.y, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- Shadows under entities ---------------------------------------------
  for (const g of game.guards) drawShadow(ctx, g.x, g.y + 10, 13, 0.35);
  if (game.dog) drawShadow(ctx, game.dog.x, game.dog.y + 8, 12, 0.35);
  for (const item of level.items) if (!item.taken) drawShadow(ctx, item.x, item.y + 10, 10, 0.3);
  drawShadow(ctx, player.x, player.y + 11, 12, 0.4);

  // ---- Cameras -------------------------------------------------------------
  for (const cam of game.cameras) {
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cam.suspicion > 0.4 ? '#ff5040' : '#c8d4e0';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.dir) * 5, cam.y + Math.sin(cam.dir) * 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Guards ---------------------------------------------------------------
  for (const g of game.guards) {
    const alerted = g.state === 'alerted';
    const suspicious = g.state === 'suspicious';
    ctx.fillStyle = alerted ? '#c23b2e' : suspicious ? '#c8902e' : '#3f5a78';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = alerted ? '#ff8a70' : '#dfe9f5';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.dir) * 16, g.y + Math.sin(g.dir) * 16);
    ctx.stroke();
    const ex = Math.cos(g.dir);
    const ey = Math.sin(g.dir);
    const px = -ey;
    const py = ex;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(g.x + ex * 5 + px * 4, g.y + ey * 5 + py * 4, 2.2, 0, Math.PI * 2);
    ctx.arc(g.x + ex * 5 - px * 4, g.y + ey * 5 - py * 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (alerted || suspicious) {
      ctx.fillStyle = alerted ? '#ff5040' : '#ffd94a';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(alerted ? '!' : '?', g.x, g.y - 20);
      if (g.suspicion > 0 && g.suspicion < 1 && !alerted) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(g.x - 12, g.y - 30, 24, 4);
        ctx.fillStyle = '#ffd94a';
        ctx.fillRect(g.x - 12, g.y - 30, 24 * g.suspicion, 4);
      }
    }
  }

  // ---- Dog -------------------------------------------------------------------
  if (game.dog) {
    const d = game.dog;
    ctx.fillStyle = '#5a4632';
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, 14, 9, d.dir, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(d.x + Math.cos(d.dir) * 12, d.y + Math.sin(d.dir) * 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1c10';
    ctx.beginPath();
    ctx.arc(d.x + Math.cos(d.dir) * 16, d.y + Math.sin(d.dir) * 16, 2, 0, Math.PI * 2);
    ctx.fill();
    if (d.barkT > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WOOF!', d.x, d.y - 20);
    }
  }

  // ---- Player ------------------------------------------------------------------
  if (!player.inCloset) {
    const px = player.x;
    const py = player.y;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const ex = Math.cos(player.dir);
    const ey = Math.sin(player.dir);
    const pxp = -ey;
    const pyp = ex;
    ctx.fillStyle = '#062a33';
    ctx.beginPath();
    ctx.arc(px + ex * 5 + pxp * 4.5, py + ey * 5 + pyp * 4.5, 2.4, 0, Math.PI * 2);
    ctx.arc(px + ex * 5 - pxp * 4.5, py + ey * 5 - pyp * 4.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (player.hidden) {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(140,255,160,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- Noise rings --------------------------------------------------------------
  for (const ring of player.noiseRings) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, ring.a)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- Front layer: grass blades and bush tops over the player -------------------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(front, 0, 0);
  ctx.setTransform(SS, 0, 0, SS, 0, 0);

  // ---- Floating texts --------------------------------------------------------------
  ctx.textAlign = 'center';
  for (const ft of game.floatingTexts) {
    ctx.globalAlpha = Math.max(0, ft.a);
    ctx.fillStyle = ft.color || '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // ---- Lampblack lighting: darkness with pools of lamplight --------------------------
  ctx.save();
  ctx.fillStyle = `rgba(2,2,8,${DARKNESS_ALPHA})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalCompositeOperation = 'destination-out';
  for (const lamp of level.lamps) {
    const grad = ctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, LAMP_RADIUS);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, LAMP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  const pg = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, PLAYER_LIGHT_RADIUS);
  pg.addColorStop(0, 'rgba(0,0,0,0.55)');
  pg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_LIGHT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderTitle(ctx, t) {
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#0a0a14');
  grad.addColorStop(1, '#141a26');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(255,176,66,0.08)';
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2, 300);
  ctx.lineTo(VIEW_W / 2 - 260, 700);
  ctx.lineTo(VIEW_W / 2 + 260, 700);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e3c8';
  ctx.font = 'bold 84px monospace';
  ctx.fillText('SHADOW', VIEW_W / 2, 250);
  ctx.fillText('PROTOCOL', VIEW_W / 2, 340);
  ctx.fillStyle = '#ffb347';
  ctx.font = '20px monospace';
  ctx.fillText('slip past the cones · take the artefacts · leave unseen', VIEW_W / 2, 390);
  ctx.fillStyle = '#c8d4e0';
  ctx.font = '17px monospace';
  const lines = [
    'WASD / arrows — move      SHIFT — sneak (slow, quiet)',
    'CLICK — throw a distraction coin      E — interact / hide in a closet',
    'Q — Sonar Pulse (2 per level): see guard routes through walls,',
    '    but guards within 150px hear it',
    '',
    'Hide in shadows, bushes and tall grass. Run, and guards hear you.',
    'Caught: +30 alarm. Alarm 100: mission failed.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 450 + i * 28));
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 22px monospace';
  const blink = Math.sin(t * 3) > -0.2;
  if (blink) ctx.fillText('Press ENTER to begin — or press 1-5 to jump to a level', VIEW_W / 2, 690);
  ctx.fillStyle = '#8a94a6';
  ctx.font = '14px monospace';
  ctx.fillText('a top-down stealth game · built by an AI agent for make.fun', VIEW_W / 2, 740);
}
