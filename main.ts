// SOLMAR BAY v2 — a visual-overhaul rebuild of the gta6-01 entry (Node 22,
// standard library only): the game is this directory's game/ folder, plain
// static files a desktop browser loads offline (game/index.html and its ES
// modules, Three.js r147 vendored under game/vendor/, no network request),
// and the program hands it in. It copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library. The v2 rebuild keeps the v1
// story (Dana Vega, Rosa's garage, five missions to $50,000 against the
// Dockside Kings, SBPD pursuit, BUSTED/WASTED, collectibles, synthesized
// audio) and rebuilds the art layer: proportioned humanoids from rounded
// primitives, multi-part vehicles, varied building archetypes, real prop
// geometry, and a golden-hour sunset grade — warm low sun, long shadows,
// layered skyline, fog and elevation — over the flat midday look v1 had.
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

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
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
