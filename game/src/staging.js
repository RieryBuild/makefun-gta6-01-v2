// Screenshot scenes behind ?shot=chase|city|mission|combat.
// One job: stage each shot by playing the real game forward from a fresh
// seeded world with a scripted autopilot — the frame is what real play
// looks like, and the same seed always gives the same frame. After staging,
// the simulation freezes on that exact frame for the screenshot.

import { createAutomobile } from './automobile.js';

const STEP = 1 / 30;

// Finish a shot: hide the briefing banner, the E prompt and every transient
// effect (a frozen damage flash reads as a bug), refresh the HUD, render.
function finishShot(game) {
  game.hud.hideBanner();
  game.hud.hidePrompt();
  game.hud.hideTransientFx();
  game.refreshHud();
  // The response list is only refreshed during play; staging moves units
  // after the last update, so refresh it here to match the frozen frame.
  game.hud.setResponse(game.heat.responseList(game.hero.x, game.hero.z), game.heat.wanted);
  game.render();
}

// Put the game in a fresh playing state for a shot.
function freshGameForShot(game, seed) {
  game.build(seed);
  game.state = 'playing';
  game.input.enabled = true;
  game.input.clear();
  game.hud.hideStart();
  game.hud.hideEndScreens();
  game.hud.setHintVisible(false);
  game.health = 100;
  game.cash = 2450;
}

// Run the simulation forward `seconds` with `drive` held each step.
function runForward(game, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    drive(game, i * STEP);
    game.update(STEP);
  }
}

// Hold W most of the time (a 0.25 s lift per second lets the cruisers keep
// up); steer by heading error toward the road's centreline.
function pulsedChaseAutopilot(game, t) {
  const keys = game.input.keys;
  keys.delete('KeyW');
  if (t % 1 < 0.75) keys.add('KeyW');
  keys.delete('KeyA');
  keys.delete('KeyD');
  if (!game.hero.inCar) return;
  const car = game.hero.car;
  // Desired heading: mostly south, angled back toward x = 0 when off-centre.
  const desired = Math.atan2(-car.x * 0.06, 1);
  let error = desired - car.heading;
  while (error > Math.PI) error -= Math.PI * 2;
  while (error < -Math.PI) error += Math.PI * 2;
  if (error > 0.06) keys.add('KeyA');
  else if (error < -0.06) keys.add('KeyD');
}

// Walk forward (W) with the camera already aimed where the shot wants.
function walkAutopilot(game) {
  game.input.keys.add('KeyW');
}

// Stand still: clear every movement key.
function standStill(game) {
  game.input.keys.delete('KeyW');
  game.input.keys.delete('KeyA');
  game.input.keys.delete('KeyS');
  game.input.keys.delete('KeyD');
}

// Hold the aim pose (right mouse) while facing the nearest enemy.
function aimPose(game) {
  game.input.aimDown = true;
  const enemies = game.gunplay.aliveEnemies();
  if (enemies.length > 0) aimCameraAt(game, enemies[0].x, enemies[0].z);
  standStill(game);
}

// Put Dana in a fresh sports car at (x, z), facing `heading`.
function putPlayerInSportsCar(game, x, z, heading) {
  const car = createAutomobile(game.rng.fork(201), 'sports', 0xc23a2e);
  car.group.position.set(x, 0, z);
  car.group.rotation.y = heading;
  game.scene.add(car.group);
  const parked = { car, x, z, heading, taken: false, own: true };
  game.traffic.parked.push(parked);
  game.hero.enterCar(parked, { onCrime: () => {}, onEnterCar: () => {} });
}

// Aim Dana's camera at a point (for the on-foot action shots).
function aimCameraAt(game, x, z) {
  const dx = x - game.hero.x;
  const dz = z - game.hero.z;
  game.hero.cameraYaw = Math.atan2(dx, dz);
  game.hero.cameraPitch = 0.3;
}

// Frame the nearest live enemy from just behind Dana's shoulder.
function frameNearestEnemy(game) {
  const enemies = game.gunplay.aliveEnemies();
  if (enemies.length === 0) return;
  const enemy = enemies[0];
  aimCameraAt(game, enemy.x, enemy.z);
  game.hero.snapCamera(game.camera, game.hero.cameraYaw, 0.28, 5.5, 2.4);
}

