// SHADOW PROTOCOL — autopilot, a play-test bot.
// It only runs with ?autoplay=1. It proves each level is winnable without
// cheats: it reads the same tiles, cones and noise rules the player does,
// finds a path with breadth-first search, waits when the next tile is inside
// a vision cone, and spends a coin to pull a guard away when it waits too
// long. It never teleports, never edits the level, never touches the meter.

import { CONFIG } from './config.js';
import { isWallTile, tileAt } from './levels.js';
import { canSee } from './guards.js';
import { doInteract, interactable } from './player.js';
import { objectivesComplete } from './render.js';

const { TILE, COLS, ROWS } = CONFIG;

function tileOf(x, y) {
  return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
}

function bfs(level, sc, sr, tc, tr, blocked = null) {
  if (sc === tc && sr === tr) return [];
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [[sc, sr]];
  prev.set(key(sc, sr), null);
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (isWallTile(level, nc, nr)) continue;
      if (blocked && blocked(nc, nr) && !(nc === tc && nr === tr)) continue;
      const k = key(nc, nr);
      if (prev.has(k)) continue;
      prev.set(k, [c, r]);
      if (nc === tc && nr === tr) {
        const path = [[nc, nr]];
        let cur = [c, r];
        while (cur) {
          path.unshift(cur);
          cur = prev.get(key(cur[0], cur[1]));
        }
        return path;
      }
      queue.push([nc, nr]);
    }
  }
  return null;
}

function coneAt(level, guards, cameras, x, y) {
  for (const g of guards) {
    const opts =
      g.kind === 'dog'
        ? { range: CONFIG.DOG_CONE_RANGE, angle: CONFIG.DOG_CONE_ANGLE }
        : {};
    if (canSee(g, x, y, level, false, opts).visible) return g;
  }
  for (const cam of cameras) {
    if (
      canSee(cam, x, y, level, false, { range: CONFIG.CAMERA_RANGE, angle: CONFIG.CAMERA_ANGLE })
        .visible
    ) {
      return cam;
    }
  }
  return null;
}

// The nearest hiding spot (shadow or bush) that no cone currently covers,
// within maxDist pixels — where the bot waits out a patrol or breaks a chase.
function nearestHide(level, guards, cameras, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  const consider = (c, r) => {
    const cx = c * TILE + TILE / 2;
    const cy = r * TILE + TILE / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d >= bestD) return;
    if (coneAt(level, guards, cameras, cx, cy)) return;
    best = { x: cx, y: cy };
    bestD = d;
  };
  for (const key of level.shadows) {
    const [c, r] = key.split(',').map(Number);
    consider(c, r);
  }
  for (const key of level.bushes) {
    const [c, r] = key.split(',').map(Number);
    consider(c, r);
  }
  // Tall grass hides the player just as well — the bot waits there too.
  for (const key of level.grass) {
    const [c, r] = key.split(',').map(Number);
    consider(c, r);
  }
  return best;
}

function pickTarget(G) {
  const { level, player } = G;
  // Nearest uncollected item (keycard before vault, documents in any order).
  let best = null;
  let bestD = Infinity;
  for (const item of level.items) {
    if (item.taken) continue;
    if (item.kind === 'vault' && !level.hasKeycard) continue;
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = { kind: 'item', x: item.x, y: item.y, item };
    }
  }
  if (best) return best;
  if (objectivesComplete(G)) return { kind: 'exit', x: level.exit.x, y: level.exit.y };
  return null;
}

