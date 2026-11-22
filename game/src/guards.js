// SHADOW PROTOCOL — guards, cameras and the guard dog.
// A guard has three states: patrol (waypoints), suspicious (investigates a
// noise, looks around, returns) and alerted (chases the player). A short
// grace period — the suspicion meter — gives the player a chance to break
// line of sight before the guard alerts. A guard that cannot reach its
// investigate point gives up after INVESTIGATE_GIVE_UP seconds.
import {
  TILE, CONE_RANGE, CONE_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE,
  DOG_RANGE, DOG_HALF_ANGLE, GUARD_PATROL_SPEED, GUARD_SUSPICIOUS_SPEED,
  GUARD_CHASE_SPEED, DOG_PATROL_SPEED, DOG_CHASE_SPEED, CAMERA_SWEEP_SPEED,
  SUSPICION_FILL_TIME, CAMERA_FILL_TIME, LOSE_SIGHT_TIME, INVESTIGATE_GIVE_UP,
  HIDDEN_SPOT_RADIUS, COIN_HEAR_RADIUS, RUN_HEAR_RADIUS,
  dist, angleDiff, clamp,
} from './config.js';
import { losBlocked, isWalkable } from './levels.js';

// Breadth-first search on the tile grid: returns a list of tile centres
// from (sc, sr) to (tc, tr), or null when unreachable.
export function findPath(level, sc, sr, tc, tr) {
  sc = clamp(sc, 0, 31);
  sr = clamp(sr, 0, 19);
  tc = clamp(tc, 0, 31);
  tr = clamp(tr, 0, 19);
  if (!isWalkable(level, tc, tr)) return null;
  if (sc === tc && sr === tr) return [{ x: tc * TILE + TILE / 2, y: tr * TILE + TILE / 2 }];
  const key = (c, r) => r * 32 + c;
  const prev = new Map();
  const seen = new Set([key(sc, sr)]);
  const queue = [[sc, sr]];
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isWalkable(level, nc, nr)) continue;
      const k = key(nc, nr);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [c, r]);
      if (nc === tc && nr === tr) {
        const path = [];
        let cur = [nc, nr];
        while (cur) {
          path.unshift({ x: cur[0] * TILE + TILE / 2, y: cur[1] * TILE + TILE / 2 });
          cur = prev.get(key(cur[0], cur[1]));
        }
        return path;
      }
      queue.push([nc, nr]);
    }
  }
  return null;
}

// True when a watcher at (ax, ay) facing `angle` can see target (tx, ty):
// inside the cone, line of sight clear, and the target not hidden — unless
// the watcher is at point-blank range.
export function canSee(level, ax, ay, angle, range, halfAngle, tx, ty, targetHidden) {
  const d = dist(ax, ay, tx, ty);
  if (d > range) return false;
  if (d > 4) {
    const a = Math.atan2(ty - ay, tx - ax);
    if (Math.abs(angleDiff(a, angle)) > halfAngle) return false;
  }
  if (losBlocked(level, ax, ay, tx, ty)) return false;
  if (targetHidden && d > HIDDEN_SPOT_RADIUS) return false;
  return true;
}

function moveToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
  e.dir = Math.atan2(dy, dx);
  return d - step < 3;
}

