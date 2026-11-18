// The engine: everything wired together.
// One job: own the game state machine (menu / playing / paused / wasted /
// busted), build every subsystem from the seed, run the frame update, and
// translate between systems — crimes become wanted stars, damage becomes
// WASTED, mission events become banners and cash, drifts become bonuses.

import {
  ARMOUR_MAX, ARMOUR_PICKUP_VALUE, ARMOUR_PICKUPS, GARAGE_APRON,
  GOAL_CASH, HEAT, HERO as HERO_TUNING, HOSPITAL_DOOR, REP_AWARDS, REP_RANKS,
  SPAWN_POINT, STATION_DOOR, SUNSET,
} from './settings.js';
import { createRng } from './rng.js';
import { buildTerrain } from './terrain.js';
import { buildSkyline } from './skyline.js';
import { buildProps } from './props.js';
import { seaTexture as makeSeaTexture } from './surfaces.js';
import { Hero } from './hero.js';
import { TrafficFlow } from './traffic-flow.js';
import { Crowd } from './crowd.js';
import { Heat } from './heat.js';
import { Gunplay } from './gunplay.js';
import { Story } from './story.js';
import { Postcards } from './postcards.js';
import { Interface } from './interface.js';
import { Radar } from './radar.js';
import { Soundscape } from './soundscape.js';
import { Controls } from './controls.js';
import { clearSave, loadGame, saveGame } from './persistence.js';
import { animateHumanoid, createHumanoid, rosaLook } from './humanoid.js';

const PLAYER_START_CASH = HERO_TUNING.startCash;

export class Game {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.seed = seed;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = SUNSET.exposure;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
    this.camera.position.set(0, 40, 120);

    this.state = 'menu'; // menu | playing | paused | wasted | busted
    this.time = 0;
    this.day = 1;
    this.clockMinutes = 17 * 60 + 24; // the story opens at golden hour
    this.shake = 0;
    this.health = HERO_TUNING.maxHealth;
    this.armour = 0;
    this.rep = 0;
    this.repRank = 1;
    this.armourVests = [];
    this.cash = PLAYER_START_CASH;
    this.lastDamageTime = -100;
    this.endTimer = 0;
    this.saveTimer = 0;
    this.menuOrbit = 0;
    this.smokePuffs = [];
    this.driftTime = 0;
    this.driftPaid = false;
    this.rosa = null;

    this.hud = new Interface();
    this.radar = new Radar(document.getElementById('minimap'));
    this.audio = new Soundscape();
    this.input = new Controls(canvas);
    this.input.onUnlock = () => {
      if (this.state === 'playing') this.pauseGame();
    };

