// SHADOW PROTOCOL — the hand-in program (Node 22, standard library only).
// It copies this directory's game/ and screenshots/ to /output and writes
// /output/dossier.json, the summary the judge reads, using make.fun's own
// vendored library. Nothing is generated or changed: what you play locally
// is exactly what gets handed in.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string) {
  const src = join(here, name);
  if (!existsSync(src)) return;
  mkdirSync(join(out, name), { recursive: true });
  cpSync(src, join(out, name), { recursive: true });
}

mkdirSync(out, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
