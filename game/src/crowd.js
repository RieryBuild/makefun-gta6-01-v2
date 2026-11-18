// The crowd: pedestrians who walk the sidewalks and run from trouble.
// One job: make the city feel inhabited — people strolling the pavements
// and the beach promenade, scattering when shots are fired, going down
// when hit. Each ped is a full humanoid with its own look and walk cycle.

import { CITY_LIFE, STREET_LINES } from './settings.js';
import { animateHumanoid, createHumanoid, layHumanoidDown, pedLook } from './humanoid.js';
import { resolveCircleCollisions } from './skyline.js';

// Sidewalk lines run just off the road: 9.5 m out from each street centre.
function randomSidewalkPoint(rng) {
  const street = rng.pick(STREET_LINES);
  const side = rng.pick([-9.5, 9.5]);
  const along = rng.range(-180, 180);
  if (rng.chance(0.5)) return { x: street + side, z: along };
  return { x: along, z: street + side };
}

export class Crowd {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.peds = []; // { rig, x, z, heading, speed, goal, state, fleeTimer }
  }

  spawnAll() {
    for (let i = 0; i < CITY_LIFE.peds; i += 1) this.spawnPed(true);
    // A few strollers on the beach promenade.
    for (let i = 0; i < 4; i += 1) {
      const ped = this.spawnPed(false, this.rng.range(-150, 150), 194);
      ped.goal = { x: this.rng.range(-170, 170), z: 194 };
    }
  }

  spawnPed(anywhere, nearX = 0, nearZ = 0) {
    const spot = anywhere
      ? randomSidewalkPoint(this.rng)
      : { x: nearX + this.rng.range(-8, 8), z: nearZ + this.rng.range(-8, 8) };
    const rig = createHumanoid(pedLook(this.rng), false);
    rig.group.position.set(spot.x, 0, spot.z);
    this.scene.add(rig.group);
    const ped = {
      rig, x: spot.x, z: spot.z,
      heading: this.rng.range(0, Math.PI * 2),
      speed: CITY_LIFE.pedWalk * this.rng.range(0.8, 1.25),
      goal: randomSidewalkPoint(this.rng),
      state: 'walk', fleeTimer: 0, downTimer: 0,
    };
    rig.group.rotation.y = ped.heading;
    rig.group.userData.owner = { kind: 'ped', ref: ped };
    this.peds.push(ped);
    return ped;
  }

  // Gunfire or a crime nearby: everyone in range runs away from it.
  scarePeds(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dist = Math.hypot(ped.x - x, ped.z - z);
      if (dist > radius) continue;
      ped.state = 'flee';
      ped.fleeTimer = 3 + this.rng.next() * 2;
      const away = Math.atan2(ped.x - x, ped.z - z);
      ped.goal = {
        x: THREE.MathUtils.clamp(ped.x + Math.sin(away) * 40, -185, 185),
        z: THREE.MathUtils.clamp(ped.z + Math.cos(away) * 40, -185, 195),
      };
    }
  }

  knockPedDown(ped) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downTimer = 25;
    layHumanoidDown(ped.rig);
    this.scarePeds(ped.x, ped.z, 30);
  }

  nearestPed(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dist = Math.hypot(ped.x - x, ped.z - z);
      if (dist < bestDist) { best = ped; bestDist = dist; }
    }
    return best;
  }

  update(dt, context) {
    for (let i = this.peds.length - 1; i >= 0; i -= 1) {
      const ped = this.peds[i];
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          this.scene.remove(ped.rig.group);
          this.peds.splice(i, 1);
          this.spawnPed(true);
        }
        continue;
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) {
          ped.state = 'walk';
          ped.goal = randomSidewalkPoint(this.rng);
        }
      }
      const dx = ped.goal.x - ped.x;
      const dz = ped.goal.z - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        ped.goal = randomSidewalkPoint(this.rng);
        continue;
      }
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += THREE.MathUtils.clamp(diff, -2.4 * dt, 2.4 * dt);
      const speed = ped.state === 'flee' ? CITY_LIFE.pedFlee : ped.speed;
      const pos = { x: ped.x + Math.sin(ped.heading) * speed * dt, z: ped.z + Math.cos(ped.heading) * speed * dt };
      resolveCircleCollisions(pos, 0.5, this.colliders);
      // The sea stops peds too: nobody walks past the waterline.
      pos.z = Math.min(pos.z, 214);
      pos.x = THREE.MathUtils.clamp(pos.x, -220, 220);
      ped.x = pos.x;
      ped.z = pos.z;
      ped.rig.group.position.set(ped.x, 0, ped.z);
      ped.rig.group.rotation.y = ped.heading;
      animateHumanoid(ped.rig, dt, speed, false);
    }
    while (this.peds.length < CITY_LIFE.peds + 4) this.spawnPed(true);
  }
}