    this.build(seed);
    this.refreshHud();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Build (or rebuild) every subsystem from the seed.
  build(seed) {
    while (this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
    const rng = createRng(seed);
    this.rng = rng;
    const sea = makeSeaTexture(rng.fork(21));
    this.terrain = buildTerrain(this.scene, rng.fork(22), sea);
    const city = buildSkyline(this.scene, rng.fork(23));
    this.colliders = city.colliders;
    this.props = buildProps(this.scene, rng.fork(24), this.colliders);
    this.hero = new Hero(this.scene, rng.fork(25), this.colliders);
    this.hero.spawnAt(SPAWN_POINT.x, SPAWN_POINT.z, Math.PI);
    this.traffic = new TrafficFlow(this.scene, rng.fork(26));
    this.traffic.spawnAll();
    this.crowd = new Crowd(this.scene, rng.fork(27), this.colliders);
    this.crowd.spawnAll();
    this.heat = new Heat(this.scene, rng.fork(28), this.colliders);
    this.gunplay = new Gunplay(this.scene, rng.fork(29), this.colliders);
    this.story = new Story(this.scene, rng.fork(30));
    this.postcards = new Postcards(this.scene);
    this.spawnArmourVests();
    this.smokePuffs = [];
    // Rosa herself, waiting by the garage door — the story has a face.
    this.rosa = createHumanoid(rosaLook(), false);
    this.rosa.group.position.set(-28, 0, -35.5);
    this.rosa.group.rotation.y = Math.PI;
    this.scene.add(this.rosa.group);
  }

  // Armour vests: three pickup spots. A vest is a small floating rig —
  // dark plate, pale straps, a soft blue glow — that refills Dana's armour.
  spawnArmourVests() {
    this.armourVests = [];
    for (const spot of ARMOUR_PICKUPS) {
      const vest = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.95, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x2e3d5c, roughness: 0.5, metalness: 0.3 }),
      );
      plate.castShadow = true;
      vest.add(plate);
      for (const strapY of [0.28, -0.28]) {
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.79, 0.12, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x9fb4d8, roughness: 0.6 }),
        );
        strap.position.y = strapY;
        vest.add(strap);
      }
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.04, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0x7fb3ff }),
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.y = -0.6;
      vest.add(glow);
      vest.position.set(spot.x, 1.1, spot.z);
      this.scene.add(vest);
      this.armourVests.push({ mesh: vest, x: spot.x, z: spot.z, taken: false, respawn: 0, name: spot.name });
    }
  }

  updateArmourVests(dt) {
    for (const vest of this.armourVests) {
      if (vest.taken) {
        vest.respawn -= dt;
        if (vest.respawn <= 0) {
          vest.taken = false;
          vest.mesh.visible = true;
        }
        continue;
      }
      vest.mesh.rotation.y += dt * 1.2;
      vest.mesh.position.y = 1.1 + Math.sin(this.time * 2 + vest.x) * 0.12;
      if (Math.hypot(this.hero.x - vest.x, this.hero.z - vest.z) < 2.2) {
        vest.taken = true;
        vest.respawn = 90;
        vest.mesh.visible = false;
        this.armour = Math.min(ARMOUR_MAX, this.armour + ARMOUR_PICKUP_VALUE);
        this.hud.setArmour(this.armour);
        this.hud.showToast(`Armour vest picked up (${vest.name}) — +${ARMOUR_PICKUP_VALUE}`, 3);
        this.audio.blip(660, 0.12, 0.12);
      }
    }
  }

  // ---- Game flow ----
  startNewGame() {
    clearSave();
    this.build(this.seed);
    this.health = HERO_TUNING.maxHealth;
    this.armour = 0;
    this.rep = 0;
    this.repRank = 1;
    this.cash = PLAYER_START_CASH;
    this.day = 1;
    this.clockMinutes = 17 * 60 + 24;
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.hud.hideStart();
    this.hud.hideEndScreens();
    this.hud.setHintVisible(true);
    this.hud.showDialogue('Rosa', 'Dana! The garage needs you — come inside and I will brief you on the first job.');
    this.audio.init();
    this.audio.blip();
    this.audio.startRadio();
    this.hud.setRadio(this.audio.currentStation());
    this.input.requestLock();
    this.refreshHud();
  }

  continueGame() {
    const data = loadGame();
    this.build(this.seed);
    if (data) {
      this.cash = data.cash ?? PLAYER_START_CASH;
      this.health = data.health ?? HERO_TUNING.maxHealth;
      this.armour = data.armour ?? 0;
      this.rep = data.rep ?? 0;
      this.repRank = 1;
      for (const entry of REP_RANKS) {
        if (this.rep >= entry.at) this.repRank = entry.level;
      }
      this.story.completedCount = data.missionsCompleted ?? 0;
      this.story.storyComplete = data.storyComplete ?? false;
      this.postcards.restore(data.collectibles);
      this.hero.spawnAt(data.x ?? SPAWN_POINT.x, data.z ?? SPAWN_POINT.z, Math.PI);
    }
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.hud.hideStart();
    this.hud.hideEndScreens();
    this.hud.setHintVisible(true);
    this.audio.init();
    this.audio.blip();
    this.audio.startRadio();
    this.hud.setRadio(this.audio.currentStation());
    this.input.requestLock();
    this.refreshHud();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.clear();
    this.input.releaseLock();
    this.hud.showPause(true);
    this.autosave();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.showPause(false);
    this.input.requestLock();
  }

  quitToMenu() {
    this.autosave();
    this.state = 'menu';
    this.input.enabled = false;
    this.input.clear();
    this.input.releaseLock();
    this.hud.showPause(false);
    this.hud.showStart(true);
    this.hud.setHintVisible(false);
  }

  autosave() {
    saveGame({
      cash: this.cash,
      health: this.health,
      armour: this.armour,
      rep: this.rep,
      missionsCompleted: this.story.completedCount,
      storyComplete: this.story.storyComplete,
      collectibles: this.postcards.collectedIds(),
      x: this.hero.x,
      z: this.hero.z,
    });
  }

  // Reputation: points move Dana up the ranks; a rank-up gets a toast.
  addRep(points) {
    if (points <= 0) return;
    this.rep += points;
    let rank = 1;
    for (const entry of REP_RANKS) {
      if (this.rep >= entry.at) rank = entry.level;
    }
    if (rank > this.repRank) {
      this.repRank = rank;
      const entry = REP_RANKS[rank - 1];
      this.hud.showToast(`REP ${rank} — ${entry.name}`, 4);
      this.audio.blip(1046, 0.15, 0.12);
    }
    this.hud.setRep(this.rep);
  }

  refreshHud() {
    this.hud.setCash(this.cash, GOAL_CASH);
    this.hud.setPostcards(this.postcards.collectedCount, this.postcards.cards.length);
    this.hud.setHealth(this.health);
    this.hud.setArmour(this.armour);
    this.hud.setRep(this.rep);
    this.hud.setWanted(this.heat.wanted);
    this.hud.setAmmo(this.gunplay.ammo, this.gunplay.reloading);
    this.hud.setMissionName(this.story.active ? this.story.active.def.title : 'SOLMAR BAY');
    this.hud.setObjective(this.story.objectiveText());
    this.hud.setStagePips(this.story.stageProgress());
    this.hud.setClock(this.day, this.clockMinutes);
    this.hud.setLocation(this.hero.x, this.hero.z);
  }

  // ---- Crimes, damage and the end screens ----
  onCrime(kind, stars) {
    this.heat.addWanted(stars, this.time);
    this.hud.setWanted(this.heat.wanted);
    if (kind === 'shoot' || kind === 'hitPed') this.crowd.scarePeds(this.hero.x, this.hero.z, 60);
  }

  damagePlayer(amount) {
    if (this.state !== 'playing') return;
    // Armour soaks damage first; what gets through hits health.
    let remaining = amount;
    if (this.armour > 0) {
      const soaked = Math.min(this.armour, remaining);
      this.armour -= soaked;
      remaining -= soaked;
      this.hud.setArmour(this.armour);
    }
    this.health = Math.max(0, this.health - remaining);
    this.lastDamageTime = this.time;
    this.shake = Math.min(1, this.shake + 0.35);
    this.hud.damageFlash();
    this.hud.setHealth(this.health);
    if (this.health <= 0) this.wasted();
  }

  wasted() {
    this.state = 'wasted';
    this.endTimer = 3.5;
    this.input.clear();
    this.input.releaseLock();
    this.hud.showWasted();
    this.hud.setArrestProgress(0);
    this.audio.failSting();
    this.audio.setSiren(false);
    this.story.failActive('WASTED', this.storyContext());
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.endTimer = 3.5;
    this.input.clear();
    this.input.releaseLock();
    this.hud.showBusted();
    this.hud.setArrestProgress(0);
    this.audio.failSting();
    this.audio.setSiren(false);
    this.story.failActive('BUSTED', this.storyContext());
  }

  respawn() {
    const wasWasted = this.state === 'wasted';
    const fine = wasWasted ? HEAT.wastedFine : HEAT.bustedFine;
    const spot = wasWasted ? HOSPITAL_DOOR : STATION_DOOR;
    this.cash = Math.max(0, this.cash - fine);
    this.health = HERO_TUNING.maxHealth;
    this.heat.clearWanted();
    this.gunplay.clearEnemies();
    this.hero.spawnAt(spot.x, spot.z, Math.PI);
    this.state = 'playing';
    this.hud.hideEndScreens();
    this.hud.showToast(wasWasted ? `Patched up at Solmar General — $${fine} bill` : `Released from SBPD — $${fine} fine`, 4);
    this.input.requestLock();
    this.refreshHud();
    this.autosave();
  }

  // ---- Contexts handed to the subsystems ----
  storyContext() {
    return {
      gunplay: this.gunplay, traffic: this.traffic, heat: this.heat, time: this.time,
      playerX: this.hero.x, playerZ: this.hero.z,
      playerCar: this.hero.inCar ? this.hero.car : null,
      onBanner: (title, text, seconds) => this.hud.showBanner(title, text, seconds),
      onDialogue: (speaker, text) => this.hud.showDialogue(speaker, text),
      onCash: (amount) => {
        this.cash += amount;
        this.hud.setCash(this.cash, GOAL_CASH);
        this.audio.missionComplete();
        this.autosave();
      },
      onMissionComplete: () => {
        this.addRep(REP_AWARDS.mission);
        this.refreshHud();
      },
    };
  }

  heatContext() {
    return {
      playerX: this.hero.x, playerZ: this.hero.z,
      playerSpeed: this.hero.currentSpeed, playerInCar: this.hero.inCar, time: this.time,
      onRam: (cruiser) => {
        this.hero.takeRam(cruiser.x, cruiser.z);
        this.shake = Math.min(1, this.shake + 0.25);
        this.audio.crash(0.3);
      },
      onBusted: () => this.busted(),
      onArrestProgress: (p) => this.hud.setArrestProgress(p),
      onPlayerShot: (damage) => this.damagePlayer(damage),
      onEnemyShotFired: (fx, fz, tx, tz) => {
        this.gunplay.showTracer(new THREE.Vector3(fx, 1.4, fz), new THREE.Vector3(tx, 1.2, tz));
      },
      onWantedChanged: (wanted) => {
        this.hud.setWanted(wanted);
        if (wanted === 0) this.hud.showToast('You lost the cops.', 3);
      },
    };
  }

  gunplayContext() {
    return {
      officers: this.heat.officers,
      peds: this.crowd.peds,
      onHitMarker: () => this.hud.flashHitmarker(),
      onEnemyKilled: () => this.story.onEnemyKilled(),
      onOfficerShot: (officer) => {
        this.onCrime('shootCop', 2);
        const index = this.heat.officers.indexOf(officer);
        if (index !== -1) {
          this.heat.officers.splice(index, 1);
          this.scene.remove(officer.rig.group);
        }
      },
      onPedShot: (ped) => {
        this.crowd.knockPedDown(ped);
        this.onCrime('shoot', 2);
      },
      onPlayerShot: (damage) => this.damagePlayer(damage),
    };
  }

  // ---- Shooting ----
  tryShoot() {
    if (this.hero.inCar) return;
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const muzzle = this.hero.muzzleWorldPosition();
    // Aim through the crosshair, fire from the muzzle: the aim point is
    // where the camera's line lands, and the bullet travels muzzle->point.
    const context = this.gunplayContext();
    const aim = this.gunplay.aimPoint(camPos, camDir, context);
    const fireDir = aim.clone().sub(muzzle).normalize();
    const result = this.gunplay.playerShoot(muzzle, fireDir, this.time, context, muzzle);
    if (result !== 'dry' && result !== 'wait') {
      this.audio.gunshot();
      this.shake = Math.min(1, this.shake + 0.06);
      // Gunfire draws heat only when the law is close enough to hear it.
      const policeNear = this.heat.nearestUnitDistance(this.hero.x, this.hero.z) < 60;
      this.onCrime('shoot', policeNear ? 1 : 0);
      this.hud.setAmmo(this.gunplay.ammo, this.gunplay.reloading);
    } else if (result === 'dry') {
      if (this.gunplay.startReload()) this.audio.reload();
    }
  }

  // ---- Tyre smoke ----
  spawnSmoke(x, z) {
    if (this.smokePuffs.length > 24) return;
    if (!this.smokeTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      gradient.addColorStop(0, 'rgba(220,220,220,0.7)');
      gradient.addColorStop(1, 'rgba(220,220,220,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      this.smokeTexture = new THREE.CanvasTexture(canvas);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.smokeTexture, transparent: true, depthWrite: false,
    }));
    sprite.position.set(x, 0.5, z);
    sprite.scale.set(1.4, 1.4, 1);
    this.scene.add(sprite);
    this.smokePuffs.push({ sprite, timer: 0.9 });
  }

  updateSmoke(dt) {
    for (let i = this.smokePuffs.length - 1; i >= 0; i -= 1) {
      const puff = this.smokePuffs[i];
      puff.timer -= dt;
      puff.sprite.position.y += dt * 1.2;
      puff.sprite.material.opacity = Math.max(0, puff.timer / 0.9) * 0.7;
      puff.sprite.scale.multiplyScalar(1 + dt * 1.5);
      if (puff.timer <= 0) {
        this.scene.remove(puff.sprite);
        this.smokePuffs.splice(i, 1);
      }
    }
  }

  // ---- The one-shot E key: start a mission, get in a car, or get out ----
  handleInteract() {
    if (this.hero.inCar) {
      this.hero.exitCar({ onExitCar: () => this.audio.blip(520, 0.06, 0.1) });
      return;
    }
    const nearGarage = Math.hypot(this.hero.x - GARAGE_APRON.x, this.hero.z - GARAGE_APRON.z) < 9;
    const next = this.story.nextMission();
    if (nearGarage && next && !this.story.active) {
      this.story.startNext(this.storyContext());
      this.refreshHud();
      return;
    }
    const car = this.traffic.nearestParkedCar(this.hero.x, this.hero.z, 4.5);
    if (car) {
      this.hero.enterCar(car, {
        onCrime: (kind, stars) => {
          this.onCrime(kind, stars);
          this.hud.showToast('Car stolen — keep an eye out for SBPD.', 3);
        },
        onEnterCar: () => this.audio.blip(520, 0.06, 0.1),
      });
      this.refreshHud();
    }
  }

  // The context prompt under the crosshair, recomputed every frame.
  updatePrompt() {
    if (this.hero.inCar) {
      this.hud.showPrompt('E — Get out of the car');
      return;
    }
    const nearGarage = Math.hypot(this.hero.x - GARAGE_APRON.x, this.hero.z - GARAGE_APRON.z) < 9;
    const next = this.story.nextMission();
    if (nearGarage && next && !this.story.active) {
      this.hud.showPrompt(`E — Start mission: ${next.title}`);
      return;
    }
    if (nearGarage && !this.story.active && !next) {
      this.hud.showPrompt('Story complete — free roam. Enjoy Solmar Bay.');
      return;
    }
    const car = this.traffic.nearestParkedCar(this.hero.x, this.hero.z, 4.5);
    if (car) {
      this.hud.showPrompt(car.own ? 'E — Get in your van' : 'E — Steal the car');
      return;
    }
    this.hud.hidePrompt();
  }

  // ---- The frame update ----
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // The living background runs in every state (menu included).
    this.terrain.tick(dt);
    this.terrain.followPlayer(this.hero.x, this.hero.z);
    this.props.tick(dt, this.time);
    const ambient = {
      playerX: this.hero.x, playerZ: this.hero.z,
      playerCar: this.hero.inCar ? { x: this.hero.car.x, z: this.hero.car.z } : null,
    };
    this.traffic.update(dt, ambient);
    this.crowd.update(dt, ambient);
    this.gunplay.update(dt);
    this.updateSmoke(dt);
    this.hud.update(dt);
    if (this.rosa) animateHumanoid(this.rosa, dt, 0, false);

    if (this.state === 'menu') {
      // The title panorama: a low, slow drift around the bay side of the
      // city, looking across the beach and the layered skyline toward the
      // setting sun — the first frame has to sell the place.
      this.menuOrbit += dt * 0.02;
      const angle = 0.5 + Math.sin(this.menuOrbit) * 0.45;
      const radius = 180;
      this.camera.position.set(
        80 + Math.cos(angle) * radius, 28, 90 + Math.sin(angle) * radius,
      );
      this.camera.lookAt(-30, 10, -20);
      return;
    }
    if (this.state === 'wasted' || this.state === 'busted') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.respawn();
      return;
    }
    if (this.state !== 'playing') return;

    // The clock: one game minute every three real seconds.
    this.clockMinutes += dt / 3;
    if (this.clockMinutes >= 24 * 60) {
      this.clockMinutes -= 24 * 60;
      this.day += 1;
    }

    // --- Input: look, fire, reload, interact, pause, mute, radio ---
    const mouse = this.input.takeMouse();
    if (mouse.dx !== 0 || mouse.dy !== 0) this.hero.applyMouseLook(mouse.dx, mouse.dy);
    this.hero.firing = this.input.mouseDown && !this.hero.inCar;
    // Firing raises the rifle: a shot from the hip would leave the muzzle
    // at knee height and the bullet climbing at the sky.
    this.hero.aiming = this.input.aimDown || this.hero.firing;
    if (this.hero.firing) this.tryShoot();
    if (this.input.tapped('KeyR') && !this.hero.inCar) {
      if (this.gunplay.startReload()) this.audio.reload();
    }
    if (this.input.tapped('KeyE')) this.handleInteract();
    if (this.input.tapped('KeyP')) this.pauseGame();
    if (this.input.tapped('KeyN')) {
      this.hud.setRadio(this.audio.nextStation());
      this.hud.showToast(`Radio: ${this.audio.currentStation().name}`, 2);
    }
    if (this.input.tapped('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.showToast(muted ? 'Sound muted (M to unmute)' : 'Sound on', 2);
    }

    // --- Player + systems ---
    const heroContext = {
      carCircles: this.traffic.carCircles(),
      peds: this.crowd,
      onCrime: (kind, stars) => this.onCrime(kind, stars),
      onCrash: (speed) => {
        this.audio.crash(Math.min(1, speed / 30));
        this.shake = Math.min(1, this.shake + 0.2);
      },
      onTireSmoke: (x, z) => this.spawnSmoke(x, z),
      onNearMiss: () => {
        this.cash += 150;
        this.addRep(REP_AWARDS.nearMiss);
        this.hud.setCash(this.cash, GOAL_CASH);
        this.hud.showScorePopup('NEAR MISS  +$150', 'cash');
        this.audio.blip(1046, 0.1, 0.12);
      },
      onEnterCar: () => {},
      onExitCar: () => {},
    };
    if (this.hero.inCar) this.hero.updateDriving(dt, this.input, heroContext);
    else this.hero.updateOnFoot(dt, this.input, heroContext);
    this.hero.updateCamera(this.camera, dt, this.shake);
    this.heat.update(dt, this.heatContext());
    this.gunplay.updateEnemies(dt, { playerX: this.hero.x, playerZ: this.hero.z, onPlayerShot: (d) => this.damagePlayer(d) });
    this.story.update(dt, this.storyContext());
    this.updateArmourVests(dt);
    this.postcards.update(dt, {
      playerX: this.hero.x,
      playerZ: this.hero.z,
      onPickup: (card, reward, found, total) => {
        this.cash += reward;
        this.addRep(REP_AWARDS.postcard);
        this.hud.setCash(this.cash, GOAL_CASH);
        this.hud.setPostcards(found, total);
        this.hud.showToast(`Sunset Postcard ${found}/${total} — ${card.spot.name} (+$${reward})`, 4);
        this.audio.blip(880, 0.12, 0.12);
        this.autosave();
      },
    });

    // --- Drift scoring: hold a slide, get paid for it ---
    if (this.hero.drifting) {
      this.driftTime += dt;
      if (this.driftTime > 1.2 && !this.driftPaid) {
        this.driftPaid = true;
        const mult = Math.min(5, 1 + Math.floor(this.driftTime));
        const bonus = 50 * mult;
        this.cash += bonus;
        this.addRep(REP_AWARDS.drift * mult);
        this.hud.setCash(this.cash, GOAL_CASH);
        this.hud.showScorePopup(`DRIFT x${mult}  +$${bonus}`, 'drift');
      }
    } else {
      this.driftTime = 0;
      this.driftPaid = false;
    }

    // --- Health regen after a quiet spell ---
    if (this.health > 0 && this.health < HERO_TUNING.maxHealth && this.time - this.lastDamageTime > HERO_TUNING.regenDelay) {
      this.health = Math.min(HERO_TUNING.maxHealth, this.health + HERO_TUNING.regenRate * dt);
      this.hud.setHealth(this.health);
    }

    // --- Audio beds ---
    const speedNorm = this.hero.inCar ? Math.abs(this.hero.carSpeed) / 36 : 0;
    this.audio.setEngine(speedNorm, this.hero.inCar);
    this.audio.setSiren(this.heat.wanted > 0 && this.heat.cruisers.length > 0);

    // --- HUD + radar, every frame ---
    const carName = this.hero.inCar ? this.hero.car.vehicle.name : '';
    const condition = this.hero.inCar ? this.hero.car.condition : 1;
    this.hud.setSpeed(this.hero.inCar ? Math.abs(this.hero.carSpeed) * 3.6 : 0, this.hero.inCar, carName, condition);
    this.hud.setAmmo(this.gunplay.ammo, this.gunplay.reloading);
    this.hud.setObjective(this.story.objectiveText());
    this.hud.setMissionName(this.story.active ? this.story.active.def.title : 'SOLMAR BAY');
    this.hud.setStagePips(this.story.stageProgress());
    this.hud.setCrosshairVisible(!this.hero.inCar);
    this.hud.setResponse(this.heat.responseList(this.hero.x, this.hero.z), this.heat.wanted);
    this.hud.setClock(this.day, this.clockMinutes);
    this.hud.setLocation(this.hero.x, this.hero.z);
    this.hud.setRadio(this.audio.currentStation());
    this.updatePrompt();
    this.radar.draw({
      playerX: this.hero.x, playerZ: this.hero.z,
      heading: this.hero.inCar ? this.hero.car.heading : this.hero.heading,
      waypoint: this.story.waypoint(),
      police: this.heat.getBlips(),
      enemies: this.gunplay.aliveEnemies(),
      collectibles: this.postcards.remaining(),
      time: this.time,
    });

    // --- Autosave every 30 seconds of play ---
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.autosave();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
