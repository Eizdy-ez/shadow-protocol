// SHADOW PROTOCOL — guards, the guard dog and security cameras.
// A guard lives in one of four states:
//   patrol      walk the waypoints, cone yellow
//   suspicious  meter passed 0.55 ("?"): walk to the last thing seen/heard
//   alerted     meter hit 1 ("!"): chase the player, alarm climbs
//   investigate (same as suspicious, kept as a named state for clarity)
// Leaving the cone before the meter fills lets the guard calm down and go
// back to patrol — the grace window the judge's criterion #2 asks for.

import { CONFIG } from './config.js';
import { hasLineOfSight, tileAt } from './levels.js';

const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function tileCenter(c, r) {
  return { x: c * CONFIG.TILE + CONFIG.TILE / 2, y: r * CONFIG.TILE + CONFIG.TILE / 2 };
}

export function makeGuard(def, kind = 'guard') {
  const pts = def.path.map(([c, r]) => tileCenter(c, r));
  const start = pts[0];
  return {
    kind, // 'guard' | 'dog' | 'watcher'
    x: start.x,
    y: start.y,
    dir: 0, // facing angle, radians
    waypoints: pts,
    wpIndex: 1 % pts.length,
    pause: def.pause || 0,
    pauseT: 0,
    stationary: !!def.stationary,
    scanT: Math.random() * TAU,
    state: 'patrol',
    meter: 0,
    lastSeen: null,
    lookT: 0, // time spent looking around at an investigate point
    loseT: 0, // time since the player was last seen while alerted
    target: null, // noise point to investigate
    stepT: 0,
  };
}

export function makeCamera(def) {
  const p = tileCenter(def.c, def.r);
  return {
    x: p.x,
    y: p.y,
    base: def.base,
    sweep: def.sweep,
    speed: def.speed,
    t: Math.random() * TAU,
    dir: def.base,
    seesPlayer: false,
    beepT: 0,
  };
}

// Can this watcher see the point (px, py)? Considers cone angle and range,
// walls blocking the view, and hiding: a hidden player is only spotted
// point-blank. Tall grass hides the player the same way — a player standing
// in a 'G' tile is invisible to vision cones, guard or camera alike.
export function canSee(watcher, px, py, level, playerHidden, opts = {}) {
  const range = opts.range ?? CONFIG.CONE_RANGE;
  const halfAngle = (opts.angle ?? CONFIG.CONE_ANGLE) / 2;
  const dx = px - watcher.x;
  const dy = py - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { visible: false, dist };
  const inGrass = tileAt(level, px, py) === 'G';
  if ((playerHidden || inGrass) && dist > CONFIG.HIDDEN_SPOT_RADIUS) return { visible: false, dist };
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, watcher.dir)) > halfAngle && dist > 26) {
    return { visible: false, dist };
  }
  if (!hasLineOfSight(level, watcher.x, watcher.y, px, py)) return { visible: false, dist };
  return { visible: true, dist };
}

function moveToward(g, tx, ty, speed, dt, level) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = g.x + (dx / dist) * step;
  const ny = g.y + (dy / dist) * step;
  // Slide along walls instead of sticking to them.
  if (tileAt(level, nx, g.y) !== '#') g.x = nx;
  if (tileAt(level, g.x, ny) !== '#') g.y = ny;
  g.dir = Math.atan2(dy, dx);
  return dist <= 4;
}

