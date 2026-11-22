// SHADOW PROTOCOL — the game loop and state machine.
// Screens: title -> briefing -> play -> levelComplete -> (next) briefing
//          -> victory, or play -> failed -> retry.
// URL hooks for testing and screenshots (deterministic, no cheats in play):
//   ?shot=cover|alarm|hide|vault   stage a frozen scene for a screenshot
//   ?autoplay=1&level=0            the play-test bot plays the level

import { CONFIG } from './config.js';
import { LEVELS, parseLevel, tileAt } from './levels.js';
import { makeGuard, makeCamera, updateGuard, updateCamera, hearNoise } from './guards.js';
import { makePlayer, updatePlayer, interactable, doInteract } from './player.js';
import { createInput, pressed } from './input.js';
import { drawWorld, objectivesComplete } from './render.js';
import {
  drawHUD,
  drawTitle,
  drawBriefing,
  drawLevelComplete,
  drawVictory,
  drawFailed,
  drawPaused,
  formatTime,
} from './hud.js';
import { sfx, unlockAudio, toggleMute } from './audio.js';
import { stepAutopilot } from './autopilot.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Supersampled backing store: the game is drawn in 1280x800 logical
// pixels, but the canvas holds 2x the pixels and the compositor downsamples
// it, so every edge, line and letter renders sharp instead of blurry —
// including the 1280x800 screenshots. render() scales the context to match.
const SS = 2;
canvas.width = CONFIG.WIDTH * SS;
canvas.height = CONFIG.HEIGHT * SS;

const input = createInput(canvas);

const G = {
  screen: 'title',
  levelIndex: 0,
  level: null,
  guards: [],
  cameras: [],
  player: null,
  time: 0,
  levelTime: 0,
  totalTime: 0,
  score: 0,
  detections: 0,
  levelDetections: 0,
  alarm: 0,
  events: [],
  floaters: [],
  ripples: [],
  toast: '',
  toastT: 0,
  caughtFlash: 0,
  cameraSees: false,
  prompt: null,
  buttons: [],
  frozen: false,
  autoplay: false,
  autopilot: { t: 0, path: null, pathI: 0, targetKey: '', waitT: 0, coinThrown: false, pushT: 0, fleeing: false, fleeTarget: null, holdTile: null },
  lastLevelScore: null,
  shot: null,
};
// Exposed for the play-test script (read-only introspection, no cheats).
window.__game = G;

function loadLevel(i) {
  const def = LEVELS[i];
  const level = parseLevel(def);
  G.levelIndex = i;
  G.level = level;
  G.guards = level.guards.map((d) => makeGuard(d, 'guard'));
  if (level.dog) G.guards.push(makeGuard(level.dog, 'dog'));
  G.cameras = level.cameras.map((d) => makeCamera(d));
  G.player = makePlayer(level.playerStart);
  G.player.coins = def.coins;
  G.player.sonar = 2; // Sonar Pulse charges, refilled every level.
  G.sonar = null; // active pulse: {t, life} while the ring expands.
  G.alarm = 0;
  G.levelTime = 0;
  G.levelDetections = 0;
  G.events = [];
  G.floaters = [];
  G.ripples = [];
  G.toast = '';
  G.toastT = 0;
  G.caughtFlash = 0;
  G.autopilot = { t: 0, path: null, pathI: 0, targetKey: '', waitT: 0, coinThrown: false, pushT: 0, fleeing: false, fleeTarget: null, holdTile: null };
}

function throwCoin(tx, ty) {
  const p = G.player;
  if (!p || p.coins <= 0 || p.coinFlight) return;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const maxRange = 340;
  if (d > maxRange) {
    tx = p.x + (dx / d) * maxRange;
    ty = p.y + (dy / d) * maxRange;
  }
  // The coin must land somewhere a guard can actually walk to, or the
  // guard will stand at the wall forever trying to reach it.
  if (tileAt(G.level, tx, ty) === '#') {
    let found = null;
    for (let rad = 1; rad <= 4 && !found; rad++) {
      for (let dc = -rad; dc <= rad && !found; dc++) {
        for (let dr = -rad; dr <= rad && !found; dr++) {
          const nx = tx + dc * CONFIG.TILE;
          const ny = ty + dr * CONFIG.TILE;
          if (tileAt(G.level, nx, ny) !== '#') found = { x: nx, y: ny };
        }
      }
    }
    if (found) {
      tx = found.x;
      ty = found.y;
    }
  }
  p.coins--;
  p.coinFlight = { sx: p.x, sy: p.y, x: p.x, y: p.y, tx, ty, t: 0 };
  sfx.coinThrow();
}
G.throwCoin = throwCoin;

