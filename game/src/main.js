// SHADOW PROTOCOL — the game itself: state machine, main loop, scoring,
// shot staging for screenshots, autoplay wiring, and the window.__game
// handle the play-test harness reads.
import { VIEW_W, VIEW_H, TILE, COIN_HEAR_RADIUS, RUN_HEAR_RADIUS, CAUGHT_ALARM, CAMERA_ALARM, ALARM_MAX, CATCH_DISTANCE, ITEM_PICKUP_DISTANCE, DOG_BARK_ALERT_RADIUS, clamp, dist } from './config.js';
import { LEVELS, parseLevel, isClosetTile, isHidingTile, tileAtPx } from './levels.js';
import { Input } from './input.js';
import { createPlayer, movePlayer, updatePlayerHiding, throwCoin, fireSonar, toggleCloset, sonarHeardRadius } from './player.js';
import { Guard, Camera, Dog } from './guards.js';
import { SoundFX } from './audio.js';
import { renderWorld, renderTitle } from './render.js';
import { drawHUD, drawBriefing, drawLevelComplete, drawFailed, drawComplete } from './hud.js';
import { Autopilot } from './autopilot.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.input = new Input(canvas);
    this.sfx = new SoundFX();
    this.screen = 'title'; // title | briefing | playing | levelComplete | failed | complete
    this.levelIndex = Number(params.get('level') || '0') || 0;
    this.levelIndex = clamp(this.levelIndex, 0, LEVELS.length - 1);
    this.autoplay = params.get('autoplay') === '1';
    this.shot = params.get('shot') || null;
    this.score = 0;
    this.detections = 0;
    this.alarm = 0;
    this.levelTime = 0;
    this.totalTime = 0;
    this.status = 'EXPOSED';
    this.message = '';
    this.messageT = 0;
    this.floatingTexts = [];
    this.coins = []; // thrown coins in flight / on the floor
    this.t = 0;
    this.bot = null;
    this.shotStaged = false;
    this.loadLevel(this.levelIndex);
    if (this.autoplay) {
      this.screen = 'playing';
      this.bot = new Autopilot(this);
    }
    window.__game = this;
    window.__shotReady = false;
    if (this.shot) this.stageShot();
  }

  loadLevel(idx) {
    this.levelIndex = idx;
    this.level = parseLevel(LEVELS[idx]);
    this.player = createPlayer(this.level);
    this.guards = this.level.guards.map((g) => new Guard(this.level, g));
    this.cameras = this.level.cameras.map((c) => new Camera(c));
    this.dog = this.level.dog ? new Dog(this.level, this.level.dog) : null;
    this.coins = [];
    this.floatingTexts = [];
    this.levelTime = 0;
    this.message = '';
    this.messageT = 0;
    this.bot = this.autoplay ? new Autopilot(this) : this.bot;
  }

  showMessage(text, seconds = 2.5) {
    this.message = text;
    this.messageT = seconds;
  }

  addFloat(text, x, y, color = '#fff') {
    this.floatingTexts.push({ text, x, y, a: 1, color });
  }

  // ---- Shot staging: deterministic scenes for the 4 screenshots ----------
  stageShot() {
    const shot = this.shot;
    if (shot === 'cover') {
      this.loadLevel(0);
      this.screen = 'playing';
      this.player.x = 560;
      this.player.y = 340;
      this.player.dir = 0.4;
      fireSonar(this.player);
      this.coins.push({ x: 700, y: 300, t: 0.25, landed: false, sx: 560, sy: 340 });
      this.settle(50);
    } else if (shot === 'alarm') {
      this.loadLevel(1);
      this.screen = 'playing';
      this.player.x = 640;
      this.player.y = 200;
      this.player.dir = Math.PI;
      this.alarm = 30;
      this.detections = 1;
      const g = this.guards[1];
      g.x = 640;
      g.y = 320;
      g.dir = -Math.PI / 2;
      g.alert(this.player.x, this.player.y);
      this.settle(30);
    } else if (shot === 'hide') {
      this.loadLevel(3);
      this.screen = 'playing';
      // Player in the tall grass at the centre of the garden.
      this.player.x = 420;
      this.player.y = 340;
      this.player.dir = 0;
      updatePlayerHiding(this.level, this.player);
      const g = this.guards[0];
      g.x = 480;
      g.y = 300;
      g.dir = Math.PI;
      this.showMessage('Hidden in the tall grass — guards cannot see you', 999);
      this.settle(40);
    } else if (shot === 'vault') {
      this.loadLevel(4);
      this.screen = 'playing';
      this.player.x = 480;
      this.player.y = 120;
      this.player.dir = Math.PI / 2;
      this.level.items[0].taken = true;
      this.score = 500;
      this.settle(50);
    }
    this.shotStaged = true;
    window.__shotReady = true;
  }

  // Run the simulation forward a fixed number of steps so guards are
  // mid-patrol and the scene looks alive, deterministically.
  settle(steps) {
    for (let i = 0; i < steps; i++) this.updateWorld(1 / 60, true);
  }

  // ---- Events from guards/cameras/dog ------------------------------------
  handleEvents(events) {
    for (const e of events) {
      if (e.type === 'spotted') {
        this.sfx.alert();
        this.addFloat('SPOTTED!', e.x, e.y - 34, '#ff5040');
      } else if (e.type === 'bark') {
        this.sfx.bark();
        this.addFloat('WOOF!', e.x, e.y - 30, '#ffd76e');
        for (const g of this.guards) {
          if (dist(g.x, g.y, e.px, e.py) < DOG_BARK_ALERT_RADIUS) g.becomeSuspicious(e.px, e.py);
        }
      } else if (e.type === 'camera') {
        this.alarm = Math.min(ALARM_MAX, this.alarm + CAMERA_ALARM);
        this.addFloat(`CAMERA! +${CAMERA_ALARM} alarm`, e.x, e.y - 30, '#ff9a5a');
        let nearest = null;
        let nearestD = Infinity;
        for (const g of this.guards) {
          const d = dist(g.x, g.y, e.x, e.y);
          if (d < nearestD) {
            nearestD = d;
            nearest = g;
          }
        }
        if (nearest) nearest.becomeSuspicious(e.x, e.y);
        if (this.alarm >= ALARM_MAX) this.failMission();
      }
    }
  }

  failMission() {
    this.screen = 'failed';
    this.sfx.caught();
    this.input.clearQueue();
  }

  caught() {
    this.detections += 1;
    this.alarm = Math.min(ALARM_MAX, this.alarm + CAUGHT_ALARM);
    this.sfx.caught();
    this.addFloat(`CAUGHT! +${CAUGHT_ALARM} alarm`, this.player.x, this.player.y - 30, '#ff5040');
    if (this.alarm >= ALARM_MAX) {
      this.failMission();
      return;
    }
    this.showMessage('Caught! Back to the start of the level.', 2.5);
    this.loadLevel(this.levelIndex);
  }

  // ---- Per-frame world update (playing only) ------------------------------
  updateWorld(dt, staging = false) {
    const p = this.player;
    const level = this.level;
    this.levelTime += dt;
    this.totalTime += dt;
    if (p.sonarT > 0) p.sonarT = Math.max(0, p.sonarT - dt);
    if (this.messageT > 0) this.messageT -= dt;
    for (const ft of this.floatingTexts) {
      ft.y -= 22 * dt;
      ft.a -= 0.7 * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.a > 0);

    // --- Player input ------------------------------------------------------
    let mx = 0;
    let my = 0;
    let sneak = false;
    if (this.autoplay && this.bot && !staging) {
      const cmd = this.bot.update(dt);
      mx = cmd.mx;
      my = cmd.my;
      sneak = cmd.sneak;
    } else if (!staging) {
      const v = this.input.moveVector();
      mx = v.x;
      my = v.y;
      sneak = this.input.down('ShiftLeft', 'ShiftRight');
    }
    const moved = movePlayer(level, p, mx, my, dt, sneak);
    if (moved && !staging) {
      p.stepT -= dt * (sneak ? 1 : 1.9);
      if (p.stepT <= 0) {
        p.stepT = 0.42;
        this.sfx.step(sneak);
        if (!sneak) {
          // Running is heard by nearby guards.
          for (const g of this.guards) g.hear(p.x, p.y, RUN_HEAR_RADIUS);
          if (this.dog) this.dogHear(p.x, p.y, RUN_HEAR_RADIUS);
        }
      }
    }
    updatePlayerHiding(level, p);
    if (p.inCloset) {
      // Inside a closet the player cannot move.
      p.moving = false;
    }

    if (!staging) {
      // E: hide in / leave a closet.
      if (this.input.pressed('KeyE')) {
        if (toggleCloset(level, p)) {
          this.sfx.click();
          this.showMessage(p.inCloset ? 'Hidden in the closet — press E to slip out' : 'You slip out of the closet', 2);
        }
      }
      // Q: sonar pulse.
      if (this.input.pressed('KeyQ')) {
        if (fireSonar(p)) {
          this.sfx.sonar();
          for (const g of this.guards) g.hear(p.x, p.y, sonarHeardRadius());
          if (this.dog) this.dogHear(p.x, p.y, sonarHeardRadius());
          this.showMessage('Sonar pulse — guard routes revealed, but they heard it', 2.5);
        } else {
          this.showMessage('No sonar charges left', 1.5);
        }
      }
      // Click: throw a distraction coin.
      const click = this.input.consumeClick();
      if (click) {
        const coin = throwCoin(level, p, click.x, click.y);
        if (coin) {
          this.coins.push(coin);
          this.sfx.coin();
        } else {
          this.showMessage('Out of coins', 1.2);
        }
      }
    }

    // Thrown coins fly, land, and draw guards in.
    for (const coin of this.coins) {
      if (!coin.landed) {
        coin.t += dt * 2.2;
        if (coin.t >= 1) {
          coin.landed = true;
          coin.t = 1;
          this.sfx.coinLand();
          for (const g of this.guards) g.hear(coin.x, coin.y, COIN_HEAR_RADIUS);
          if (this.dog) this.dogHear(coin.x, coin.y, COIN_HEAR_RADIUS);
        }
      }
    }

    // --- Guards, cameras, dog ----------------------------------------------
    const events = [];
    for (const g of this.guards) g.update(level, p, dt, events);
    for (const cam of this.cameras) cam.update(level, p, dt, events);
    if (this.dog) this.dog.update(level, p, dt, events);
    if (!staging) this.handleEvents(events);

    // --- Caught? -------------------------------------------------------------
    if (!staging) {
      for (const g of this.guards) {
        if (g.state === 'alerted' && dist(g.x, g.y, p.x, p.y) < CATCH_DISTANCE) {
          this.caught();
          return;
        }
      }
      if (this.dog && this.dog.state === 'alerted' && dist(this.dog.x, this.dog.y, p.x, p.y) < CATCH_DISTANCE) {
        this.caught();
        return;
      }
    }

    // --- Items and exit ---------------------------------------------------------
    for (const item of level.items) {
      if (!item.taken && dist(p.x, p.y, item.x, item.y) < ITEM_PICKUP_DISTANCE) {
        item.taken = true;
        this.score += 500;
        this.sfx.pickup();
        this.addFloat(`+500  ${level.itemLabel}`, item.x, item.y - 24, '#ffd76e');
      }
    }
    const allTaken = level.items.every((it) => it.taken);
    const exit = level.exit;
    if (Math.floor(p.x / TILE) === exit.c && Math.floor(p.y / TILE) === exit.r) {
      if (allTaken) {
        const bonus = 300 + Math.max(0, 300 - Math.floor(this.levelTime * 2));
        this.score += bonus;
        this.sfx.complete();
        this.screen = 'levelComplete';
        this.input.clearQueue();
        return;
      }
      if (!staging) this.showMessage(`Collect all ${level.items.length} ${level.itemLabel.toLowerCase()}s first`, 1.2);
    }

    // --- Visibility status --------------------------------------------------------
    this.updateStatus();
  }

  dogHear(x, y, radius) {
    if (!this.dog) return;
    if (dist(this.dog.x, this.dog.y, x, y) > radius) return;
    this.dog.state = 'alerted';
    this.dog.lastSeen = { x, y };
    this.dog.loseT = 0;
  }

  updateStatus() {
    const p = this.player;
    let seen = false;
    for (const g of this.guards) {
      if (g.state === 'alerted' && g.loseT < 1) { seen = true; break; }
    }
    if (this.dog && this.dog.state === 'alerted') seen = true;
    // Also seen when any guard's suspicion is nearly full.
    if (!seen) {
      for (const g of this.guards) {
        if (g.suspicion > 0.85) { seen = true; break; }
      }
    }
    if (seen) this.status = 'SEEN';
    else if (p.hidden) this.status = 'HIDDEN';
    else {
      // In lamplight or in the dark?
      let lit = false;
      for (const lamp of this.level.lamps) {
        if (dist(p.x, p.y, lamp.x, lamp.y) < 110) { lit = true; break; }
      }
      this.status = lit ? 'EXPOSED' : 'SHADOW';
    }
  }

  // ---- Frame ----------------------------------------------------------------
  frame(now) {
    const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000 || 0.016);
    this.lastNow = now;
    this.t += dt;
    this.sfx.ensure();

    if (this.screen === 'title') {
      if (this.input.pressed('Enter', 'NumpadEnter')) {
        this.screen = 'briefing';
        this.input.clearQueue();
        this.sfx.click();
      } else {
        for (let i = 0; i < 5; i++) {
          if (this.input.pressed('Digit' + (i + 1), 'Numpad' + (i + 1))) {
            this.loadLevel(i);
            this.screen = 'briefing';
            this.input.clearQueue();
            this.sfx.click();
            break;
          }
        }
      }
    } else if (this.screen === 'briefing') {
      if (this.input.pressed('Enter', 'NumpadEnter')) {
        this.screen = 'playing';
        this.input.clearQueue();
        this.sfx.click();
      }
    } else if (this.screen === 'playing') {
      this.updateWorld(dt);
    } else if (this.screen === 'levelComplete') {
      if (this.input.pressed('Enter', 'NumpadEnter')) {
        this.input.clearQueue();
        if (this.levelIndex + 1 < LEVELS.length) {
          this.loadLevel(this.levelIndex + 1);
          this.screen = 'briefing';
        } else {
          this.screen = 'complete';
        }
      }
    } else if (this.screen === 'failed') {
      if (this.input.pressed('Enter', 'NumpadEnter')) {
        this.input.clearQueue();
        this.loadLevel(this.levelIndex);
        this.screen = 'briefing';
      }
    } else if (this.screen === 'complete') {
      if (this.input.pressed('Enter', 'NumpadEnter')) {
        this.input.clearQueue();
        this.score = 0;
        this.detections = 0;
        this.alarm = 0;
        this.loadLevel(0);
        this.screen = 'title';
      }
    }

    // ---- Draw -----------------------------------------------------------------
    if (this.screen === 'title') {
      renderTitle(ctx, this.t);
    } else {
      renderWorld(ctx, this, this.t);
      if (this.screen === 'playing' || this.screen === 'levelComplete' || this.screen === 'failed') {
        drawHUD(ctx, this);
      }
      if (this.screen === 'briefing') drawBriefing(ctx, this);
      else if (this.screen === 'levelComplete') drawLevelComplete(ctx, this);
      else if (this.screen === 'failed') drawFailed(ctx, this);
      else if (this.screen === 'complete') drawComplete(ctx, this);
    }

    requestAnimationFrame((n) => this.frame(n));
  }
}

const game = new Game();
requestAnimationFrame((n) => game.frame(n));