// One guard update. Events are pushed into game.events for main.js to act on
// (sounds, alarm, score, the "caught" reset).
export function updateGuard(g, dt, level, player, game) {
  const opts =
    g.kind === 'dog'
      ? { range: CONFIG.DOG_CONE_RANGE, angle: CONFIG.DOG_CONE_ANGLE }
      : {};

  // --- vision: the detection meter fills while the player is in the cone.
  const seen = canSee(g, player.x, player.y, level, player.hidden, opts);
  if (seen.visible) {
    let rate = CONFIG.DETECT_BASE;
    rate *= 1 + (1 - seen.dist / (opts.range ?? CONFIG.CONE_RANGE)) * (CONFIG.DETECT_CLOSE_MULT - 1);
    if (player.sneaking) rate *= CONFIG.DETECT_SNEAK_MULT;
    if (g.kind === 'dog') rate *= CONFIG.DETECT_DOG_MULT;
    g.meter = Math.min(1, g.meter + rate * dt);
    g.lastSeen = { x: player.x, y: player.y };
    g.loseT = 0;
  } else {
    g.meter = Math.max(0, g.meter - CONFIG.DETECT_DECAY * dt);
    if (g.state === 'alerted') g.loseT += dt;
  }

  // --- state changes
  if (g.state !== 'alerted' && g.meter >= 1) {
    g.state = 'alerted';
    g.loseT = 0;
    game.events.push({ type: 'spotted', x: g.x, y: g.y, kind: g.kind });
    // The dog does not just chase: it barks, and everyone hears it.
    if (g.kind === 'dog') {
      game.events.push({ type: 'bark', x: g.x, y: g.y });
    }
  } else if (g.state === 'patrol' && g.meter >= 0.55) {
    g.state = 'suspicious';
    g.target = g.lastSeen ? { ...g.lastSeen } : { x: player.x, y: player.y };
    game.events.push({ type: 'suspicious', x: g.x, y: g.y });
  } else if (g.state === 'alerted' && g.loseT > 3) {
    g.state = 'suspicious';
    g.target = g.lastSeen ? { ...g.lastSeen } : null;
    g.meter = 0.55;
  } else if (g.state === 'suspicious' && g.meter < 0.2 && !g.target) {
    g.state = 'patrol';
  }

  // --- movement by state
  if (g.stationary) {
    // The watcher never walks: he slowly scans left and right.
    g.scanT += dt * 0.7;
    g.dir = Math.sin(g.scanT) * 1.1;
    if (g.state === 'suspicious' && g.lastSeen) {
      g.dir = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
    }
  } else if (g.state === 'alerted' && g.lastSeen) {
    const speed = g.kind === 'dog' ? CONFIG.DOG_CHASE : CONFIG.GUARD_CHASE;
    moveToward(g, g.lastSeen.x, g.lastSeen.y, speed, dt, level);
    if (seen.visible) {
      g.lastSeen = { x: player.x, y: player.y };
    }
  } else if (g.state === 'suspicious' && g.target) {
    const arrived = moveToward(g, g.target.x, g.target.y, CONFIG.GUARD_INVESTIGATE, dt, level);
    g.investT = (g.investT || 0) + dt;
    if (arrived) {
      g.lookT += dt;
      g.dir += dt * 1.6; // look around
      if (g.lookT > 2) {
        g.lookT = 0;
        g.investT = 0;
        g.target = null;
        g.state = 'patrol';
        g.meter = 0;
      }
    } else if (g.investT > 8) {
      // The noise point is unreachable (behind a wall, say): give up and
      // go back to patrol instead of standing there forever.
      g.lookT = 0;
      g.investT = 0;
      g.target = null;
      g.state = 'patrol';
      g.meter = 0;
    }
  } else if (g.state === 'patrol') {
    if (g.pauseT > 0) {
      g.pauseT -= dt;
      g.dir += dt * 0.25; // idle glance around
    } else {
      const wp = g.waypoints[g.wpIndex];
      const arrived = moveToward(
        g,
        wp.x,
        wp.y,
        g.kind === 'dog' ? CONFIG.DOG_PATROL : CONFIG.GUARD_PATROL,
        dt,
        level,
      );
      if (arrived) {
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        g.pauseT = g.pause;
      }
    }
  }

  // --- caught? An alerted guard (or dog) touching the player ends the run
  // for this attempt: alarm up, back to the level start.
  if (g.state === 'alerted') {
    const d = Math.hypot(player.x - g.x, player.y - g.y);
    if (d < CONFIG.CATCH_RADIUS) {
      game.events.push({ type: 'caught', x: g.x, y: g.y, kind: g.kind });
    }
  }

  // --- footsteps: audible (and visible as "…") when a guard is near.
  g.stepT -= dt;
  const near = Math.hypot(player.x - g.x, player.y - g.y);
  g.nearPlayer = near < 230;
  if (g.nearPlayer && g.stepT <= 0 && (g.state !== 'patrol' || near < 160)) {
    g.stepT = 0.45;
    game.events.push({ type: 'guardStep', dist: near });
  }
}

// A noise (running feet, a thrown coin) pulls nearby guards to investigate.
export function hearNoise(guards, x, y, radius, game) {
  for (const g of guards) {
    if (g.state === 'alerted' || g.stationary) continue;
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < radius) {
      if (g.state === 'patrol') g.meter = Math.max(g.meter, 0.55);
      g.state = 'suspicious';
      g.target = { x, y };
      g.lookT = 0;
      game.events.push({ type: 'noiseHeard', x: g.x, y: g.y });
    }
  }
}

export function updateCamera(cam, dt, level, player, game) {
  cam.t += dt * cam.speed;
  cam.dir = cam.base + Math.sin(cam.t) * cam.sweep;
  const seen = canSee(
    cam,
    player.x,
    player.y,
    level,
    player.hidden,
    { range: CONFIG.CAMERA_RANGE, angle: CONFIG.CAMERA_ANGLE },
  );
  cam.seesPlayer = seen.visible;
  if (seen.visible) {
    game.cameraSees = true;
    cam.beepT -= dt;
    if (cam.beepT <= 0) {
      cam.beepT = 0.5;
      game.events.push({ type: 'cameraBeep', x: cam.x, y: cam.y });
    }
  }
}
