// SHADOW PROTOCOL — the autopilot: a bot that plays the game the way a
// careful player would, so every level can be verified end to end.
// Rules it follows (these matter, do not "simplify" them away):
//  - cone-avoiding BFS: prefer a route that never enters a vision cone,
//    fall back to the shortest route only after waiting;
//  - when no safe route exists, retreat to the nearest shadow, bush or
//    grass patch and wait for the patrol to pass — never wait in the open
//    near the objective; go again the moment a safe route appears;
//  - when chased, flee to the nearest hiding spot at full run speed, never
//    to the level start, and never sneak while fleeing;
//  - never automatically interact with closets.
import { TILE, COLS, ROWS, dist } from './config.js';
import { isWalkable, tileAt } from './levels.js';
import { findPath } from './guards.js';
import { CONE_RANGE, CONE_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE } from './config.js';

function tileCenter(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

// Is the tile (c, r) inside any guard or camera cone right now? (Geometry
// only — no line-of-sight test — so the bot is cautious, never reckless.)
function tileInDanger(game, c, r) {
  const p = tileCenter(c, r);
  for (const g of game.guards) {
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > CONE_RANGE) continue;
    const a = Math.atan2(p.y - g.y, p.x - g.x);
    let diff = a - g.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= CONE_HALF_ANGLE) return true;
  }
  for (const cam of game.cameras) {
    const d = dist(cam.x, cam.y, p.x, p.y);
    if (d > CAMERA_RANGE) continue;
    const a = Math.atan2(p.y - cam.y, p.x - cam.x);
    let diff = a - cam.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= CAMERA_HALF_ANGLE) return true;
  }
  if (game.dog) {
    const d = dist(game.dog.x, game.dog.y, p.x, p.y);
    if (d < 150) return true;
  }
  return false;
}

// BFS with a danger-aware cost: safe tiles cost 1, cone tiles cost 30,
// tiles near a guard cost extra. Returns a list of tile centres.
function safePath(game, sc, sr, tc, tr) {
  const level = game.level;
  if (!isWalkable(level, tc, tr)) return null;
  const key = (c, r) => r * COLS + c;
  const cost = new Map([[key(sc, sr), 0]]);
  const prev = new Map();
  const open = [[0, sc, sr]];
  const inOpen = new Set([key(sc, sr)]);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [cc, c, r] = open.splice(bi, 1)[0];
    inOpen.delete(key(c, r));
    if (c === tc && r === tr) {
      const path = [];
      let cur = [c, r];
      while (cur) {
        path.unshift(tileCenter(cur[0], cur[1]));
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isWalkable(level, nc, nr)) continue;
      let step = 1;
      if (tileInDanger(game, nc, nr)) step += 30;
      for (const g of game.guards) {
        if (dist(g.x, g.y, nc * TILE + TILE / 2, nr * TILE + TILE / 2) < 90) step += 8;
      }
      const nk = key(nc, nr);
      const nc2 = cc + step;
      if (cost.has(nk) && cost.get(nk) <= nc2) continue;
      cost.set(nk, nc2);
      prev.set(nk, [c, r]);
      if (inOpen.has(nk)) {
        const ex = open.find((o) => o[1] === nc && o[2] === nr);
        if (ex) ex[0] = nc2;
      } else {
        inOpen.add(nk);
        open.push([nc2, nc, nr]);
      }
    }
  }
  return null;
}

function pathHasDanger(game, path) {
  if (!path) return true;
  for (const n of path) {
    if (tileInDanger(game, Math.floor(n.x / TILE), Math.floor(n.y / TILE))) return true;
  }
  return false;
}