export function stepAutopilot(G, dt, input) {
  const { level, player } = G;
  const ap = G.autopilot;
  ap.t -= dt;

  // Flee: an alerted guard nearby means run for the nearest hiding spot
  // (breaking line of sight is what makes a guard give up) and stay there
  // until the chase is over. Waiting in a corridor while being chased
  // only gets the bot caught.
  const chaser = G.guards.find(
    (g) => g.state === 'alerted' && Math.hypot(g.x - player.x, g.y - player.y) < 300,
  );
  if (chaser || ap.fleeing) {
    if (!chaser && ap.fleeing) {
      const d = ap.fleeTarget
        ? Math.hypot(ap.fleeTarget.x - player.x, ap.fleeTarget.y - player.y)
        : 999;
      if (d < 50) ap.fleeing = false;
    } else {
      ap.fleeing = true;
    }
    if (ap.fleeing) {
      if (ap.t <= 0 || !ap.fleeTarget) {
        ap.fleeTarget =
          nearestHide(level, G.guards, G.cameras, player.x, player.y, 500) || level.playerStart;
        const s = tileOf(player.x, player.y);
        const t = tileOf(ap.fleeTarget.x, ap.fleeTarget.y);
        const inCone = (c, r) =>
          !!coneAt(level, G.guards, G.cameras, c * TILE + TILE / 2, r * TILE + TILE / 2);
        ap.path = bfs(level, s.c, s.r, t.c, t.r, inCone) || bfs(level, s.c, s.r, t.c, t.r) || [];
        ap.pathI = 1;
        ap.t = 0.5;
      }
      followPath(G, input, dt, false);
      return;
    }
  }

  // Interact whenever an objective is in reach. Closets are deliberately
  // excluded: walking past one must not make the bot hide in it (it did —
  // enter, exit, enter, every frame — and never reached the exit).
  const what = interactable(player, level);
  if (what && what.kind !== 'closet') {
    doInteract(player, level, G, what);
    return;
  }

  const target = pickTarget(G);
  if (!target) return;

  // Hold: never walk up to an objective a guard is standing next to.
  // Retreat into the nearest hiding spot and wait there — standing in the
  // open next to a patrol is how the bot got caught three times in a row.
  const guardOnTarget = G.guards.some(
    (g) => Math.hypot(g.x - target.x, g.y - target.y) < 170,
  );
  const nearTarget = Math.hypot(target.x - player.x, target.y - player.y) < 320;
  if (guardOnTarget && nearTarget && !player.hidden) {
    if (
      !ap.holdTile ||
      coneAt(level, G.guards, G.cameras, ap.holdTile.x, ap.holdTile.y)
    ) {
      ap.holdTile = nearestHide(level, G.guards, G.cameras, player.x, player.y, 300);
    }
    if (ap.holdTile) {
      const dx = ap.holdTile.x - player.x;
      const dy = ap.holdTile.y - player.y;
      if (Math.hypot(dx, dy) > 10) {
        moveToward(G, input, dx, dy, true);
        return;
      }
    }
    input.keys.add('ShiftLeft'); // wait quietly, hidden
    return;
  }
  ap.holdTile = null;

  // Replan on a timer or when the target changed. Prefer a route that
  // stays out of the vision cones entirely; fall back to the shortest
  // route (and sneak through it) when no safe route exists.
  const tKey = `${target.kind}:${target.x},${target.y}`;
  if (ap.t <= 0 || ap.targetKey !== tKey) {
    const s = tileOf(player.x, player.y);
    const t = tileOf(target.x, target.y);
    const inCone = (c, r) =>
      !!coneAt(level, G.guards, G.cameras, c * TILE + TILE / 2, r * TILE + TILE / 2);
    ap.path = bfs(level, s.c, s.r, t.c, t.r, inCone) || bfs(level, s.c, s.r, t.c, t.r) || [];
    ap.pathI = 1; // path[0] is the tile we stand on
    ap.targetKey = tKey;
    ap.t = 0.5;
  }

  followPath(G, input, dt, true, target);
}

// Walk the planned path one node at a time. With danger checks on, the bot
// waits outside vision cones (and spends a coin, then pushes through, if
// the wait drags on). Fleeing skips the waiting: the guard already knows.
function followPath(G, input, dt, checkDanger, target = null) {
  const { level, player } = G;
  const ap = G.autopilot;

  if (!ap.path || ap.pathI >= ap.path.length) {
    // Standing on the target tile but not close enough to interact: nudge
    // straight at the target.
    if (target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      if (Math.hypot(dx, dy) > 6) moveToward(G, input, dx, dy, false);
    }
    return;
  }

  const [nc, nr] = ap.path[ap.pathI];
  const nx = nc * TILE + TILE / 2;
  const ny = nr * TILE + TILE / 2;
  const dx = nx - player.x;
  const dy = ny - player.y;
  if (Math.hypot(dx, dy) < 6) {
    ap.pathI++;
    return;
  }

  // Danger ahead? Wait in place (sneaking) instead of walking into a cone.
  // After waiting too long, push through anyway for a few seconds — the
  // grace meter allows a brief crossing, and waiting forever proves nothing.
  const danger = !checkDanger || ap.pushT > 0 ? null : coneAt(level, G.guards, G.cameras, nx, ny);
  const guardNear = G.guards.some((g) => Math.hypot(g.x - player.x, g.y - player.y) < 240);
  if (ap.pushT > 0) ap.pushT -= dt;
  if (danger) {
    ap.waitT += dt;
    input.keys.add('ShiftLeft'); // wait quietly
    if (ap.waitT > 2.5 && player.coins > 0 && !ap.coinThrown) {
      // Pull the guard away: throw a coin to the far side of the guard.
      const g = danger.x !== undefined && danger.kind ? danger : null;
      const gx = g ? g.x : nx;
      const gy = g ? g.y : ny;
      const away = Math.atan2(gy - player.y, gx - player.x) + Math.PI;
      const tx = gx + Math.cos(away) * 180;
      const ty = gy + Math.sin(away) * 180;
      G.throwCoin(tx, ty);
      ap.coinThrown = true;
      ap.waitT = 0;
    }
    if (ap.waitT > 6) {
      ap.waitT = 0;
      ap.coinThrown = false;
      ap.pushT = 2.5;
    }
    return;
  }
  ap.waitT = 0;
  ap.coinThrown = false;
  moveToward(G, input, dx, dy, guardNear);
}

function moveToward(G, input, dx, dy, sneak) {
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  if (sneak) input.keys.add('ShiftLeft');
  // A low threshold matters: the bot must steer back onto the centre line
  // of a corridor, or its circle wedges against the wall beside a gap.
  if (ny < -0.15) input.keys.add('KeyW');
  if (ny > 0.15) input.keys.add('KeyS');
  if (nx < -0.15) input.keys.add('KeyA');
  if (nx > 0.15) input.keys.add('KeyD');
}
