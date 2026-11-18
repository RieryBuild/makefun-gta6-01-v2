// The heat: SBPD's response to Dana's crimes.
// One job: turn wanted stars into pressure — cruisers that chase and ram,
// officers who run Dana down and cuff her, and at 3 stars a helicopter
// with a searchlight circling overhead. Stars decay when the law loses
// sight of her; a fresh crime puts them straight back.

import { HEAT, STREET_LINES } from './settings.js';
import { createAutomobile, flashLightBar, updateAutomobile } from './automobile.js';
import { animateHumanoid, copLook, createHumanoid } from './humanoid.js';
import { resolveCircleCollisions } from './skyline.js';

const UNIT_NAMES = ['MARLIN', 'SNAPPER', 'TARPON', 'GULL', 'HERON', 'IBIS', 'KESTREL', 'MERLIN', 'OSPREY', 'FALCON'];

// The police helicopter: a capsule body, tail boom, spinning rotors, and a
// searchlight cone that tracks the player across the dusk.
function buildHelicopter(scene) {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d2f4a, roughness: 0.4, metalness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.0, 6, 12), navy);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), white);
  belly.scale.set(1, 0.6, 1.6);
  belly.position.y = -0.35;
  group.add(belly);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.08, metalness: 0.9 }),
  );
  glass.scale.set(0.9, 0.7, 0.9);
  glass.position.set(0, 0.25, 1.35);
  group.add(glass);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.6, 8), navy);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.2, -3.2);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.7), navy);
  fin.position.set(0, 0.8, -4.8);
  group.add(fin);
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), white);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(side * 0.9, -1.1, 0);
    group.add(skid);
    for (const z of [-0.8, 0.8]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), white);
      strut.position.set(side * 0.9, -0.8, z);
      group.add(strut);
    }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), white);
  mast.position.y = 1.1;
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.5;
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.05, 0.28), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4, metalness: 0.6 }));
    blade.rotation.y = angle;
    rotor.add(blade);
  }
  group.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.25, 0.3, -4.8);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4 }));
    blade.rotation.x = angle;
    tailRotor.add(blade);
  }
  group.add(tailRotor);
  // Searchlight: a cone of additive light plus a bright pool on the ground.
  const coneGeo = new THREE.ConeGeometry(5, 1, 20, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  group.add(cone);
  // The pool is a soft radial glow, bright in the middle and gone at the
  // edge — a hard disc reads as a grey plate on the road.
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = 128;
  poolCanvas.height = 128;
  const poolCtx = poolCanvas.getContext('2d');
  const poolGradient = poolCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  poolGradient.addColorStop(0, 'rgba(255,242,192,0.85)');
  poolGradient.addColorStop(0.5, 'rgba(255,242,192,0.35)');
  poolGradient.addColorStop(1, 'rgba(255,242,192,0)');
  poolCtx.fillStyle = poolGradient;
  poolCtx.fillRect(0, 0, 128, 128);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 20),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(poolCanvas), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  scene.add(pool);
  scene.add(group);
  return { group, rotor, tailRotor, cone, pool, orbit: Math.random() * Math.PI * 2 };
}