// --- Sonar Pulse (original mechanic) --------------------------------------
// Q spends one charge: a pulse expands from the player and, while it lasts,
// reveals where every guard is heading (their next waypoint, or the point
// they are investigating) through the walls. The trade-off: the pulse is
// audible — guards close to the player hear it and come to look.
function fireSonar() {
  const p = G.player;
  if (!p || p.sonar <= 0 || G.sonar) return;
  p.sonar--;
  G.sonar = { t: 0, life: 1.6 };
  sfx.sonar();
  hearNoise(G.guards, p.x, p.y, 150, G);
  toast('Sonar pulse — every patrol route revealed, but nearby guards heard it');
}
G.fireSonar = fireSonar;

function addFloater(x, y, text, color) {
  G.floaters.push({ x, y, text, color, t: 0, life: 1.6 });
}

function toast(text) {
  G.toast = text;
  G.toastT = 3;
}

function handleCaught(kind) {
  G.detections++;
  G.levelDetections++;
  G.alarm = Math.min(100, G.alarm + CONFIG.ALARM_CAUGHT);
  G.caughtFlash = 1.4;
  sfx.caught();
  if (kind === 'dog') sfx.bark();
  addFloater(G.player.x, G.player.y - 30, 'CAUGHT!', '#ff5d5d');
  if (G.alarm >= 100) {
    G.screen = 'failed';
    return;
  }
  // Restart from the level checkpoint (the start), guards reset to patrol.
  toast('Spotted! The alarm rises — back to the start.');
  G.player.x = G.level.playerStart.x;
  G.player.y = G.level.playerStart.y;
  G.player.inCloset = false;
  G.player.coinFlight = null;
  G.guards = G.level.guards.map((d) => makeGuard(d, 'guard'));
  if (G.level.dog) G.guards.push(makeGuard(G.level.dog, 'dog'));
}

function completeLevel() {
  const lv = G.level;
  const timeBonus = Math.max(0, Math.round(lv.par - G.levelTime)) * CONFIG.TIME_BONUS_PER_SEC;
  const coinBonus = G.player.coins * CONFIG.COIN_BONUS;
  const penalty = G.levelDetections * CONFIG.DETECTION_PENALTY;
  const levelScore = CONFIG.LEVEL_BASE_SCORE + timeBonus + coinBonus - penalty;
  G.score += levelScore;
  G.lastLevelScore = {
    score: levelScore,
    time: G.levelTime,
    detections: G.levelDetections,
    coins: G.player.coins,
  };
  sfx.success();
  G.screen = 'levelComplete';
}

function processEvents() {
  for (const e of G.events) {
    switch (e.type) {
      case 'playerNoise':
        // Running is audible — and now visible: a faint expanding ring.
        G.ripples.push({ x: e.x, y: e.y, r: 6, t: 0, life: 0.55, faint: true, maxR: 55 });
        hearNoise(G.guards, e.x, e.y, e.radius, G);
        break;
      case 'coinLanded':
        G.ripples.push({ x: e.x, y: e.y, r: 6, t: 0, life: 0.7 });
        hearNoise(G.guards, e.x, e.y, e.radius, G);
        sfx.coinLand();
        break;
      case 'caught':
        handleCaught(e.kind);
        break;
      case 'spotted':
        sfx.spotted();
        addFloater(e.x, e.y - 30, 'SPOTTED!', '#ff5d5d');
        break;
      case 'bark':
        sfx.bark();
        addFloater(e.x, e.y - 30, 'WOOF!', '#ffb347');
        break;
      case 'suspicious':
        sfx.suspicious();
        break;
      case 'guardStep':
        sfx.guardStep(e.dist);
        break;
      case 'playerStep':
        sfx.step(G.player.running);
        break;
      case 'cameraBeep':
        sfx.cameraBeep();
        break;
      case 'pickup':
        sfx.pickup();
        toast(e.label);
        break;
      case 'hide':
        sfx.hide();
        toast('Hidden — guards cannot see you here.');
        break;
      case 'unhide':
        sfx.click();
        break;
      case 'noiseHeard':
        break;
    }
  }
  G.events = [];
}

