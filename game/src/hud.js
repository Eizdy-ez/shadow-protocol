// SHADOW PROTOCOL — the HUD bar and every menu screen (title, briefing,
// level complete, victory, mission failed, pause). Menus are drawn on the
// same canvas, so the screenshots show exactly what the player sees.
// drawMenu returns the clickable buttons it drew, as {x,y,w,h,action}.

import { CONFIG } from './config.js';
import { objectivesText } from './render.js';

const { WIDTH, HEIGHT } = CONFIG;

function button(ctx, x, y, w, h, label, accent) {
  ctx.fillStyle = accent ? '#2b6cb0' : 'rgba(255,255,255,0.10)';
  ctx.strokeStyle = accent ? '#63b3ed' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  return { x, y, w, h, action: label };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,11,20,0.88)';
  ctx.strokeStyle = 'rgba(140,170,255,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function title(ctx, text, y, size, color) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, WIDTH / 2, y);
}

function line(ctx, text, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, WIDTH / 2, y);
  ctx.globalAlpha = 1;
}

export function drawHUD(ctx, G) {
  const { level, player } = G;
  // Top bar
  ctx.fillStyle = 'rgba(5,8,16,0.82)';
  ctx.fillRect(0, 0, WIDTH, 56);
  ctx.fillStyle = 'rgba(140,170,255,0.25)';
  ctx.fillRect(0, 56, WIDTH, 1);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`${level.name}`, 16, 20);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#aebad6';
  ctx.fillText(objectivesText(G), 16, 42);

  // Alarm meter (centre)
  const ax = WIDTH / 2 - 110;
  ctx.fillStyle = '#20242e';
  roundRect(ctx, ax, 14, 220, 16, 8);
  ctx.fill();
  const alarmW = Math.max(0, Math.min(1, G.alarm / 100)) * 220;
  ctx.fillStyle = G.alarm > 66 ? '#ff3b3b' : G.alarm > 33 ? '#ff9a2a' : '#ffd640';
  if (alarmW > 0) {
    roundRect(ctx, ax, 14, alarmW, 16, 8);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, ax, 14, 220, 16, 8);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ALARM ${Math.round(G.alarm)}%`, WIDTH / 2, 42);

  // Visibility status: SEEN / HIDDEN / SHADOW / EXPOSED.
  const visColors = { SEEN: '#ff3b3b', HIDDEN: '#6ee1ff', SHADOW: '#7c8aa8', EXPOSED: '#ffb347' };
  ctx.fillStyle = visColors[G.visibility] || '#aebad6';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(G.visibility || '', WIDTH / 2, 60);

  // Right side: coins, sonar, time, score
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd640';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`◉ ${player.coins}`, WIDTH - 370, 20);
  ctx.fillStyle = '#6ee1ff';
  ctx.fillText(`⌁ ${player.sonar}`, WIDTH - 300, 20);
  ctx.fillStyle = '#fff';
  ctx.fillText(formatTime(G.levelTime), WIDTH - 210, 20);
  ctx.fillText(`SCORE ${G.score}`, WIDTH - 16, 20);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#aebad6';
  ctx.fillText(`Spotted ${G.detections}×`, WIDTH - 210, 42);
  ctx.fillText(`Level ${G.levelIndex + 1}/5`, WIDTH - 16, 42);

  // Context prompt at the bottom
  const what = G.prompt;
  if (what) {
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(what).width + 36;
    ctx.fillStyle = 'rgba(5,8,16,0.8)';
    roundRect(ctx, WIDTH / 2 - w / 2, HEIGHT - 44, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(what, WIDTH / 2, HEIGHT - 28);
  }

  // Toast message under the top bar
  if (G.toast && G.toastT > 0) {
    ctx.globalAlpha = Math.min(1, G.toastT);
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(G.toast, WIDTH / 2, 84);
    ctx.globalAlpha = 1;
  }

  // "SPOTTED!" flash
  if (G.caughtFlash > 0) {
    ctx.globalAlpha = Math.min(0.85, G.caughtFlash);
    ctx.fillStyle = '#a00';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    title(ctx, 'SPOTTED!', HEIGHT / 2 - 20, 64, '#fff');
    line(ctx, 'The alarm rises. Back to the start of the level.', HEIGHT / 2 + 40, 18, '#ffd9d9');
  }
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function drawTitle(ctx, G, levels) {
  ctx.fillStyle = 'rgba(4,6,14,0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  title(ctx, 'SHADOW PROTOCOL', 150, 72, '#e8ecff');
  line(ctx, 'Slip past the patrols. Take what matters. Leave unseen.', 205, 20, '#aebad6');
  line(ctx, 'A top-down stealth game in five levels', 232, 15, '#7c8aa8');

  const buttons = [];
  const cardW = 230;
  const gap = 12;
  const totalW = cardW * 5 + gap * 4;
  const x0 = (WIDTH - totalW) / 2;
  const y0 = 290;
  levels.forEach((lv, i) => {
    const x = x0 + i * (cardW + gap);
    panel(ctx, x, y0, cardW, 212);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(lv.sub.toUpperCase(), x + 16, y0 + 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(lv.name, x + 16, y0 + 62);
    ctx.fillStyle = '#aebad6';
    ctx.font = '13px sans-serif';
    const diff = ['3 guards · 1 camera', '5 guards · 2 cameras · watcher', '6 guards · 3 cameras · dog', '4 guards · 2 cameras · dog', '7 guards · 4 cameras · dog'][i];
    ctx.fillText(diff, x + 16, y0 + 92);
    // Objective, wrapped to the card width.
    const words = lv.objective.split(' ');
    let objLine = '';
    let oy = y0 + 116;
    ctx.font = '13px sans-serif';
    for (const w of words) {
      if (ctx.measureText(objLine + ' ' + w).width > cardW - 32 && objLine) {
        ctx.fillText(objLine.trim(), x + 16, oy);
        oy += 18;
        objLine = w;
      } else {
        objLine += ' ' + w;
      }
    }
    ctx.fillText(objLine.trim(), x + 16, oy);
    const b = button(ctx, x + 16, y0 + 160, cardW - 32, 36, `Play — press ${i + 1}`, true);
    b.action = `level:${i}`;
    buttons.push(b);
  });

  line(ctx, 'WASD / arrows — move      Shift — sneak (slow, silent, harder to spot)', 540, 16, '#cfd6e4');
  line(ctx, 'Click — throw a distraction coin      E — interact / hide      Q — sonar pulse (reveals patrol routes)      M — mute      P — pause', 566, 16, '#cfd6e4');
  line(ctx, 'Yellow cone: patrolling    Orange ?: suspicious    Red !: chasing — leave the cone before the meter fills', 592, 15, '#ff9a2a');
  line(ctx, 'Running is loud. Shadows, bushes and tall grass hide you — guards cannot see inside grass. Caught? Alarm +30, 100% ends the mission.', 618, 15, '#7c8aa8');
  line(ctx, 'Headphones on: guard footsteps tell you how close a patrol is.', 650, 14, '#7c8aa8');
  return buttons;
}

export function drawBriefing(ctx, G) {
  const lv = G.level;
  panel(ctx, WIDTH / 2 - 380, 180, 760, 340);
  title(ctx, lv.name, 240, 40, '#fff');
  line(ctx, lv.sub, 282, 17, '#ffd640');
  // Word-wrap the briefing
  ctx.font = '17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d5dcee';
  const words = lv.briefing.split(' ');
  let lineText = '';
  let y = 330;
  for (const w of words) {
    if (ctx.measureText(lineText + ' ' + w).width > 680) {
      ctx.fillText(lineText.trim(), WIDTH / 2, y);
      y += 26;
      lineText = w;
    } else {
      lineText += ' ' + w;
    }
  }
  ctx.fillText(lineText.trim(), WIDTH / 2, y);
  line(ctx, 'Objective: ' + lv.objective, y + 46, 16, '#ffe08a');
  const buttons = [button(ctx, WIDTH / 2 - 110, 440, 220, 44, 'Begin infiltration', true)];
  buttons[0].action = 'begin';
  return buttons;
}

export function drawLevelComplete(ctx, G) {
  ctx.fillStyle = 'rgba(4,6,14,0.7)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 320, 190, 640, 330);
  title(ctx, 'LEVEL CLEAR', 250, 44, '#39d98a');
  line(ctx, G.level.name, 300, 19, '#fff');
  const s = G.lastLevelScore;
  line(ctx, `Time  ${formatTime(s.time)}    Spotted  ${s.detections}×    Coins left  ${s.coins}`, 350, 17, '#cfd6e4');
  line(ctx, `Level score  ${s.score}`, 390, 22, '#ffd640');
  line(ctx, `Total score  ${G.score}`, 422, 17, '#aebad6');
  const buttons = [];
  if (G.levelIndex < 4) {
    const b = button(ctx, WIDTH / 2 - 130, 460, 260, 44, 'Next level', true);
    b.action = 'next';
    buttons.push(b);
  } else {
    const b = button(ctx, WIDTH / 2 - 130, 460, 260, 44, 'See the results', true);
    b.action = 'victory';
    buttons.push(b);
  }
  return buttons;
}

export function drawVictory(ctx, G) {
  ctx.fillStyle = 'rgba(4,6,14,0.78)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 340, 170, 680, 380);
  title(ctx, 'GHOST — NEVER SEEN', 235, 40, '#39d98a');
  line(ctx, 'All five infiltrations complete. The protocol holds.', 282, 17, '#cfd6e4');
  line(ctx, `Final score  ${G.score}`, 340, 30, '#ffd640');
  line(ctx, `Total time  ${formatTime(G.totalTime)}      Times spotted  ${G.detections}`, 392, 18, '#fff');
  const rank = G.detections === 0 ? 'Rank: TRUE GHOST — never spotted once.' : G.detections <= 3 ? 'Rank: SHADOW — barely a whisper.' : 'Rank: LOUD GHOST — the alarm knows your name.';
  line(ctx, rank, 430, 17, '#ffe08a');
  line(ctx, 'SHADOW PROTOCOL — thank you for playing.', 470, 15, '#7c8aa8');
  const buttons = [button(ctx, WIDTH / 2 - 110, 500, 220, 44, 'Play again', true)];
  buttons[0].action = 'restart';
  return buttons;
}

export function drawFailed(ctx, G) {
  ctx.fillStyle = 'rgba(20,4,6,0.78)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  panel(ctx, WIDTH / 2 - 320, 200, 640, 300);
  title(ctx, 'MISSION FAILED', 260, 44, '#ff5d5d');
  line(ctx, 'The alarm hit 100%. The facility is on full lockdown.', 312, 17, '#ffd9d9');
  line(ctx, 'Tip: sneak (Shift) near patrols, and spend a coin to pull a guard away.', 352, 15, '#aebad6');
  const buttons = [button(ctx, WIDTH / 2 - 110, 420, 220, 44, 'Retry level', true)];
  buttons[0].action = 'retry';
  return buttons;
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4,6,14,0.65)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  title(ctx, 'PAUSED', HEIGHT / 2 - 30, 48, '#fff');
  line(ctx, 'Press P or Esc to resume — M mutes the sound', HEIGHT / 2 + 30, 16, '#aebad6');
  return [];
}
