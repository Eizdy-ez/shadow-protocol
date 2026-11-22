// SHADOW PROTOCOL — the player: movement, collision, hiding, sonar, coins.
import {
  TILE, PLAYER_RADIUS, PLAYER_RUN_SPEED, PLAYER_SNEAK_SPEED,
  SONAR_CHARGES, COINS_PER_LEVEL, SONAR_HEAR_RADIUS, clamp,
} from './config.js';
import { isWallTile, isHidingTile, isClosetTile, nearestWalkable } from './levels.js';

export function createPlayer(level) {
  return {
    x: level.playerStart.x,
    y: level.playerStart.y,
    r: PLAYER_RADIUS,
    dir: 0, // facing angle, radians
    moving: false,
    sneaking: false,
    hidden: false,
    inCloset: false,
    coins: COINS_PER_LEVEL,
    sonarCharges: SONAR_CHARGES,
    sonarT: 0, // seconds left of the sonar reveal
    noiseRings: [], // {x, y, r, a} expanding rings while running
    ringT: 0,
    stepT: 0,
    movingSound: false,
  };
}

// Circle-vs-tile collision: for each solid tile near the circle, find the
// closest point on the tile rectangle and push the circle out. This is the
// only correct way to collide a circle with a tile grid — sampling points
// around the circle snags on wall corners.
export function collideCircle(level, p) {
  const r = p.r;
  const c0 = Math.floor((p.x - r) / TILE);
  const c1 = Math.floor((p.x + r) / TILE);
  const r0 = Math.floor((p.y - r) / TILE);
  const r1 = Math.floor((p.y + r) / TILE);
  for (let tr = r0; tr <= r1; tr++) {
    for (let tc = c0; tc <= c1; tc++) {
      if (!isWallTile(level, tc, tr)) continue;
      const nearestX = clamp(p.x, tc * TILE, tc * TILE + TILE);
      const nearestY = clamp(p.y, tr * TILE, tr * TILE + TILE);
      const dx = p.x - nearestX;
      const dy = p.y - nearestY;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = nearestX + (dx / d) * r;
        p.y = nearestY + (dy / d) * r;
      } else {
        // Centre inside the tile: push out along the smallest penetration.
        const left = p.x - tc * TILE;
        const right = tc * TILE + TILE - p.x;
        const top = p.y - tr * TILE;
        const bottom = tr * TILE + TILE - p.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) p.x = tc * TILE - r;
        else if (m === right) p.x = tc * TILE + TILE + r;
        else if (m === top) p.y = tr * TILE - r;
        else p.y = tr * TILE + TILE + r;
      }
    }
  }
}

// Move the player by (mx, my) — a unit vector — for dt seconds.
// Returns true when the player actually moved.
export function movePlayer(level, p, mx, my, dt, sneaking) {
  if (mx === 0 && my === 0) {
    p.moving = false;
    p.sneaking = false;
    return false;
  }
  const speed = sneaking ? PLAYER_SNEAK_SPEED : PLAYER_RUN_SPEED;
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  collideCircle(level, p);
  p.dir = Math.atan2(my, mx);
  p.moving = true;
  p.sneaking = sneaking;
  // Running is audible: leave expanding noise rings behind.
  if (!sneaking) {
    p.ringT -= dt;
    if (p.ringT <= 0) {
      p.noiseRings.push({ x: p.x, y: p.y, r: 6, a: 0.5 });
      p.ringT = 0.28;
    }
  }
  for (const ring of p.noiseRings) {
    ring.r += 130 * dt;
    ring.a -= 0.9 * dt;
  }
  p.noiseRings = p.noiseRings.filter((ring) => ring.a > 0);
  return true;
}

export function updatePlayerHiding(level, p) {
  if (p.inCloset) {
    p.hidden = true;
    return;
  }
  p.hidden = isHidingTile(level, p.x, p.y);
}

// Throw a coin at pixel (x, y). The coin is nudged to the nearest walkable
// tile so it never lands inside a wall. Returns the coin or null.
export function throwCoin(level, p, x, y) {
  if (p.coins <= 0) return null;
  let c = Math.floor(x / TILE);
  let r = Math.floor(y / TILE);
  [c, r] = nearestWalkable(level, c, r);
  p.coins -= 1;
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, t: 0, landed: false, sx: p.x, sy: p.y };
}

// Fire a sonar pulse. Returns true when a charge was spent.
export function fireSonar(p) {
  if (p.sonarCharges <= 0) return false;
  p.sonarCharges -= 1;
  p.sonarT = 3.5;
  return true;
}

export function sonarHeardRadius() {
  return SONAR_HEAR_RADIUS;
}

// Toggle hiding in a closet when the player stands on one (E key).
export function toggleCloset(level, p) {
  if (!isClosetTile(level, p.x, p.y)) return false;
  p.inCloset = !p.inCloset;
  p.hidden = p.inCloset || isHidingTile(level, p.x, p.y);
  return true;
}