export class Heat {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.wanted = 0;
    this.lastSeenTime = -100;
    this.cruisers = []; // { car, x, z, heading, speed, crew, name, stuckTimer }
    this.officers = []; // { rig, x, z, heading, arrestTimer, shootTimer, name }
    this.heli = null;
    this.unitCounter = 0;
  }

  addWanted(stars, time) {
    if (stars <= 0) return;
    this.wanted = Math.min(HEAT.maxStars, this.wanted + stars);
    this.lastSeenTime = time;
  }

  clearWanted() {
    this.wanted = 0;
    for (const cruiser of this.cruisers) this.scene.remove(cruiser.car.group);
    for (const officer of this.officers) this.scene.remove(officer.rig.group);
    this.cruisers = [];
    this.officers = [];
    this.removeHeli();
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.scene.remove(this.heli.pool);
    this.heli = null;
  }

  // How many units each star level fields.
  desiredUnits() {
    const table = [
      { cruisers: 0, officers: 0 },
      { cruisers: 1, officers: 0 },
      { cruisers: 2, officers: 1 },
      { cruisers: 2, officers: 1 },
      { cruisers: 3, officers: 2 },
      { cruisers: 4, officers: 3 },
    ];
    return table[this.wanted] || table[0];
  }

  nextUnitName() {
    const name = UNIT_NAMES[this.unitCounter % UNIT_NAMES.length];
    const number = 10 + this.unitCounter;
    this.unitCounter += 1;
    return `${name}-${number}`;
  }

  spawnCruiser(playerX, playerZ) {
    // Spawn on a street at spawn range, in a random direction.
    const angle = this.rng.range(0, Math.PI * 2);
    const rawX = playerX + Math.cos(angle) * HEAT.spawnRange;
    const rawZ = playerZ + Math.sin(angle) * HEAT.spawnRange;
    const streetX = STREET_LINES.reduce((best, line) => (Math.abs(line - rawX) < Math.abs(best - rawX) ? line : best), STREET_LINES[0]);
    const streetZ = STREET_LINES.reduce((best, line) => (Math.abs(line - rawZ) < Math.abs(best - rawZ) ? line : best), STREET_LINES[0]);
    const onVertical = Math.abs(rawX - streetX) < Math.abs(rawZ - streetZ);
    const x = onVertical ? streetX : THREE.MathUtils.clamp(rawX, -186, 186);
    const z = onVertical ? THREE.MathUtils.clamp(rawZ, -186, 186) : streetZ;
    const heading = Math.atan2(playerX - x, playerZ - z);
    const car = createAutomobile(this.rng.fork(500 + this.cruisers.length * 17), 'police');
    car.group.position.set(x, 0, z);
    car.group.rotation.y = heading;
    this.scene.add(car.group);
    const cruiser = {
      car, x, z, heading, speed: 8, crew: true,
      name: this.nextUnitName(), stuckTimer: 0,
    };
    this.cruisers.push(cruiser);
    return cruiser;
  }

  spawnOfficer(x, z) {
    const rig = createHumanoid(copLook(this.rng), false);
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);
    const officer = {
      rig, x, z, heading: this.rng.range(0, Math.PI * 2),
      arrestTimer: 0, shootTimer: 1 + this.rng.next(),
      name: this.nextUnitName(),
    };
    rig.group.userData.owner = { kind: 'officer', ref: officer };
    this.officers.push(officer);
    return officer;
  }

  nearestUnitDistance(playerX, playerZ) {
    let best = Infinity;
    for (const cruiser of this.cruisers) best = Math.min(best, Math.hypot(cruiser.x - playerX, cruiser.z - playerZ));
    for (const officer of this.officers) best = Math.min(best, Math.hypot(officer.x - playerX, officer.z - playerZ));
    return best;
  }

  getBlips() {
    const blips = [];
    for (const cruiser of this.cruisers) blips.push({ x: cruiser.x, z: cruiser.z, kind: 'police' });
    for (const officer of this.officers) blips.push({ x: officer.x, z: officer.z, kind: 'police' });
    if (this.heli) blips.push({ x: this.heli.group.position.x, z: this.heli.group.position.z, kind: 'heli' });
    return blips;
  }

  // The SBPD RESPONSE list for the HUD: named units, distances, statuses.
  responseList(playerX, playerZ) {
    const list = [];
    for (const cruiser of this.cruisers) {
      const dist = Math.hypot(cruiser.x - playerX, cruiser.z - playerZ);
      list.push({
        name: cruiser.name, dist: Math.round(dist),
        status: dist < 12 ? 'RAMMING' : dist < 45 ? 'PURSUIT' : 'RESPONDING',
      });
    }
    for (const officer of this.officers) {
      const dist = Math.hypot(officer.x - playerX, officer.z - playerZ);
      list.push({
        name: officer.name, dist: Math.round(dist),
        status: dist < 6 ? 'ARRESTING' : 'ON FOOT',
      });
    }
    if (this.heli) {
      list.push({
        name: 'GULL-1', dist: Math.round(Math.hypot(this.heli.group.position.x - playerX, this.heli.group.position.z - playerZ)),
        status: 'AIR SUPPORT',
      });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list.slice(0, 5);
  }

  update(dt, context) {
    const px = context.playerX;
    const pz = context.playerZ;
    const time = context.time;
    // Seen: any unit close keeps the heat fresh.
    if (this.wanted > 0 && this.nearestUnitDistance(px, pz) < 55) this.lastSeenTime = time;
    // Unseen for long enough: a star drops. At zero the law stands down.
    if (this.wanted > 0 && time - this.lastSeenTime > HEAT.decayDelay) {
      this.wanted -= 1;
      this.lastSeenTime = time;
      context.onWantedChanged?.(this.wanted);
      if (this.wanted === 0) this.clearWanted();
    }
    if (this.wanted === 0) return;
    // Field the right number of units.
    const desired = this.desiredUnits();
    while (this.cruisers.length < desired.cruisers) this.spawnCruiser(px, pz);
    while (this.cruisers.length > desired.cruisers) {
      const extra = this.cruisers.pop();
      this.scene.remove(extra.car.group);
    }
    while (this.officers.length < desired.officers) {
      // Officers arrive on foot from the nearest cruiser, or from the street.
      const anchor = this.cruisers[0];
      if (anchor) this.spawnOfficer(anchor.x + 2, anchor.z + 2);
      else this.spawnOfficer(px + this.rng.range(-30, 30), pz + this.rng.range(-30, 30));
    }
    // The helicopter joins at 3 stars and leaves below it.
    if (this.wanted >= HEAT.heliStars && !this.heli) this.heli = buildHelicopter(this.scene);
    if (this.wanted < HEAT.heliStars && this.heli) this.removeHeli();

    // Cruisers: steer at the player, rubber-band the speed, ram on contact.
    for (const cruiser of this.cruisers) {
      const dx = px - cruiser.x;
      const dz = pz - cruiser.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - cruiser.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
      cruiser.heading += turn;
      const topSpeed = dist > 60 ? 33 : dist > 25 ? 29 : 24;
      cruiser.speed += ((context.playerInCar ? topSpeed : Math.min(topSpeed, 20)) - cruiser.speed) * Math.min(1, dt * 0.9);
      const pos = {
        x: cruiser.x + Math.sin(cruiser.heading) * cruiser.speed * dt,
        z: cruiser.z + Math.cos(cruiser.heading) * cruiser.speed * dt,
      };
      resolveCircleCollisions(pos, 2.1, this.colliders);
      const moved = Math.hypot(pos.x - cruiser.x, pos.z - cruiser.z);
      if (moved < cruiser.speed * dt * 0.25 && cruiser.speed > 5) {
        // Stuck against a wall: back off and re-aim.
        cruiser.stuckTimer += dt;
        if (cruiser.stuckTimer > 1.2) {
          cruiser.heading += Math.PI / 2;
          cruiser.stuckTimer = 0;
        }
      } else {
        cruiser.stuckTimer = 0;
      }
      cruiser.x = pos.x;
      cruiser.z = pos.z;
      cruiser.car.group.position.set(cruiser.x, 0, cruiser.z);
      cruiser.car.group.rotation.y = cruiser.heading;
      updateAutomobile(cruiser.car, cruiser.speed, THREE.MathUtils.clamp(diff * 2, -0.5, 0.5), dt);
      flashLightBar(cruiser.car, time);
      // Ram: contact with the player's car (or the player) shoves them.
      if (dist < 4.2 && cruiser.speed > 6) {
        context.onRam?.(cruiser);
        cruiser.speed *= 0.4;
      }
      // A cruiser that catches an on-foot Dana drops its officer.
      if (!context.playerInCar && dist < 14 && cruiser.crew) {
        cruiser.crew = false;
        this.spawnOfficer(cruiser.x + 2, cruiser.z);
      }
    }

    // Officers: run Dana down, cuff her if they hold her, shoot at 2+ stars.
    for (let i = this.officers.length - 1; i >= 0; i -= 1) {
      const officer = this.officers[i];
      const dx = px - officer.x;
      const dz = pz - officer.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 120) {
        // Lost her: the officer gives up and walks off.
        this.scene.remove(officer.rig.group);
        this.officers.splice(i, 1);
        continue;
      }
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - officer.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      officer.heading += THREE.MathUtils.clamp(diff, -3.2 * dt, 3.2 * dt);
      const runSpeed = dist > 6 ? 7.2 : 2.5;
      const pos = {
        x: officer.x + Math.sin(officer.heading) * runSpeed * dt,
        z: officer.z + Math.cos(officer.heading) * runSpeed * dt,
      };
      resolveCircleCollisions(pos, 0.5, this.colliders);
      officer.x = pos.x;
      officer.z = pos.z;
      officer.rig.group.position.set(officer.x, 0, officer.z);
      officer.rig.group.rotation.y = officer.heading;
      animateHumanoid(officer.rig, dt, runSpeed, false);
      if (dist < 2.4 && !context.playerInCar) {
        officer.arrestTimer += dt;
        context.onArrestProgress?.(Math.min(1, officer.arrestTimer / HEAT.arrestHold));
        if (officer.arrestTimer >= HEAT.arrestHold) {
          context.onBusted?.();
          return;
        }
      } else {
        officer.arrestTimer = Math.max(0, officer.arrestTimer - dt * 2);
      }
      // At 2+ stars officers fire their sidearms when they have a lane.
      officer.shootTimer -= dt;
      if (this.wanted >= 2 && officer.shootTimer <= 0 && dist < 34 && dist > 4) {
        officer.shootTimer = 1.1 + this.rng.next() * 0.8;
        context.onEnemyShotFired?.(officer.x, officer.z, px, pz);
        if (this.rng.chance(0.4)) context.onPlayerShot?.(5 + this.rng.next() * 5);
      }
    }
    if (this.officers.every((officer) => officer.arrestTimer <= 0)) context.onArrestProgress?.(0);

    // The helicopter orbits high and keeps its light on Dana.
    if (this.heli) {
      const heli = this.heli;
      heli.orbit += dt * 0.22;
      const hx = px + Math.cos(heli.orbit) * 26;
      const hz = pz + Math.sin(heli.orbit) * 26;
      heli.group.position.set(hx, 36, hz);
      heli.group.rotation.y = Math.atan2(px - hx, pz - hz);
      heli.rotor.rotation.y += dt * 22;
      heli.tailRotor.rotation.z += dt * 30;
      // The spotlight cone stretches from the belly to the ground at Dana.
      // (ConeGeometry's apex is already up: apex at the heli, base on the ground.)
      const drop = heli.group.position.y;
      heli.cone.position.set(0, -drop / 2, 0);
      heli.cone.scale.set(1, drop, 1);
      heli.pool.position.set(px, 0.08, pz);
    }
  }
}