export class Guard {
  constructor(level, def) {
    this.path = def.path.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, c, r }));
    this.x = this.path[0].x;
    this.y = this.path[0].y;
    this.dir = 0;
    this.wp = 1 % this.path.length;
    this.pauseT = 0;
    this.state = 'patrol'; // patrol | suspicious | alerted
    this.suspicion = 0;
    this.investigate = null; // {x, y} point under investigation
    this.investigateT = 0;
    this.lookT = 0;
    this.lookDir = 0;
    this.loseT = 0;
    this.lastSeen = null;
    this.route = null; // BFS tile path currently being followed
    this.routeIdx = 0;
    this.alertT = 0;
  }

  waypointPos() {
    return this.path[this.wp];
  }

  // Hear a noise at (x, y) with the given radius: turn suspicious.
  hear(x, y, radius) {
    if (this.state === 'alerted') return;
    if (dist(this.x, this.y, x, y) > radius) return;
    this.becomeSuspicious(x, y);
  }

  becomeSuspicious(x, y) {
    if (this.state === 'alerted') return;
    this.state = 'suspicious';
    this.investigate = { x, y };
    this.investigateT = 0;
    this.route = null;
  }

  alert(x, y) {
    this.state = 'alerted';
    this.lastSeen = { x, y };
    this.loseT = 0;
    this.suspicion = 1;
    this.alertT = 0;
    this.route = null;
  }

  update(level, player, dt, events) {
    const sees = canSee(level, this.x, this.y, this.dir, CONE_RANGE, CONE_HALF_ANGLE,
      player.x, player.y, player.hidden);
    if (sees) {
      this.lastSeen = { x: player.x, y: player.y };
      this.loseT = 0;
      if (this.state !== 'alerted') {
        this.suspicion += dt / SUSPICION_FILL_TIME;
        if (this.suspicion >= 1) {
          this.alert(player.x, player.y);
          events.push({ type: 'spotted', x: this.x, y: this.y });
        }
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - dt * 0.8);
      if (this.state === 'alerted') this.loseT += dt;
    }

    if (this.state === 'patrol') {
      if (this.pauseT > 0) {
        this.pauseT -= dt;
        this.dir += dt * 0.6; // glance around while paused
        return;
      }
      const target = this.waypointPos();
      if (this.followRoute(level, target.x, target.y, GUARD_PATROL_SPEED, dt)) {
        this.wp = (this.wp + 1) % this.path.length;
        this.pauseT = 0.9;
        this.route = null;
      }
      return;
    }

    if (this.state === 'suspicious') {
      this.investigateT += dt;
      if (this.investigateT > INVESTIGATE_GIVE_UP) {
        // The noise point cannot be reached: give up and go back to patrol.
        this.state = 'patrol';
        this.investigate = null;
        this.route = null;
        return;
      }
      if (this.investigate) {
        const arrived = this.followRoute(level, this.investigate.x, this.investigate.y, GUARD_SUSPICIOUS_SPEED, dt);
        if (arrived) {
          this.lookT += dt;
          this.dir = this.lookDir + Math.sin(this.lookT * 2.2) * 1.2;
          if (this.lookT > 2.2) {
            this.state = 'patrol';
            this.investigate = null;
            this.lookT = 0;
            this.route = null;
          }
        } else {
          this.lookDir = this.dir;
        }
      }
      return;
    }

    // alerted: chase the player.
    this.alertT += dt;
    if (this.loseT > LOSE_SIGHT_TIME) {
      this.state = 'suspicious';
      this.investigate = this.lastSeen ? { ...this.lastSeen } : { x: this.x, y: this.y };
      this.investigateT = 0;
      this.route = null;
      return;
    }
    if (this.lastSeen) {
      this.followRoute(level, this.lastSeen.x, this.lastSeen.y, GUARD_CHASE_SPEED, dt);
    }
  }

  // Walk along a BFS route toward (tx, ty). Returns true on arrival.
  followRoute(level, tx, ty, speed, dt) {
    const tc = Math.floor(tx / TILE);
    const tr = Math.floor(ty / TILE);
    if (!this.route) {
      const sc = Math.floor(this.x / TILE);
      const sr = Math.floor(this.y / TILE);
      this.route = findPath(level, sc, sr, tc, tr);
      this.routeIdx = 0;
      if (!this.route) return false;
    }
    // Skip waypoints already reached.
    while (this.routeIdx < this.route.length) {
      const node = this.route[this.routeIdx];
      if (dist(this.x, this.y, node.x, node.y) < 6) this.routeIdx++;
      else break;
    }
    if (this.routeIdx >= this.route.length) {
      this.route = null;
      return true;
    }
    const node = this.route[this.routeIdx];
    return moveToward(this, node.x, node.y, speed, dt);
  }
}