function updatePlay(dt) {
  const p = G.player;

  // Pause / mute
  if (pressed(input, 'KeyP') || pressed(input, 'Escape')) {
    G.screen = 'paused';
    return;
  }
  if (pressed(input, 'KeyM')) {
    const m = toggleMute();
    toast(m ? 'Sound muted' : 'Sound on');
  }

  // Autopilot drives the same input the player uses.
  if (G.autoplay) {
    input.keys.delete('KeyW');
    input.keys.delete('KeyA');
    input.keys.delete('KeyS');
    input.keys.delete('KeyD');
    input.keys.delete('ShiftLeft');
    stepAutopilot(G, dt, input);
  }

  // Interact
  if (pressed(input, 'KeyE')) {
    const what = interactable(p, G.level);
    if (what) doInteract(p, G.level, G, what);
  }

  // Sonar Pulse (Q)
  if (pressed(input, 'KeyQ')) fireSonar();

  // Throw a coin where the player clicked (not on the HUD bar).
  while (input.clicks.length) {
    const c = input.clicks.shift();
    if (c.y > 60) throwCoin(c.x, c.y);
  }

  updatePlayer(p, input, dt, G.level, G);
  G.cameraSees = false;
  for (const g of G.guards) updateGuard(g, dt, G.level, p, G);
  for (const cam of G.cameras) updateCamera(cam, dt, G.level, p, G);
  processEvents();

  // Alarm: climbs while chased or seen by a camera, slowly falls when calm.
  const anyAlerted = G.guards.some((g) => g.state === 'alerted');
  if (anyAlerted) G.alarm = Math.min(100, G.alarm + CONFIG.ALARM_ALERT_RATE * dt);
  if (G.cameraSees) G.alarm = Math.min(100, G.alarm + CONFIG.ALARM_CAMERA_RATE * dt);
  if (!anyAlerted && !G.cameraSees) G.alarm = Math.max(0, G.alarm - CONFIG.ALARM_DECAY * dt);
  if (G.alarm >= 100) {
    G.screen = 'failed';
    return;
  }

  // Prompt
  const what = interactable(p, G.level);
  const onGrass = tileAt(G.level, p.x, p.y) === 'G';
  G.prompt = what
    ? `Press E — ${what.label}`
    : onGrass
      ? 'Hidden in the tall grass — guards cannot see you'
      : p.hidden
        ? 'Hidden — hold still, let the patrol pass'
        : null;

  // Visibility status for the HUD — SEEN / HIDDEN / SHADOW / EXPOSED, so
  // the player reads at a glance whether they are safe right now.
  G.visibility = anyAlerted || G.cameraSees
    ? 'SEEN'
    : p.hidden
      ? 'HIDDEN'
      : tileAt(G.level, p.x, p.y) === 'S'
        ? 'SHADOW'
        : 'EXPOSED';

  // Timers and effects
  G.levelTime += dt;
  G.totalTime += dt;
  if (G.toastT > 0) G.toastT -= dt;
  if (G.caughtFlash > 0) G.caughtFlash -= dt;
  for (const f of G.floaters) f.t += dt;
  G.floaters = G.floaters.filter((f) => f.t < f.life);
  for (const r of G.ripples) {
    r.t += dt;
    r.r = 6 + (r.t / r.life) * (r.maxR || 90);
  }
  G.ripples = G.ripples.filter((r) => r.t < r.life);
  if (G.sonar) {
    G.sonar.t += dt;
    if (G.sonar.t >= G.sonar.life) G.sonar = null;
  }

  // Exit: only when the objectives are done.
  if (objectivesComplete(G)) {
    const d = Math.hypot(p.x - G.level.exit.x, p.y - G.level.exit.y);
    if (d < 34) completeLevel();
  }
}

