// Vehicles: modelled multi-part cars, not boxes with stripes.
// One job: build a car that reads as a car — a distinct hood, a glass cabin
// with pillars and a roof, four wheels with alloy hubs that spin and steer,
// headlights and taillights, bumpers and mirrors. The police cruiser reads
// as a police car: two-tone livery, a light bar, SBPD door roundels.
//
// Forward is +Z at rotation.y = 0. Dimensions in metres; a sedan is ~4.4
// long, ~1.86 wide, ~1.45 tall at the roof.

import { wheelFaceTexture, policeDoorTexture } from './surfaces.js';

export const PAINT_JOBS = [
  0xc23a2e, 0x2e6ac2, 0xe8e4da, 0x1e1e22, 0x3a8a4a, 0xd9a13a,
  0x7a4a9e, 0x4a9aa8, 0xc26a8a, 0x8a8d90, 0x2a4a6a, 0xb85c38,
];

export const CAR_NAMES = {
  sedan: 'Solmar Sedan', sports: 'Marlin GT', van: 'Dockside Van',
  taxi: 'Bay Cab', police: 'SBPD Interceptor', pickup: 'Harbor Pickup',
};

let wheelFace = null;
let doorDecal = null;

function tireMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9, metalness: 0 });
}

function hubMaterial() {
  if (!wheelFace) wheelFace = wheelFaceTexture();
  return new THREE.MeshStandardMaterial({ map: wheelFace, roughness: 0.35, metalness: 0.7 });
}

// One wheel: a tyre cylinder with alloy faces on both caps, inside a pivot
// group the car steers (front) and spins (all four).
function buildWheel(radius, width) {
  const pivot = new THREE.Group();
  const spinner = new THREE.Group();
  pivot.add(spinner);
  const geometry = new THREE.CylinderGeometry(radius, radius, width, 20);
  const wheel = new THREE.Mesh(geometry, [tireMaterial(), hubMaterial(), hubMaterial()]);
  wheel.rotation.z = Math.PI / 2;
  wheel.castShadow = true;
  spinner.add(wheel);
  return { pivot, spinner };
}

function paintMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.32, metalness: 0.65,
  });
}

function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x18242e, roughness: 0.08, metalness: 0.9,
    transparent: true, opacity: 0.92,
  });
}

function trimMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5, metalness: 0.4 });
}

function chromeMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.25, metalness: 0.9 });
}

// A lamp lens: emissive when the lights are on, dim glass when not.
function lampMesh(width, height, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0x222222, emissive: color, emissiveIntensity: 1.6, roughness: 0.3,
    }),
  );
  return mesh;
}

// The passenger cabin: glasshouse + roof + pillars, so the car has a real
// silhouette instead of a painted stripe.
function buildCabin(paint, glass, length, width, height, z, y) {
  const cabin = new THREE.Group();
  const glasshouse = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), glass);
  glasshouse.position.set(0, y, z);
  glasshouse.castShadow = true;
  cabin.add(glasshouse);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.07, length * 0.82), paint);
  roof.position.set(0, y + height / 2 + 0.02, z);
  roof.castShadow = true;
  cabin.add(roof);
  // Pillars: A (front), B (middle), C (rear) on both sides.
  for (const side of [-1, 1]) {
    for (const [pz, tilt] of [[length / 2 - 0.12, 0.28], [0, 0], [-length / 2 + 0.12, -0.22]]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, height + 0.04, 0.09), paint);
      pillar.position.set(side * (width / 2 - 0.02), y, z + pz);
      pillar.rotation.x = tilt;
      cabin.add(pillar);
    }
  }
  return cabin;
}

