// SHADOW PROTOCOL — the HUD and the full-screen text screens.
import { VIEW_W, VIEW_H } from './config.js';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function drawHUD(ctx, game) {
  const { level, player } = game;
  const pal = level.palette;
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,12,0.72)';
  ctx.fillRect(0, 0, VIEW_W, 38);
  ctx.fillStyle = pal.text;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`SHADOW PROTOCOL`, 12, 24);
  ctx.fillText(`Level ${game.levelIndex + 1}/5 — ${level.name}`, 220, 24);
  ctx.fillText(`◉ ${player.coins}`, 560, 24);
  ctx.fillText(`⌁ ${player.sonarCharges}`, 620, 24);
  ctx.fillText(`⏱ ${fmtTime(game.levelTime)}`, 680, 24);
  ctx.fillText(`Score ${game.score}`, 770, 24);
  ctx.fillText(`Spotted ×${game.detections}`, 900, 24);
  // Alarm bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(1010, 12, 130, 14);
  ctx.fillStyle = game.alarm >= 70 ? '#ff4030' : game.alarm >= 40 ? '#ffb347' : '#57d977';
  ctx.fillRect(1010, 12, 130 * Math.min(1, game.alarm / 100), 14);
  ctx.fillStyle = pal.text;
  ctx.fillText(`ALARM ${game.alarm}%`, 1150, 24);
  // Visibility status, right-aligned at the bottom of the strip is noisy;
  // put it as a chip under the strip instead.
  const statusColor =
    game.status === 'SEEN' ? '#ff5040'
    : game.status === 'HIDDEN' ? '#57d977'
    : game.status === 'SHADOW' ? '#9fb6d8'
    : '#ffb347';
  ctx.fillStyle = 'rgba(4,6,12,0.72)';
  ctx.fillRect(VIEW_W - 190, 44, 178, 26);
  ctx.fillStyle = statusColor;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(game.status, VIEW_W - 24, 62);
  ctx.restore();

  // Context prompt (for example "E — Hide" or the grass hint).
  if (game.message && game.messageT > 0) {
    ctx.save();
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.message).width + 28;
    ctx.fillStyle = 'rgba(4,6,12,0.78)';
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 52, w, 32);
    ctx.fillStyle = '#f2e3c8';
    ctx.fillText(game.message, VIEW_W / 2, VIEW_H - 30);
    ctx.restore();
  }
}

function panel(ctx, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,16,0.88)';
  ctx.fillRect(VIEW_W / 2 - 330, 190, 660, 340);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(VIEW_W / 2 - 330, 190, 660, 340);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 30px monospace';
  ctx.fillText(title, VIEW_W / 2, 245);
  ctx.fillStyle = '#e8e0cc';
  ctx.font = '17px monospace';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 295 + i * 30));
  ctx.restore();
}

export function drawBriefing(ctx, game) {
  panel(ctx, game.level.name, [
    game.level.sub,
    '',
    game.level.briefing,
    '',
    `${game.level.items.length} ${game.level.itemLabel}${game.level.items.length > 1 ? 's' : ''} to collect, then reach the EXIT.`,
    '',
    'Press ENTER to begin',
  ], '#ffb347');
}

export function drawLevelComplete(ctx, game) {
  panel(ctx, 'LEVEL CLEAR', [
    `${game.level.name} — unseen enough.`,
    '',
    `Time ${fmtTime(game.levelTime)}   ·   Score ${game.score}`,
    `Spotted ×${game.detections}   ·   Alarm ${game.alarm}%`,
    '',
    'Press ENTER for the next level',
  ], '#57d977');
}

export function drawFailed(ctx, game) {
  panel(ctx, 'MISSION FAILED', [
    'The alarm hit 100%. The whole building is awake.',
    '',
    `Score ${game.score}`,
    '',
    'Press ENTER to retry this level',
  ], '#ff5040');
}

export function drawComplete(ctx, game) {
  panel(ctx, 'MISSION COMPLETE', [
    'All five heists done. Every artefact, every exit — unseen.',
    '',
    `Final score ${game.score}   ·   Spotted ×${game.detections}`,
    '',
    'Press ENTER to play again',
  ], '#57d977');
}