export class Camera {
  constructor(def) {
    this.x = def.c * TILE + TILE / 2;
    this.y = def.r * TILE + TILE / 2;
    this.baseAngle = def.angle;
    this.sweep = def.sweep;
    this.t = 0;
    this.dir = def.angle;
    this.suspicion = 0;
    this.cooldown = 0;
  }

  update(level, player, dt, events) {
    this.t += dt;
    this.dir = this.baseAngle + Math.sin(this.t * CAMERA_SWEEP_SPEED) * this.sweep;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const sees = canSee(level, this.x, this.y, this.dir, CAMERA_RANGE, CAMERA_HALF_ANGLE,
      player.x, player.y, player.hidden);
    if (sees && this.cooldown <= 0) {
      this.suspicion += dt / CAMERA_FILL_TIME;
      if (this.suspicion >= 1) {
        this.suspicion = 0;
        this.cooldown = 5;
        events.push({ type: 'camera', x: player.x, y: player.y });
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - dt);
    }
  }
}

export class Dog {
  constructor(level, def) {
    this.path = def.path.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, c, r }));
    this.x = this.path[0].x;
    this.y = this.path[0].y;
    this.dir = 0;
    this.wp = 1 % this.path.length;
    this.pauseT = 0;
    this.state = 'patrol';
    this.barkT = 0;
    this.barkCooldown = 0;
    this.route = null;
    this.loseT = 0;
    this.lastSeen = null;
  }

  update(level, player, dt, events) {
    this.barkCooldown = Math.max(0, this.barkCooldown - dt);
    const sees = canSee(level, this.x, this.y, this.dir, DOG_RANGE, DOG_HALF_ANGLE,
      player.x, player.y, player.hidden);
    if (sees) {
      this.lastSeen = { x: player.x, y: player.y };
      this.loseT = 0;
      if (this.barkCooldown <= 0) {
        this.barkCooldown = 2.5;
        this.barkT = 0.9;
        events.push({ type: 'bark', x: this.x, y: this.y, px: player.x, py: player.y });
      }
      this.state = 'alerted';
    } else if (this.state === 'alerted') {
      this.loseT += dt;
      if (this.loseT > 2) this.state = 'patrol';
    }
    this.barkT = Math.max(0, this.barkT - dt);

    if (this.state === 'alerted' && this.lastSeen) {
      this.followRoute(level, this.lastSeen.x, this.lastSeen.y, DOG_CHASE_SPEED, dt);
      return;
    }
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      return;
    }
    const target = this.path[this.wp];
    const arrived = moveToward(this, target.x, target.y, DOG_PATROL_SPEED, dt);
    if (arrived) {
      this.wp = (this.wp + 1) % this.path.length;
      this.pauseT = 0.7;
    }
  }

  // Walk along a BFS route toward (tx, ty). Returns true on arrival.
  followRoute(level, tx, ty, speed, dt) {
    const tc = Math.floor(tx / TILE);
    const tr = Math.floor(ty / TILE);
    if (!this.route) {
      const sc = Math.floor(this.x / TILE);
      const sr = Math.floor(this.y / TILE);
      this.route = findPath(level, sc, sr, tc, tr);
      this.routeIdx = 0;
      if (!this.route) return false;
    }
    while (this.routeIdx < this.route.length) {
      const node = this.route[this.routeIdx];
      if (dist(this.x, this.y, node.x, node.y) < 6) this.routeIdx++;
      else break;
    }
    if (this.routeIdx >= this.route.length) {
      this.route = null;
      this.routeIdx = 0;
      return true;
    }
    const node = this.route[this.routeIdx];
    return moveToward(this, node.x, node.y, speed, dt);
  }
}

export { COIN_HEAR_RADIUS, RUN_HEAR_RADIUS };