function nearestHiding(game, maxDist = 340) {
  const level = game.level;
  const p = game.player;
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = tileAt(level, c, r);
      if (t !== 'S' && t !== 'B' && t !== 'G') continue;
      const d = dist(p.x, p.y, c * TILE + TILE / 2, r * TILE + TILE / 2);
      if (d < bestD && d <= maxDist) {
        bestD = d;
        best = { c, r };
      }
    }
  }
  if (!best) {
    // No hiding tile nearby: the walkable tile farthest from every guard.
    let bestScore = -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isWalkable(level, c, r)) continue;
        let nearest = Infinity;
        for (const g of game.guards) {
          nearest = Math.min(nearest, dist(g.x, g.y, c * TILE + TILE / 2, r * TILE + TILE / 2));
        }
        const d = dist(p.x, p.y, c * TILE + TILE / 2, r * TILE + TILE / 2);
        if (nearest > 170 && d < 340 && nearest > bestScore) {
          bestScore = nearest;
          best = { c, r };
        }
      }
    }
  }
  return best;
}

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.path = null;
    this.pathIdx = 0;
    this.repathT = 0;
    this.mode = 'go'; // go | hide | flee
    this.hideT = 0;
    this.pushT = 0;
    this.pushSneakT = 0;
    this.stuckT = 0;
    this.lastX = 0;
    this.lastY = 0;
  }

  objective() {
    const level = this.game.level;
    const p = this.game.player;
    let best = null;
    let bestD = Infinity;
    for (const item of level.items) {
      if (item.taken) continue;
      const d = dist(p.x, p.y, item.x, item.y);
      if (d < bestD) {
        bestD = d;
        best = { c: item.c, r: item.r };
      }
    }
    if (best) return best;
    return { c: level.exit.c, r: level.exit.r };
  }

  setPath(path) {
    this.path = path;
    this.pathIdx = 0;
  }

  update(dt) {
    const game = this.game;
    const p = game.player;
    const level = game.level;
    const pc = Math.floor(p.x / TILE);
    const pr = Math.floor(p.y / TILE);

    // Stuck detection: barely moved while trying to move.
    if (dist(p.x, p.y, this.lastX, this.lastY) < 4 && this.path) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastX = p.x;
    this.lastY = p.y;
    if (this.stuckT > 3) {
      this.path = null;
      this.stuckT = 0;
      this.pushT = 1.2;
    }

    const chased = game.guards.some((g) => g.state === 'alerted') ||
      game.guards.some((g) => g.state === 'suspicious' && dist(p.x, p.y, g.x, g.y) < 100) ||
      (game.dog && game.dog.state === 'alerted');
    if (chased && this.mode !== 'flee') {
      this.mode = 'flee';
      this.path = null;
      this.repathT = 0;
    }
    if (!chased && this.mode === 'flee') {
      this.mode = 'go';
      this.path = null;
      this.repathT = 0;
    }

    // Proactive retreat: only when a watcher is actually seeing the
    // player — its suspicion meter is rising. Merely standing in a cone
    // that is about to sweep away is not a reason to abandon the route:
    // the bot crosses cone edges quickly, faster than suspicion fills.
    if (!chased && this.mode === 'go' && !p.hidden) {
      let watched = false;
      for (const g of game.guards) if (g.suspicion > 0.25) { watched = true; break; }
      if (!watched) for (const cam of game.cameras) if (cam.suspicion > 0.25) { watched = true; break; }
      if (watched) {
        this.mode = 'hide';
        this.hideT = 0;
        this.path = null;
        this.repathT = 0;
      }
    }

    if (this.pushT > 0) this.pushT -= dt;
    if (this.pushSneakT > 0) this.pushSneakT -= dt;
    this.repathT -= dt;

    if (this.repathT <= 0 || !this.path) {
      this.repathT = 0.25;
      if (this.mode === 'flee') {
        // Fleeing: take the cone-avoiding route to hiding. The chasing
        // guard already knows where the bot is, but the shortest route
        // cuts straight through OTHER guards' cones in a dense level and
        // gets the bot seen again — the danger-aware cost still moves the
        // bot toward hiding, just around the cones when a detour exists.
        const hide = nearestHiding(game, 420);
        this.setPath(hide ? (safePath(game, pc, pr, hide.c, hide.r) || findPath(level, pc, pr, hide.c, hide.r)) : null);
      } else if (this.mode === 'hide') {
        // Waiting in hiding: go again the moment a safe route appears.
        const obj = this.objective();
        const path = safePath(game, pc, pr, obj.c, obj.r);
        if (path && !pathHasDanger(game, path)) {
          this.mode = 'go';
          this.hideT = 0;
          this.setPath(path);
        } else if (this.hideT > 8) {
          // Waited long enough for the guard to give up and return to
          // patrol: push through on the shortest route, sneaking so the
          // push itself makes no noise.
          this.mode = 'go';
          this.hideT = 0;
          this.pushT = 2.5;
          this.pushSneakT = 2.5;
          this.setPath(findPath(level, pc, pr, obj.c, obj.r));
        } else if (!p.hidden) {
          // Not at a hiding spot yet: head for one on the cone-avoiding
          // route (the shortest route cuts through other guards' cones).
          const hide = nearestHiding(game, 340);
          this.setPath(hide ? (safePath(game, pc, pr, hide.c, hide.r) || findPath(level, pc, pr, hide.c, hide.r)) : null);
        } else {
          this.setPath(null); // stay put, hidden
        }
      } else {
        // mode 'go': find a safe route to the objective.
        const obj = this.objective();
        const path = safePath(game, pc, pr, obj.c, obj.r);
        if (path && !pathHasDanger(game, path)) {
          this.hideT = 0;
          this.setPath(path);
        } else if (path && this.hideT < 6 && this.pushT <= 0) {
          // No safe route: retreat to the nearest hiding spot and wait.
          this.mode = 'hide';
          this.hideT = 0;
          const hide = nearestHiding(game, 340);
          this.setPath(hide ? (safePath(game, pc, pr, hide.c, hide.r) || findPath(level, pc, pr, hide.c, hide.r)) : null);
        } else {
          // Waited already, or no route at all: shortest route, push through
          // quietly so the push itself makes no noise.
          this.pushT = Math.max(this.pushT, 2.5);
          this.pushSneakT = Math.max(this.pushSneakT, 2.5);
          this.setPath(findPath(level, pc, pr, obj.c, obj.r));
        }
      }
    }

    if (this.mode === 'hide') this.hideT += dt;

    // Follow the current path.
    let mx = 0;
    let my = 0;
    if (this.path && this.pathIdx < this.path.length) {
      while (this.pathIdx < this.path.length) {
        const node = this.path[this.pathIdx];
        if (dist(p.x, p.y, node.x, node.y) < 8) this.pathIdx++;
        else break;
      }
      if (this.pathIdx < this.path.length) {
        const node = this.path[this.pathIdx];
        const dx = node.x - p.x;
        const dy = node.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          mx = dx / d;
          my = dy / d;
        }
      }
    }

    // Run by default: speed is survival when crossing a cone. Sneak when
    // a guard is inside hearing range (145px) and the bot is out of every
    // cone — running that close is heard and pulls the guard over — and
    // sneak while pushing through after a wait, so the push makes no
    // noise. Never sneak while fleeing or standing inside a cone: run.
    let sneak = false;
    const inDanger = tileInDanger(game, pc, pr);
    if (this.mode === 'flee' || inDanger) {
      sneak = false;
    } else if (this.pushSneakT > 0) {
      sneak = true;
    } else {
      for (const g of game.guards) {
        if (dist(p.x, p.y, g.x, g.y) < 145) { sneak = true; break; }
      }
      if (!sneak && game.dog && dist(p.x, p.y, game.dog.x, game.dog.y) < 145) sneak = true;
    }
    return { mx, my, sneak };
  }
}