// ---- The car itself ----
export function createAutomobile(rng, type, color) {
  const paintColor = color ?? rng.pick(PAINT_JOBS);
  const paint = paintMaterial(type === 'police' ? 0x14161c : paintColor);
  const glass = glassMaterial();
  const trim = trimMaterial();
  const group = new THREE.Group();
  const wheels = [];
  const steerPivots = [];
  let lightBar = null;

  const dims = {
    sedan: { len: 4.4, wid: 1.86, bodyH: 0.52, bodyY: 0.62, cabinLen: 2.1, cabinZ: -0.25, wheelR: 0.34 },
    sports: { len: 4.5, wid: 1.94, bodyH: 0.46, bodyY: 0.56, cabinLen: 1.9, cabinZ: -0.35, wheelR: 0.35 },
    taxi: { len: 4.4, wid: 1.86, bodyH: 0.52, bodyY: 0.62, cabinLen: 2.1, cabinZ: -0.25, wheelR: 0.34 },
    police: { len: 4.5, wid: 1.9, bodyH: 0.54, bodyY: 0.63, cabinLen: 2.1, cabinZ: -0.25, wheelR: 0.35 },
    van: { len: 4.9, wid: 1.96, bodyH: 1.15, bodyY: 0.95, cabinLen: 2.6, cabinZ: 0.3, wheelR: 0.36 },
    pickup: { len: 4.8, wid: 1.92, bodyH: 0.6, bodyY: 0.7, cabinLen: 1.5, cabinZ: 0.45, wheelR: 0.38 },
  }[type] || { len: 4.4, wid: 1.86, bodyH: 0.52, bodyY: 0.62, cabinLen: 2.1, cabinZ: -0.25, wheelR: 0.34 };

  // Lower body: the slab everything else sits on.
  const body = new THREE.Mesh(new THREE.BoxGeometry(dims.wid, dims.bodyH, dims.len), paint);
  body.position.y = dims.bodyY;
  body.castShadow = true;
  group.add(body);
  // Hood: a sloped panel ahead of the cabin (vans and pickups slope less).
  if (type !== 'van') {
    const hoodLen = type === 'pickup' ? 1.2 : 1.35;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(dims.wid - 0.06, 0.1, hoodLen), paint);
    hood.position.set(0, dims.bodyY + dims.bodyH / 2 + 0.02, dims.len / 2 - hoodLen / 2 - 0.05);
    hood.rotation.x = type === 'sports' ? -0.09 : -0.05;
    hood.castShadow = true;
    group.add(hood);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(dims.wid - 0.06, 0.08, 0.9), paint);
    deck.position.set(0, dims.bodyY + dims.bodyH / 2 + 0.02, -dims.len / 2 + 0.5);
    group.add(deck);
  }
  // Cabin: glasshouse, roof, pillars.
  const cabinY = dims.bodyY + dims.bodyH / 2 + (type === 'van' ? 0.32 : 0.28);
  const cabinH = type === 'van' ? 0.62 : 0.52;
  group.add(buildCabin(paint, glass, dims.cabinLen, dims.wid - 0.18, cabinH, dims.cabinZ, cabinY));
  // Bumpers, front and rear.
  for (const side of [1, -1]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(dims.wid + 0.04, 0.16, 0.16), trim);
    bumper.position.set(0, 0.42, side * (dims.len / 2 + 0.04));
    bumper.castShadow = true;
    group.add(bumper);
    const chrome = new THREE.Mesh(new THREE.BoxGeometry(dims.wid + 0.02, 0.04, 0.04), chromeMaterial());
    chrome.position.set(0, 0.47, side * (dims.len / 2 + 0.13));
    group.add(chrome);
  }
  // Grille + headlights (front) and taillights (rear).
  const grille = new THREE.Mesh(new THREE.BoxGeometry(dims.wid * 0.5, 0.14, 0.05), trim);
  grille.position.set(0, dims.bodyY + 0.05, dims.len / 2 + 0.02);
  group.add(grille);
  for (const side of [-1, 1]) {
    const head = lampMesh(0.34, 0.13, 0xfff2c0);
    head.position.set(side * (dims.wid / 2 - 0.3), dims.bodyY + 0.08, dims.len / 2 + 0.03);
    group.add(head);
    const tail = lampMesh(0.44, 0.17, 0xff2a22);
    tail.position.set(side * (dims.wid / 2 - 0.32), dims.bodyY + 0.08, -dims.len / 2 - 0.03);
    group.add(tail);
    // Mirrors on stalks at the cabin's front corners.
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), trim);
    stalk.position.set(side * (dims.wid / 2 + 0.04), cabinY + 0.1, dims.cabinZ + dims.cabinLen / 2 - 0.15);
    group.add(stalk);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.18), paint);
    mirror.position.set(side * (dims.wid / 2 + 0.11), cabinY + 0.12, dims.cabinZ + dims.cabinLen / 2 - 0.15);
    mirror.castShadow = true;
    group.add(mirror);
  }
  // Wheels: front axle steers, all four spin.
  const axleF = dims.len / 2 - 0.95;
  const axleR = -dims.len / 2 + 0.95;
  for (const [x, z, steers] of [
    [-dims.wid / 2 + 0.08, axleF, true], [dims.wid / 2 - 0.08, axleF, true],
    [-dims.wid / 2 + 0.08, axleR, false], [dims.wid / 2 - 0.08, axleR, false],
  ]) {
    const wheel = buildWheel(dims.wheelR, 0.26);
    wheel.pivot.position.set(x, dims.wheelR, z);
    group.add(wheel.pivot);
    wheels.push(wheel.spinner);
    if (steers) steerPivots.push(wheel.pivot);
  }

  if (type === 'sports') {
    // Rear wing on twin struts.
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.08), trim);
      strut.position.set(side * 0.6, dims.bodyY + dims.bodyH / 2 + 0.14, -dims.len / 2 + 0.35);
      group.add(strut);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.42), paint);
    wing.position.set(0, dims.bodyY + dims.bodyH / 2 + 0.28, -dims.len / 2 + 0.35);
    wing.rotation.x = -0.12;
    wing.castShadow = true;
    group.add(wing);
    // A full-width rear light bar: the sports car reads from behind at dusk.
    const lightBar = lampMesh(dims.wid - 0.5, 0.09, 0xff2a22);
    lightBar.position.set(0, dims.bodyY + 0.28, -dims.len / 2 - 0.02);
    group.add(lightBar);
    // Side skirts.
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, dims.len * 0.55), trim);
      skirt.position.set(side * (dims.wid / 2 + 0.01), 0.3, -0.1);
      group.add(skirt);
    }
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc23a, emissiveIntensity: 1.4 }),
    );
    sign.position.set(0, cabinY + cabinH / 2 + 0.12, dims.cabinZ);
    group.add(sign);
  }
  if (type === 'police') {
    // Two-tone livery: white doors and roof band over the black body.
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, dims.bodyH * 0.82, 2.0),
        new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.35, metalness: 0.5 }),
      );
      door.position.set(side * (dims.wid / 2 + 0.005), dims.bodyY, -0.1);
      group.add(door);
      if (!doorDecal) doorDecal = policeDoorTexture();
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.85),
        new THREE.MeshBasicMaterial({ map: doorDecal, transparent: true }),
      );
      decal.position.set(side * (dims.wid / 2 + 0.03), dims.bodyY + 0.02, -0.1);
      decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(decal);
    }
    // Light bar: red left, blue right, flashing in the update.
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.3), trim);
    barBase.position.set(0, cabinY + cabinH / 2 + 0.1, dims.cabinZ + 0.2);
    group.add(barBase);
    const red = lampMesh(0.68, 0.2, 0xff2020);
    red.position.set(-0.38, cabinY + cabinH / 2 + 0.22, dims.cabinZ + 0.2);
    red.material.emissiveIntensity = 3.2;
    const blue = lampMesh(0.68, 0.2, 0x2040ff);
    blue.position.set(0.38, cabinY + cabinH / 2 + 0.22, dims.cabinZ + 0.2);
    blue.material.emissiveIntensity = 3.2;
    group.add(red, blue);
    lightBar = { red, blue };
    // White hood + a white band across the nose: head-on, the cruiser must
    // read as black-and-white, not as a dark sedan.
    const whitePaint = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.35, metalness: 0.5 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(dims.wid - 0.15, 0.03, 1.3), whitePaint);
    hood.position.set(0, dims.bodyY + dims.bodyH / 2 + 0.01, dims.len / 2 - 0.75);
    group.add(hood);
    const noseBand = new THREE.Mesh(new THREE.BoxGeometry(dims.wid - 0.1, 0.12, 0.03), whitePaint);
    noseBand.position.set(0, dims.bodyY + dims.bodyH / 2 - 0.06, dims.len / 2 + 0.01);
    group.add(noseBand);
  }
  if (type === 'pickup') {
    // Open bed with side walls behind the cabin.
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 1.9), paint);
      wall.position.set(side * (dims.wid / 2 - 0.06), dims.bodyY + dims.bodyH / 2 + 0.16, -1.3);
      wall.castShadow = true;
      group.add(wall);
    }
    const tailgate = new THREE.Mesh(new THREE.BoxGeometry(dims.wid - 0.1, 0.35, 0.08), paint);
    tailgate.position.set(0, dims.bodyY + dims.bodyH / 2 + 0.16, -dims.len / 2 + 0.08);
    group.add(tailgate);
  }
  if (type === 'van') {
    // Sliding-door seam + a roof rack.
    for (const side of [-1, 1]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.8, 0.03), trim);
      seam.position.set(side * (dims.wid / 2 + 0.005), 1.0, 0.9);
      group.add(seam);
    }
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.4), trim);
    rack.position.set(0, cabinY + cabinH / 2 + 0.08, -0.3);
    group.add(rack);
  }

  return {
    group, wheels, steerPivots, lightBar,
    type, name: CAR_NAMES[type] || 'Car',
    wheelRadius: dims.wheelR, length: dims.len, width: dims.wid,
  };
}

// Spin the wheels with road speed; ease the front pivots toward the steer.
export function updateAutomobile(car, speed, steer, dt) {
  const spin = (speed / car.wheelRadius) * dt;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  const target = THREE.MathUtils.clamp(steer, -0.55, 0.55);
  for (const pivot of car.steerPivots) {
    pivot.rotation.y += (target - pivot.rotation.y) * Math.min(1, dt * 10);
  }
}

// Alternate the light bar red/blue, twice a second.
export function flashLightBar(car, time) {
  if (!car.lightBar) return;
  const phase = Math.sin(time * 12) > 0;
  car.lightBar.red.material.emissiveIntensity = phase ? 3.2 : 0.15;
  car.lightBar.blue.material.emissiveIntensity = phase ? 0.15 : 3.2;
}
