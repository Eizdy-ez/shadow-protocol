// SHADOW PROTOCOL — the player: movement, sneaking, noise, hiding,
// distraction coins and interaction (E).
import { CONFIG } from './config.js';
import { isWallTile, tileAt } from './levels.js';

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    r: 13,
    dir: 0, // facing angle
    moving: false,
    sneaking: false,
    running: false,
    hidden: false, // inside a bush / shadow / closet
    inCloset: false,
    noiseT: 0,
    stepT: 0,
    coins: 3,
    coinFlight: null, // {x, y, tx, ty, t} while a coin is in the air
  };
}

// Circle-vs-wall collision with sliding, so the player never sticks.
// A proper circle-vs-tile test (closest point on the tile rectangle) is
// used instead of sampling points around the circle: sampling points
// reports a collision when the circle only grazes a wall corner, which
// wedged the player against corridor walls a few pixels off-centre.
function circleHitsWall(p, x, y, level) {
  const r = p.r;
  const T = CONFIG.TILE;
  const c0 = Math.floor((x - r) / T);
  const c1 = Math.floor((x + r) / T);
  const r0 = Math.floor((y - r) / T);
  const r1 = Math.floor((y + r) / T);
  for (let rr = r0; rr <= r1; rr++) {
    for (let cc = c0; cc <= c1; cc++) {
      if (!isWallTile(level, cc, rr)) continue;
      const closestX = Math.max(cc * T, Math.min(x, cc * T + T));
      const closestY = Math.max(rr * T, Math.min(y, rr * T + T));
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

function tryMove(p, nx, ny, level) {
  if (circleHitsWall(p, nx, ny, level)) return false;
  p.x = nx;
  p.y = ny;
  return true;
}

export function updatePlayer(p, input, dt, level, game) {
  if (p.inCloset) {
    p.moving = false;
    p.hidden = true;
    return;
  }

  let mx = 0;
  let my = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;

  p.sneaking = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = p.sneaking ? CONFIG.PLAYER_SNEAK : CONFIG.PLAYER_RUN;
  p.moving = mx !== 0 || my !== 0;
  p.running = p.moving && !p.sneaking;

  if (p.moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    p.dir = Math.atan2(my, mx);
    const step = speed * dt;
    // Move axis by axis so walls slide instead of blocking diagonally.
    if (!tryMove(p, p.x + mx * step, p.y, level)) {
      // blocked on x, still try y
    }
    tryMove(p, p.x, p.y + my * step, level);
  }

  // Hiding: shadows, bushes and tall grass hide the player automatically.
  const tile = tileAt(level, p.x, p.y);
  p.hidden = tile === 'S' || tile === 'B' || tile === 'G';

  // Running is loud: regular noise pulses guards can hear.
  if (p.running) {
    p.noiseT -= dt;
    if (p.noiseT <= 0) {
      p.noiseT = CONFIG.NOISE_PULSE_EVERY;
      game.events.push({ type: 'playerNoise', x: p.x, y: p.y, radius: CONFIG.NOISE_RUN_RADIUS });
    }
    p.stepT -= dt;
    if (p.stepT <= 0) {
      p.stepT = 0.32;
      game.events.push({ type: 'playerStep' });
    }
  }

  // A thrown coin flies to its target, then clinks and draws guards in.
  if (p.coinFlight) {
    const c = p.coinFlight;
    c.t += dt * 2.2;
    if (c.t >= 1) {
      p.coinFlight = null;
      game.events.push({ type: 'coinLanded', x: c.tx, y: c.ty, radius: CONFIG.NOISE_COIN_RADIUS });
    } else {
      c.x = c.sx + (c.tx - c.sx) * c.t;
      c.y = c.sy + (c.ty - c.sy) * c.t;
    }
  }
}

// The nearest thing E can do right now, or null.
export function interactable(p, level) {
  if (p.inCloset) return { kind: 'closetExit', label: 'Step out of the closet' };
  let best = null;
  let bestD = CONFIG.INTERACT_RADIUS;
  for (const item of level.items) {
    if (item.taken) continue;
    if (item.kind === 'vault' && !level.hasKeycard) continue;
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = {
        kind: item.kind,
        label:
          item.kind === 'keycard'
            ? 'Take the keycard'
            : item.kind === 'vault'
              ? 'Open the safe'
              : 'Take the ' + (item.id === '1' ? 'artifact' : item.id === '2' ? 'artifact' : 'document'),
        item,
      };
    }
  }
  if (!best) {
    const tile = tileAt(level, p.x, p.y);
    if (tile === 'C') return { kind: 'closet', label: 'Hide in the closet' };
    // Closet next to the player also counts.
    for (const key of level.closets) {
      const [c, r] = key.split(',').map(Number);
      const cx = c * CONFIG.TILE + CONFIG.TILE / 2;
      const cy = r * CONFIG.TILE + CONFIG.TILE / 2;
      if (Math.hypot(cx - p.x, cy - p.y) < CONFIG.INTERACT_RADIUS) {
        return { kind: 'closet', label: 'Hide in the closet' };
      }
    }
  }
  return best;
}

export function doInteract(p, level, game, what) {
  if (!what) return;
  if (what.kind === 'closet') {
    p.inCloset = true;
    p.hidden = true;
    game.events.push({ type: 'hide' });
    return;
  }
  if (what.kind === 'closetExit') {
    p.inCloset = false;
    p.hidden = false;
    game.events.push({ type: 'unhide' });
    return;
  }
  const item = what.item;
  if (!item) return;
  item.taken = true;
  if (item.kind === 'keycard') {
    level.hasKeycard = true;
    game.events.push({ type: 'pickup', label: 'Keycard acquired — the safe can be opened' });
  } else if (item.kind === 'vault') {
    level.vaultOpen = true;
    game.events.push({ type: 'pickup', label: 'Safe opened — the contents are yours' });
  } else {
    game.events.push({ type: 'pickup', label: 'Item secured' });
  }
}
