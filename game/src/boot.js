// Bootstrap: build the game, wire the menus, run the loop.
// One job: start everything — the start screen's buttons, the pause menu,
// the fixed-step game loop, and the ?shot= staging mode that freezes one
// frame of real play for the screenshots.

import { DEFAULT_SEED, INTRO, SUBTITLE, TITLE } from './settings.js';
import { seedFromQuery } from './rng.js';
import { Game } from './engine.js';
import { stageShot } from './staging.js';
import { hasSave } from './persistence.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const seed = seedFromQuery(DEFAULT_SEED);
const shotName = params.get('shot');

// The 3D engine must be present: without it there is no game to play.
if (!window.THREE) {
  document.getElementById('fatal').textContent =
    'Three.js did not load — the game cannot start. Check game/vendor/three.min.js.';
  document.getElementById('fatal').classList.add('show');
  throw new Error('THREE is not defined');
}

const game = new Game(canvas, seed);
window.__solmarWorld = game; // the play-test harness reads the game through this
window.__solmarGame = game;

// ---- Start screen copy (from the story in settings.js) ----
document.getElementById('game-title').textContent = TITLE;
document.getElementById('game-subtitle').textContent = SUBTITLE;
document.getElementById('story-intro').textContent = INTRO;

// ---- Menu buttons ----
document.getElementById('btn-new').addEventListener('click', () => game.startNewGame());
document.getElementById('btn-continue').addEventListener('click', () => game.continueGame());
document.getElementById('btn-resume').addEventListener('click', () => game.resumeGame());
document.getElementById('btn-restart').addEventListener('click', () => {
  game.hud.showPause(false);
  game.startNewGame();
});
document.getElementById('btn-quit').addEventListener('click', () => game.quitToMenu());
document.getElementById('btn-mute').addEventListener('click', () => {
  const muted = game.audio.toggleMute();
  document.getElementById('btn-mute').textContent = muted ? 'Sound: OFF' : 'Sound: ON';
});
// Clicking the canvas while playing (re)locks the pointer.
canvas.addEventListener('click', () => {
  if (game.state === 'playing' && !game.input.locked) game.input.requestLock();
});

// ---- Screenshot mode: stage one frame of real play, then freeze it ----
let frozen = false;
if (shotName) {
  const staged = stageShot(shotName, game, seed);
  frozen = true;
  window.__shotReady = true;
  window.__shotName = staged;
} else {
  game.hud.showStart(hasSave());
}

// ---- The game loop: fixed-step simulation, capped delta ----
const clock = new THREE.Clock();
let accumulator = 0;
const FIXED_STEP = 1 / 60;
const MAX_FRAME = 0.1;

function frame() {
  if (frozen) {
    game.render();
    return;
  }
  const dt = Math.min(clock.getDelta(), MAX_FRAME);
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    game.update(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0; // drop backlog rather than spiral
  game.render();
}

game.renderer.setAnimationLoop(frame);