function handleMenuClick() {
  while (input.clicks.length) {
    const c = input.clicks.shift();
    unlockAudio();
    for (const b of G.buttons) {
      if (c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h) {
        sfx.click();
        doAction(b.action);
        return;
      }
    }
  }
}

function doAction(action) {
  // A screen change eats any key pressed on the old screen, so a stale tap
  // (e.g. Q on the title) can never fire on the new one.
  input.pressedQueue.clear();
  if (action.startsWith('level:')) {
    loadLevel(Number(action.split(':')[1]));
    G.screen = 'briefing';
  } else if (action === 'begin') {
    G.screen = 'play';
  } else if (action === 'next') {
    loadLevel(G.levelIndex + 1);
    G.screen = 'briefing';
  } else if (action === 'victory') {
    G.screen = 'victory';
  } else if (action === 'restart') {
    G.score = 0;
    G.detections = 0;
    G.totalTime = 0;
    loadLevel(0);
    G.screen = 'title';
  } else if (action === 'retry') {
    loadLevel(G.levelIndex);
    G.screen = 'play';
  }
}

function updateMenu(dt) {
  if (G.screen === 'title') {
    // Attract mode: the museum patrols behind the menu.
    for (const g of G.guards) updateGuard(g, dt, G.level, { x: -9999, y: -9999, hidden: false, sneaking: false }, G);
    G.events = [];
    if (pressed(input, 'Digit1')) doAction('level:0');
    if (pressed(input, 'Digit2')) doAction('level:1');
    if (pressed(input, 'Digit3')) doAction('level:2');
    if (pressed(input, 'Digit4')) doAction('level:3');
    if (pressed(input, 'Digit5')) doAction('level:4');
    handleMenuClick();
  } else if (G.screen === 'briefing') {
    if (pressed(input, 'Enter') || pressed(input, 'Space')) doAction('begin');
    handleMenuClick();
  } else if (G.screen === 'levelComplete') {
    if (pressed(input, 'Enter')) doAction(G.levelIndex < 4 ? 'next' : 'victory');
    handleMenuClick();
    // Autopilot play-test: keep going into the next level by itself.
    if (G.autoplay) {
      G.autoplayT = (G.autoplayT || 0) + dt;
      if (G.autoplayT > 1) {
        G.autoplayT = 0;
        doAction(G.levelIndex < 4 ? 'next' : 'victory');
        if (G.screen === 'briefing') G.screen = 'play';
      }
    }
  } else if (G.screen === 'victory') {
    if (pressed(input, 'Enter')) doAction('restart');
    handleMenuClick();
  } else if (G.screen === 'failed') {
    if (pressed(input, 'KeyR') || pressed(input, 'Enter')) doAction('retry');
    handleMenuClick();
  } else if (G.screen === 'paused') {
    if (pressed(input, 'KeyP') || pressed(input, 'Escape')) G.screen = 'play';
    input.clicks.length = 0;
  }
}

function render() {
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  if (G.screen === 'title') {
    drawWorld(ctx, G);
    G.buttons = drawTitle(ctx, G, LEVELS);
  } else if (G.screen === 'briefing') {
    drawWorld(ctx, G);
    G.buttons = drawBriefing(ctx, G);
  } else if (G.screen === 'play' || G.screen === 'paused') {
    drawWorld(ctx, G);
    drawHUD(ctx, G);
    if (G.screen === 'paused') drawPaused(ctx);
    G.buttons = [];
  } else if (G.screen === 'levelComplete') {
    drawWorld(ctx, G);
    G.buttons = drawLevelComplete(ctx, G);
  } else if (G.screen === 'victory') {
    drawWorld(ctx, G);
    G.buttons = drawVictory(ctx, G);
  } else if (G.screen === 'failed') {
    drawWorld(ctx, G);
    G.buttons = drawFailed(ctx, G);
  }
}