// Pull the nearest enemies into a composed firing line ahead of Dana —
// the fight reads better when the Kings are large in frame, not dots.
function bringEnemiesCloser(game, spots) {
  const enemies = game.gunplay.aliveEnemies()
    .sort((a, b) => Math.hypot(a.x - game.hero.x, a.z - game.hero.z) - Math.hypot(b.x - game.hero.x, b.z - game.hero.z));
  const forward = { x: Math.sin(game.hero.cameraYaw), z: Math.cos(game.hero.cameraYaw) };
  const side = { x: -forward.z, z: forward.x };
  for (let i = 0; i < Math.min(spots.length, enemies.length); i += 1) {
    const enemy = enemies[i];
    const [dist, lateral] = spots[i];
    enemy.x = game.hero.x + forward.x * dist + side.x * lateral;
    enemy.z = game.hero.z + forward.z * dist + side.z * lateral;
    enemy.heading = Math.atan2(game.hero.x - enemy.x, game.hero.z - enemy.z);
    enemy.rig.group.position.set(enemy.x, 0, enemy.z);
    enemy.rig.group.rotation.y = enemy.heading;
  }
}

/**
 * Stage the named shot and freeze the frame. Returns the shot's name.
 * Unknown names stage the chase (the cover).
 */
export function stageShot(name, game, seed) {
  if (name === 'city') {
    freshGameForShot(game, seed);
    game.story.startNext(game.storyContext()); // m1: objective + waypoint on the HUD
    game.hero.spawnAt(0, -24, 0);
    game.hero.cameraYaw = 0; // look south down Marlin Street
    game.hero.cameraPitch = 0.3;
    runForward(game, 5, walkAutopilot);
    // A living street for the frame: parked cars on the kerbs ahead and
    // two pedestrians on the sidewalks near Dana.
    for (const [cx, cz, heading, type] of [[5.5, 22, 0, 'sedan'], [-5.5, -12, Math.PI, 'pickup']]) {
      const car = createAutomobile(game.rng.fork(210 + Math.round(cx)), type);
      car.group.position.set(cx, 0, cz);
      car.group.rotation.y = heading;
      game.scene.add(car.group);
      game.traffic.parked.push({ car, x: cx, z: cz, heading, taken: false, own: false });
    }
    const nearPeds = game.crowd.peds.slice(0, 2);
    const pedSpots = [[8.5, 14, Math.PI], [-8.5, 26, 0]];
    for (let i = 0; i < nearPeds.length; i += 1) {
      const ped = nearPeds[i];
      const spot = pedSpots[i];
      ped.x = spot[0];
      ped.z = spot[1];
      ped.heading = spot[2];
      ped.rig.group.position.set(spot[0], 0, spot[1]);
      ped.rig.group.rotation.y = spot[2];
    }
    finishShot(game);
    return 'city';
  }

  if (name === 'mission') {
    freshGameForShot(game, seed);
    game.story.completedCount = 2;
    game.story.startNext(game.storyContext()); // m3: Dockside Heat
    game.hero.spawnAt(180, 0, -Math.PI / 2); // at the docks' edge, facing the apron
    runForward(game, 0.5, walkAutopilot); // cross the waypoint: the fight starts
    // Step south of the middle pier for a clear firing line over the apron.
    game.hero.spawnAt(190, -16, -Math.PI / 2);
    runForward(game, 3, aimPose); // hold the aim while the Kings shoot back
    bringEnemiesCloser(game, [[12, -2.5], [16, 3]]);
    frameNearestEnemy(game);
    // Nudge the frame north so the lighthouse clears the status panel.
    game.hero.cameraYaw -= 0.18;
    game.hero.snapCamera(game.camera, game.hero.cameraYaw, 0.28, 5.5, 2.4);
    finishShot(game);
    return 'mission';
  }

  if (name === 'combat') {
    freshGameForShot(game, seed);
    game.story.completedCount = 2;
    game.story.startNext(game.storyContext()); // m3: Dockside Heat
    game.hero.spawnAt(182, -10, -Math.PI / 2);
    // Advance on the nearest King until close, then stand and trade fire —
    // a few shots only, so the mission stays live for the frame.
    let shotsFired = 0;
    runForward(game, 4.5, (g) => {
      const enemies = g.gunplay.aliveEnemies();
      if (enemies.length === 0) { standStill(g); return; }
      const enemy = enemies[0];
      const dist = Math.hypot(enemy.x - g.hero.x, enemy.z - g.hero.z);
      aimCameraAt(g, enemy.x, enemy.z);
      if (dist > 14) walkAutopilot(g);
      else {
        standStill(g);
        g.input.aimDown = true; // raise the rifle once in range
        if (shotsFired < 4) { g.tryShoot(); shotsFired += 1; }
      }
    });
    runForward(game, 0.4, aimPose); // settle the aim pose for the frame
    bringEnemiesCloser(game, [[11, -2], [15, 2.5]]);
    frameNearestEnemy(game);
    game.tryShoot(); // one last shot: muzzle flash + tracer lit in the frozen frame
    // Nudge the frame north so the lighthouse clears the status panel.
    game.hero.cameraYaw -= 0.18;
    game.hero.snapCamera(game.camera, game.hero.cameraYaw, 0.28, 5.5, 2.4);
    finishShot(game);
    return 'combat';
  }

  // 'chase' (the cover) and any other name: a 3-star pursuit with a mission live.
  freshGameForShot(game, seed);
  game.story.completedCount = 3;
  game.story.startNext(game.storyContext()); // m4: The Getaway — wanted 3, objective live
  putPlayerInSportsCar(game, 0, -108, 0);
  game.hero.cameraPitch = 0.22; // lower chase camera: more speed, more car
  // Cruisers staged for the camera, which looks forward from the chase car:
  // one oncoming ahead, one alongside, one behind (visible on the minimap).
  const cruiserSpots = [
    { x: 5, z: -44, heading: Math.PI },
    { x: -7, z: -96, heading: 0 },
    { x: 3, z: -160, heading: 0 },
  ];
  for (const spot of cruiserSpots) {
    const cruiser = game.heat.spawnCruiser(game.hero.x, game.hero.z);
    cruiser.x = spot.x;
    cruiser.z = spot.z;
    cruiser.heading = spot.heading;
    cruiser.speed = 14;
    cruiser.car.group.position.set(spot.x, 0, spot.z);
    cruiser.car.group.rotation.y = spot.heading;
  }
  runForward(game, 6, pulsedChaseAutopilot);
  // Compose the frozen frame: officers on foot can't keep up with a car,
  // so they leave the frame (their heads were clipping the camera); one
  // cruiser comes at Dana head-on in the oncoming lane, close enough to
  // read; the traffic that shared its sightline is moved behind the
  // player; and the helicopter swings low and far ahead, inside the frame.
  for (const officer of game.heat.officers) game.scene.remove(officer.rig.group);
  game.heat.officers = [];
  for (const entry of game.traffic.moving) {
    if (Math.abs(entry.x) < 12 && entry.z > game.hero.z && entry.z < game.hero.z + 70) {
      entry.z = game.hero.z - 90;
      entry.car.group.position.set(entry.x, 0, entry.z);
    }
  }
  if (game.heat.cruisers.length > 0) {
    const cruiser = game.heat.cruisers[0];
    cruiser.x = 3.5; // the oncoming lane of Marlin Street
    cruiser.z = game.hero.z + 22;
    cruiser.heading = Math.PI;
    cruiser.speed = 12;
    cruiser.car.group.position.set(cruiser.x, 0, cruiser.z);
    cruiser.car.group.rotation.y = cruiser.heading;
  }
  if (game.heat.heli) {
    const heli = game.heat.heli;
    const hx = game.hero.x + 10;
    const hz = game.hero.z + 70;
    heli.orbit = Math.atan2(hz - game.hero.z, hx - game.hero.x);
    heli.group.position.set(hx, 15, hz);
    heli.group.rotation.y = Math.atan2(game.hero.x - hx, game.hero.z - hz);
  }
  finishShot(game);
  return 'chase';
}
