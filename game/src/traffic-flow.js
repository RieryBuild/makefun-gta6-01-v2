// Traffic: cars that drive the streets, and cars parked to be stolen.
// One job: keep the roads alive — moving cars follow the street grid in
// their lanes, brake for the car ahead, and wrap to a fresh street at the
// edge of town; parked cars wait by the kerb, including Dana's own van and
// the Kings' sports car at the beach lot.

import { CITY_LIFE, STREET_LINES } from './settings.js';
import { createAutomobile, updateAutomobile } from './automobile.js';

// Right-hand traffic: the lane offset for a street, given its axis and
// direction of travel. Facing +z (south) the right lane is -x; facing +x
// (east) the right lane is +z.
function laneOffset(axis, dir) {
  if (axis === 'z') return dir > 0 ? -3.4 : 3.4;
  return dir > 0 ? 3.4 : -3.4;
}

export class TrafficFlow {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.moving = [];  // { car, x, z, heading, speed, street, axis, dir, cruise }
    this.parked = [];  // { car, x, z, heading, taken, own }
  }

  spawnAll() {
    // Dana's own courier van, parked by the garage — free to drive, no heat.
    this.addParkedCar(-14, -43, Math.PI / 2, 'van', true);
    // The Kings' prize sports car at the beach lot (mission 2's target).
    this.addParkedCar(8, 148, Math.PI / 2, 'sports', false, 0xc23a2e);
    // A scattering of parked cars along the kerbs.
    const spots = [
      [-53.5, -100, 0], [53.5, -52, Math.PI], [-100.5, 52, Math.PI / 2], [100.5, 100, -Math.PI / 2],
      [-5.5, 100, 0], [42.5, -148, Math.PI], [-148.5, -4, Math.PI / 2], [148.5, 52, -Math.PI / 2],
      [100.5, -148, 0], [-42.5, 148, Math.PI], [5.5, -148, Math.PI / 2], [-100.5, -100, 0],
    ];
    for (const [x, z, heading] of spots) {
      const type = this.rng.pick(['sedan', 'sedan', 'sedan', 'pickup', 'taxi']);
      this.addParkedCar(x, z, heading, type, false);
    }
    for (let i = 0; i < CITY_LIFE.traffic; i += 1) this.spawnMovingCar(true);
  }

  addParkedCar(x, z, heading, type, own = false, color) {
    const car = createAutomobile(this.rng.fork(300 + this.parked.length * 7), type, color);
    car.group.position.set(x, 0, z);
    car.group.rotation.y = heading;
    this.scene.add(car.group);
    const parked = { car, x, z, heading, taken: false, own };
    this.parked.push(parked);
    return parked;
  }

  // A moving car on a random street, placed anywhere (or near a point).
  spawnMovingCar(anywhere, nearX = 0, nearZ = 0) {
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    const street = this.rng.pick(STREET_LINES);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const along = anywhere
      ? this.rng.range(-180, 180)
      : THREE.MathUtils.clamp(nearX + this.rng.range(-60, 60), -180, 180);
    const offset = laneOffset(axis, dir);
    const x = axis === 'z' ? street + offset : along;
    const z = axis === 'z' ? along : street + offset;
    const heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const type = this.rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'pickup', 'van', 'sports']);
    const car = createAutomobile(this.rng.fork(400 + this.moving.length * 13), type);
    car.group.position.set(x, 0, z);
    car.group.rotation.y = heading;
    this.scene.add(car.group);
    const entry = {
      car, x, z, heading, axis, dir, street,
      speed: CITY_LIFE.trafficSpeed * this.rng.range(0.8, 1.15),
      cruise: CITY_LIFE.trafficSpeed * this.rng.range(0.8, 1.15),
    };
    this.moving.push(entry);
    return entry;
  }

  nearestParkedCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const parked of this.parked) {
      if (parked.taken) continue;
      const dist = Math.hypot(parked.x - x, parked.z - z);
      if (dist < bestDist) { best = parked; bestDist = dist; }
    }
    return best;
  }

  // Circles for collision: every car the player could hit, moving or parked.
  carCircles() {
    const circles = [];
    for (const entry of this.moving) circles.push({ x: entry.x, z: entry.z, r: 2.4 });
    for (const parked of this.parked) {
      if (!parked.taken) circles.push({ x: parked.x, z: parked.z, r: 2.4 });
    }
    return circles;
  }

  // Is anything stopped in front of this car on its street?
  blockedAhead(entry, playerCar) {
    const aheadX = entry.x + Math.sin(entry.heading) * 8;
    const aheadZ = entry.z + Math.cos(entry.heading) * 8;
    for (const other of this.moving) {
      if (other === entry) continue;
      if (Math.hypot(other.x - aheadX, other.z - aheadZ) < 4.5) return true;
    }
    for (const parked of this.parked) {
      if (parked.taken) continue;
      if (Math.hypot(parked.x - aheadX, parked.z - aheadZ) < 4.5) return true;
    }
    if (playerCar && Math.hypot(playerCar.x - aheadX, playerCar.z - aheadZ) < 5) return true;
    return false;
  }

  update(dt, context) {
    for (let i = this.moving.length - 1; i >= 0; i -= 1) {
      const entry = this.moving[i];
      const blocked = this.blockedAhead(entry, context.playerCar);
      const target = blocked ? 0 : entry.cruise;
      entry.speed += (target - entry.speed) * Math.min(1, dt * (blocked ? 4 : 1.2));
      entry.x += Math.sin(entry.heading) * entry.speed * dt;
      entry.z += Math.cos(entry.heading) * entry.speed * dt;
      // At the edge of town the car turns onto a fresh street — in practice
      // it respawns on another street, far from the player's view.
      const along = entry.axis === 'z' ? entry.z : entry.x;
      if (Math.abs(along) > 186) {
        this.scene.remove(entry.car.group);
        this.moving.splice(i, 1);
        this.spawnMovingCar(true);
        continue;
      }
      entry.car.group.position.set(entry.x, 0, entry.z);
      entry.car.group.rotation.y = entry.heading;
      updateAutomobile(entry.car, entry.speed, 0, dt);
    }
    // Keep the streets full: replace any car the player stole or wrecked.
    while (this.moving.length < CITY_LIFE.traffic) this.spawnMovingCar(true);
  }
}