// --- staged screenshots: frozen, deterministic scenes -------------------
function stageShot(name) {
  G.shot = name;
  G.frozen = true;
  G.time = 3.0; // fixed, so the bobbing and glow never move between runs
  if (name === 'cover') {
    loadLevel(0);
    G.player.x = 7 * CONFIG.TILE + 20;
    G.player.y = 2 * CONFIG.TILE + 20;
    G.player.hidden = true;
    const g0 = G.guards[0];
    g0.x = 6 * CONFIG.TILE + 20;
    g0.y = 4 * CONFIG.TILE + 20;
    g0.dir = Math.atan2(G.player.y - g0.y, G.player.x - g0.x);
    const g1 = G.guards[1];
    g1.x = 22 * CONFIG.TILE + 20;
    g1.y = 3 * CONFIG.TILE + 20;
    g1.dir = Math.PI * 0.75;
    // Sonar Pulse mid-flight: the ring is expanding from the player and the
    // guards' destinations are revealed — the game's original mechanic.
    G.sonar = { t: 0.55, life: 1.6 };
    G.player.sonar = 1;
    g0.target = { x: 9 * CONFIG.TILE + 20, y: 4 * CONFIG.TILE + 20 };
    G.screen = 'play';
  } else if (name === 'alarm') {
    loadLevel(1);
    G.player.x = 12 * CONFIG.TILE + 20;
    G.player.y = 5 * CONFIG.TILE + 20;
    const g0 = G.guards[0];
    g0.x = 10 * CONFIG.TILE + 20;
    g0.y = 5 * CONFIG.TILE + 20;
    g0.dir = 0;
    g0.state = 'alerted';
    g0.meter = 1;
    g0.lastSeen = { x: G.player.x, y: G.player.y };
    G.alarm = 55;
    G.score = 1240;
    G.levelTime = 74;
    // A distraction coin mid-flight past the guard, and the ring where the
    // last one landed: the coin is the mechanic that buys this escape.
    G.player.coins = 2;
    G.player.coinFlight = {
      sx: G.player.x, sy: G.player.y,
      x: 9 * CONFIG.TILE + 20, y: 5 * CONFIG.TILE + 20,
      tx: 7 * CONFIG.TILE + 20, ty: 5 * CONFIG.TILE + 20, t: 0.4,
    };
    G.ripples.push({ x: 7 * CONFIG.TILE + 20, y: 5 * CONFIG.TILE + 20, r: 40, t: 0.35, life: 0.7 });
    G.screen = 'play';
  } else if (name === 'hide') {
    loadLevel(0);
    // The player hides in the tall grass (patch at cols 10-12, rows 6-7)
    // while a guard walks the patrol line right beside it.
    G.player.x = 11 * CONFIG.TILE + 20;
    G.player.y = 7 * CONFIG.TILE + 20;
    G.player.hidden = true;
    const g0 = G.guards[0];
    g0.x = 9 * CONFIG.TILE + 20;
    g0.y = 7 * CONFIG.TILE + 20;
    g0.dir = Math.PI / 2;
    g0.nearPlayer = true;
    G.prompt = 'Hidden in the tall grass — guards cannot see you';
    G.screen = 'play';
  } else if (name === 'vault') {
    loadLevel(4);
    for (const item of G.level.items) item.taken = true;
    G.player.x = 27 * CONFIG.TILE + 20;
    G.player.y = 17 * CONFIG.TILE + 20;
    G.player.dir = Math.PI;
    G.score = 2450;
    G.levelTime = 187;
    G.detections = 1;
    G.levelDetections = 1;
    G.alarm = 12;
    G.toast = 'All jewels secured — reach the exit';
    G.toastT = 99;
    const g = G.guards[2];
    g.x = 8 * CONFIG.TILE + 20;
    g.y = 10 * CONFIG.TILE + 20;
    g.dir = Math.PI;
    G.screen = 'play';
  }
  render();
  window.__shotReady = true;
}

// --- boot ---------------------------------------------------------------
const params = new URLSearchParams(location.search);
loadLevel(0);
if (params.get('shot')) {
  stageShot(params.get('shot'));
} else if (params.get('autoplay') === '1') {
  G.autoplay = true;
  const lv = Number(params.get('level') || '0');
  loadLevel(lv);
  G.screen = 'play';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!G.frozen) {
    G.time += dt;
    if (G.screen === 'play') updatePlay(dt);
    else updateMenu(dt);
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
