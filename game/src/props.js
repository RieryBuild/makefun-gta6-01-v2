// Street props: the small geometry that makes a street a street.
// One job: palms with real fronds (never blob-on-stick), lamps that glow at
// dusk, hydrants, benches, planters, traffic lights that cycle, beach
// umbrellas, a ferris wheel, piers and boats — the detail the eye catches
// between the buildings. Small props carry no colliders; the big ones do.

import { STREET_LINES, blockMiddle } from './settings.js';
import { containerTexture, frondTexture, plankTexture } from './surfaces.js';

let frondTex = null;

// ---- Palms: a curved trunk and drooping fronds ----
function palmFrondGeometry() {
  const geo = new THREE.PlaneGeometry(0.55, 2.6, 1, 6);
  geo.translate(0, 1.3, 0); // base at the origin, tip at +2.6
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const t = y / 2.6;
    pos.setZ(i, -(t * t) * 1.1);          // droop toward the tip
    pos.setX(i, pos.getX(i) * (1 - t * 0.45)); // taper
  }
  geo.computeVertexNormals();
  return geo;
}

let frondGeo = null;

export function buildPalm(rng, height = 7) {
  if (!frondGeo) frondGeo = palmFrondGeometry();
  if (!frondTex) frondTex = frondTexture();
  const palm = new THREE.Group();
  // Trunk: a gentle curve, leaning toward the sea breeze.
  const lean = rng.range(-0.6, 0.6);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.3, height * 0.5, 0),
    new THREE.Vector3(lean, height, 0),
  ]);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 8, 0.16, 7),
    new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 }),
  );
  trunk.castShadow = true;
  palm.add(trunk);
  // Fronds: 8-10, fanned around the crown, drooping.
  const crown = new THREE.Group();
  crown.position.set(lean, height, 0);
  palm.add(crown);
  const frondMat = new THREE.MeshStandardMaterial({
    map: frondTex, side: THREE.DoubleSide, roughness: 0.85,
    alphaTest: 0.4, color: 0xbfe0a0,
  });
  const count = 8 + rng.int(0, 2);
  for (let i = 0; i < count; i += 1) {
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.rotation.y = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
    frond.rotation.x = rng.range(0.5, 1.0); // tilt out and down
    frond.rotation.order = 'YXZ';
    frond.castShadow = true;
    crown.add(frond);
  }
  // Coconuts: a cluster under the crown.
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
  for (let i = 0; i < 3; i += 1) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), nutMat);
    nut.position.set(rng.range(-0.2, 0.2), -0.15, rng.range(-0.2, 0.2));
    crown.add(nut);
  }
  return palm;
}

// ---- Park trees: trunk + layered foliage (three offset crowns) ----
export function buildParkTree(rng, height = 5.5) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, height * 0.55, 7),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.95 }),
  );
  trunk.position.y = height * 0.27;
  trunk.castShadow = true;
  tree.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4a7a2e, roughness: 0.95, flatShading: true,
  });
  const leafMat2 = new THREE.MeshStandardMaterial({
    color: 0x5d8a3a, roughness: 0.95, flatShading: true,
  });
  const crowns = [
    [0, height * 0.72, 0, 2.2, leafMat],
    [1.1, height * 0.6, 0.5, 1.5, leafMat2],
    [-1.0, height * 0.62, -0.4, 1.4, leafMat2],
    [0.2, height * 0.88, -0.3, 1.3, leafMat],
  ];
  for (const [x, y, z, r, mat] of crowns) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    crown.position.set(x, y, z);
    crown.castShadow = true;
    tree.add(crown);
  }
  return tree;
}

// ---- Street lamps: pole, curved arm, glowing head, pool of light ----
function buildLamp() {
  const lamp = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 8), poleMat);
  pole.position.y = 3.25;
  pole.castShadow = true;
  lamp.add(pole);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 12, Math.PI / 2), poleMat);
  arm.position.set(0, 6.5, 0);
  arm.rotation.y = Math.PI / 2;
  lamp.add(arm);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4, metalness: 0.6 }),
  );
  head.position.set(0, 7.5, 1.1);
  lamp.add(head);
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.06, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 2.4 }),
  );
  bulb.position.set(0, 7.4, 1.1);
  lamp.add(bulb);
  // A soft pool of light on the ground beneath.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffc98a, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.06, 1.1);
  lamp.add(pool);
  return lamp;
}

// ---- Small props ----
function buildHydrant() {
  const hydrant = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.55, 10), red);
  body.position.y = 0.3;
  body.castShadow = true;
  hydrant.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), red);
  cap.position.y = 0.6;
  hydrant.add(cap);
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), red);
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(side * 0.17, 0.42, 0);
    hydrant.add(nozzle);
  }
  return hydrant;
}

function buildBench() {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.7 });
  for (let s = 0; s < 3; s += 1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.14), wood);
    slat.position.set(0, 0.45, -0.16 + s * 0.16);
    slat.castShadow = true;
    bench.add(slat);
  }
  for (let s = 0; s < 2; s += 1) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.05), wood);
    back.position.set(0, 0.68 + s * 0.16, -0.28);
    back.rotation.x = -0.15;
    bench.add(back);
  }
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.5), iron);
    leg.position.set(side * 0.8, 0.22, 0);
    bench.add(leg);
  }
  return bench;
}

function buildPlanter(rng) {
  const planter = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.55, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.95 }),
  );
  box.position.y = 0.28;
  box.castShadow = true;
  planter.add(box);
  const bush = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({ color: 0x4a7a2e, roughness: 0.95, flatShading: true }),
  );
  bush.position.y = 0.85;
  bush.scale.y = 0.75;
  bush.castShadow = true;
  planter.add(bush);
  return planter;
}

// ---- Traffic lights: pole, head, three lenses that cycle ----
function buildTrafficLight() {
  const light = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5.4, 8), poleMat);
  pole.position.y = 2.7;
  pole.castShadow = true;
  light.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6), poleMat);
  arm.position.set(0, 5.3, 1.2);
  light.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.3), poleMat);
  head.position.set(0, 4.7, 2.3);
  head.castShadow = true;
  light.add(head);
  const lenses = {};
  const colors = { red: 0xff2a22, amber: 0xffb02a, green: 0x2aff5a };
  let i = 0;
  for (const [name, color] of Object.entries(colors)) {
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: color, emissiveIntensity: 0.1 }),
    );
    lens.position.set(0, 5.05 - i * 0.36, 2.46);
    light.add(lens);
    lenses[name] = lens;
    i += 1;
  }
  return { group: light, lenses };
}

// ---- Beach umbrellas: striped cones on poles, with a towel ----
function buildUmbrella(rng) {
  const umbrella = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 }),
  );
  pole.position.y = 1.1;
  umbrella.add(pole);
  const colours = [[0xc23a2e, 0xf0e8d8], [0x2e6ac2, 0xf0e8d8], [0x3a8a4a, 0xffe8a0], [0xd9a13a, 0xc23a2e]];
  const [a, b] = rng.pick(colours);
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 0.5, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: a, side: THREE.DoubleSide, roughness: 0.9 }),
  );
  canopy.position.y = 2.2;
  canopy.castShadow = true;
  umbrella.add(canopy);
  // Alternate panels in the second colour, faked with thin cone slices.
  for (let i = 0; i < 6; i += 1) {
    const slice = new THREE.Mesh(
      new THREE.ConeGeometry(1.51, 0.5, 1, 1, true, (i * 2 * Math.PI) / 12, Math.PI / 6),
      new THREE.MeshStandardMaterial({ color: b, side: THREE.DoubleSide, roughness: 0.9 }),
    );
    slice.position.y = 2.2;
    umbrella.add(slice);
  }
  const towel = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.03, 1.8),
    new THREE.MeshStandardMaterial({ color: rng.pick([0x4a9aa8, 0xd94a8a, 0xe8c84a]), roughness: 0.95 }),
  );
  towel.position.set(0.9, 0.05, 0.6);
  towel.rotation.y = rng.range(-0.4, 0.4);
  umbrella.add(towel);
  return umbrella;
}

// ---- The ferris wheel: rims, spokes, cabins that stay upright ----
function buildFerrisWheel(scene) {
  const root = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.4, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.5, metalness: 0.3 });
  for (const side of [-1, 1]) {
    for (const lean of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 15, 0.5), frameMat);
      leg.position.set(side * 1.2, 7, lean * 4.5);
      leg.rotation.x = lean * 0.32;
      leg.castShadow = true;
      root.add(leg);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 12), accentMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.y = 13.5;
  root.add(hub);
  const wheel = new THREE.Group();
  wheel.position.y = 13.5;
  root.add(wheel);
  for (const zoff of [-0.9, 0.9]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.22, 8, 48), frameMat);
    rim.position.z = zoff;
    rim.castShadow = true;
    wheel.add(rim);
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 11, 6), frameMat);
    spoke.position.set(Math.cos(a) * 5.5, Math.sin(a) * 5.5, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    // Rim lights: warm bulbs around the wheel.
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x222222, emissive: i % 2 === 0 ? 0xffb85e : 0xff5a7a, emissiveIntensity: 2.2,
      }),
    );
    bulb.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0.9);
    wheel.add(bulb);
  }
  // Cabins hang from the rim and stay upright: their positions update in tick().
  const cabins = [];
  for (let i = 0; i < 8; i += 1) {
    const cabin = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.5, 1.4),
      new THREE.MeshStandardMaterial({ color: [0xc23a2e, 0x2e6ac2, 0x3a8a4a, 0xd9a13a][i % 4], roughness: 0.6 }),
    );
    box.castShadow = true;
    cabin.add(box);
    const roofC = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.6), frameMat);
    roofC.position.y = 0.85;
    cabin.add(roofC);
    root.add(cabin);
    cabins.push(cabin);
  }
  root.position.set(60, 0, 214);
  scene.add(root);
  let angle = 0;
  return {
    tick(dt) {
      angle += dt * 0.12;
      wheel.rotation.z = angle;
      for (let i = 0; i < 8; i += 1) {
        const a = angle + (i / 8) * Math.PI * 2;
        cabins[i].position.set(Math.cos(a) * 11, 13.5 + Math.sin(a) * 11 - 1.2, 0);
      }
    },
  };
}

// ---- Piers: plank decks on posts, with railings and lamps ----
function buildPier(scene, rng, z, length) {
  const pier = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.3, 6),
    new THREE.MeshStandardMaterial({ map: plankTexture(rng), roughness: 0.9 }),
  );
  deck.position.set(200 + length / 2, 0, z);
  deck.receiveShadow = true;
  pier.add(deck);
  for (let x = 202; x < 200 + length; x += 8) {
    for (const side of [-2.6, 2.6]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }),
      );
      post.position.set(x, -0.9, z + side);
      pier.add(post);
    }
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.9 }),
    );
    rail.position.set(200 + length / 2, 1.05, z + side * 2.9);
    pier.add(rail);
    for (let x = 202; x < 200 + length; x += 4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), rail.material);
      post.position.set(x, 0.6, z + side * 2.9);
      pier.add(post);
    }
  }
  scene.add(pier);
}

// ---- Moored boats: hull, cabin, mast ----
function buildBoat(rng, x, z, heading) {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: rng.pick([0xe8e4da, 0x2e6ac2, 0xc23a2e]), roughness: 0.4, metalness: 0.2 });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), hullMat);
  hull.scale.set(0.7, 0.5, 2.2);
  hull.position.y = -0.1;
  hull.castShadow = true;
  boat.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.6 }),
  );
  cabin.position.set(0, 0.7, -0.3);
  cabin.castShadow = true;
  boat.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 5, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.4, metalness: 0.7 }),
  );
  mast.position.set(0, 2.5, 0.6);
  boat.add(mast);
  boat.position.set(x, -0.2, z);
  boat.rotation.y = heading;
  return boat;
}

// ---- Dock containers: ribbed steel boxes, stacked ----
function buildContainers(scene, rng, colliders) {
  const colours = ['#a83a2e', '#2e6a8a', '#3a7a4a', '#b89a2e', '#6a4a8a', '#8a5a2a'];
  const spots = [
    [160, 108, 0], [168, 108, 0], [176, 108, 0.4], [160, 116, 0.2],
    [172, 116, 0], [180, 116, -0.3], [164, 124, 0], [176, 126, 0.2],
    [158, 132, 0], [170, 134, 0.5], [182, 132, 0], [164, 96, 0],
  ];
  for (const [x, z, rot] of spots) {
    const stack = rng.chance(0.35) ? 2 : 1;
    for (let s = 0; s < stack; s += 1) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.6, 2.6),
        new THREE.MeshStandardMaterial({ map: containerTexture(rng.pick(colours), rng), roughness: 0.7, metalness: 0.3 }),
      );
      box.position.set(x, 1.3 + s * 2.6, z);
      box.rotation.y = rot;
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
    }
    colliders.push({ x, z, hw: 3.2, hd: 1.6 });
  }
  // A second cluster by the north docks, where the Kings make their stand —
  // the combat apron needs cover objects, not an empty slab.
  const northSpots = [[172, -34, 0.2], [180, -38, 0], [168, 12, -0.2], [176, 16, 0.3]];
  for (const [x, z, rot] of northSpots) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ map: containerTexture(rng.pick(colours), rng), roughness: 0.7, metalness: 0.3 }),
    );
    box.position.set(x, 1.3, z);
    box.rotation.y = rot;
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    colliders.push({ x, z, hw: 3.2, hd: 1.6 });
  }
  // Crates and barrels scattered between the containers.
  const crateMat = new THREE.MeshStandardMaterial({ map: plankTexture(rng), roughness: 0.9 });
  for (const [x, z] of [[186, -30], [188, -4], [178, -24], [172, 2], [196, -12], [200, -32], [202, 16]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), crateMat);
    crate.position.set(x, 0.65, z);
    crate.rotation.y = rng.range(0, Math.PI);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    colliders.push({ x, z, hw: 0.75, hd: 0.75 });
  }
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x7a6a3a, roughness: 0.6, metalness: 0.4 });
  for (const [x, z] of [[190, -32], [180, 6], [170, -18], [198, 2], [204, -18]]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 12), barrelMat);
    barrel.position.set(x, 0.52, z);
    barrel.castShadow = true;
    scene.add(barrel);
    colliders.push({ x, z, hw: 0.5, hd: 0.5 });
  }
}

// ---- The dock crane: legs, cab, a long jib over the water ----
function buildCrane(scene, colliders) {
  const crane = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd9a13a, roughness: 0.6, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.6 });
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 16, 0.6), yellow);
    leg.position.set(lx, 8, lz);
    leg.castShadow = true;
    crane.add(leg);
  }
  const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), yellow);
  cab.position.y = 17.5;
  cab.castShadow = true;
  crane.add(cab);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.4, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.1, metalness: 0.8 }),
  );
  glass.position.set(0, 17.8, 2.05);
  crane.add(glass);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 26), yellow);
  jib.position.set(0, 21.5, 12);
  jib.rotation.x = 0.32;
  jib.castShadow = true;
  crane.add(jib);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 7), dark);
  counter.position.set(0, 20.5, -5.5);
  counter.rotation.x = -0.25;
  crane.add(counter);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 9, 4), dark);
  cable.position.set(0, 18.5, 21.5);
  crane.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), dark);
  hook.position.set(0, 13.8, 21.5);
  hook.castShadow = true;
  crane.add(hook);
  crane.position.set(196, 0, 96);
  scene.add(crane);
  colliders.push({ x: 196, z: 96, hw: 3.6, hd: 3.6 });
}

// ---- The lighthouse: Solmar Bay's signature landmark ----
// Coral-and-white bands over a stone base, a glass lamp room, and two
// rotating beams. It stands at the end of the middle pier, closing the
// z = 0 boulevard with a vanishing point the whole city can see.
function buildLighthouse(scene) {
  const tower = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95 });
  const coral = new THREE.MeshStandardMaterial({ color: 0xd9554a, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2ead9, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e2622, roughness: 0.6, metalness: 0.3 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 3, 16), stone);
  base.position.y = 1.5;
  base.castShadow = true;
  tower.add(base);
  // Five tapering bands, alternating coral and white.
  const bands = 5;
  for (let i = 0; i < bands; i += 1) {
    const radiusTop = 2.05 - (i + 1) * 0.15;
    const radiusBottom = 2.05 - i * 0.15;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, 3.2, 16),
      i % 2 === 0 ? coral : white,
    );
    band.position.y = 3 + 1.6 + i * 3.2;
    band.castShadow = true;
    tower.add(band);
  }
  // Gallery deck + railing, then the glass lamp room.
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.25, 16), dark);
  deck.position.y = 19.2;
  tower.add(deck);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.05, 6, 24), dark);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 20.1;
  tower.add(rail);
  const lampGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 2.2, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffe9b0, emissive: 0xffc95e, emissiveIntensity: 2.4, transparent: true, opacity: 0.9,
    }),
  );
  lampGlass.position.y = 20.4;
  tower.add(lampGlass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 12), dark);
  cap.position.y = 22.2;
  cap.castShadow = true;
  tower.add(cap);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dark);
  finial.position.y = 23.1;
  tower.add(finial);
  // A door facing the pier, and a warm light spilling from the lamp room.
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.2, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x3a2e28, roughness: 0.8 }),
  );
  door.position.set(-2.35, 1.1, 0);
  door.rotation.y = -Math.PI / 2;
  tower.add(door);
  const lampLight = new THREE.PointLight(0xffc95e, 1.1, 55);
  lampLight.position.y = 20.4;
  tower.add(lampLight);
  // Two beams, opposite directions, sweeping the bay.
  const beamGroup = new THREE.Group();
  beamGroup.position.y = 20.4;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9b0, transparent: true, opacity: 0.06,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const dir of [1, -1]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 44, 12, 1, true), beamMat);
    beam.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    beam.position.x = dir * 22;
    beamGroup.add(beam);
  }
  tower.add(beamGroup);
  tower.position.set(254, 0, 0);
  scene.add(tower);
  return {
    tick(dt) {
      beamGroup.rotation.y += dt * 0.35;
    },
  };
}

// ---- Assembly: place the props across the city ----
export function buildProps(scene, rng, colliders) {
  const tickers = [];
  const propRng = rng.fork(55);

  // Palms: the beach promenade, Marlin Street, the beach lot, the hideout.
  for (let x = -180; x <= 180; x += 22) {
    const palm = buildPalm(propRng, propRng.range(6, 8.5));
    palm.position.set(x + propRng.range(-3, 3), 0, 196 + propRng.range(-2, 3));
    palm.rotation.y = propRng.range(0, Math.PI * 2);
    scene.add(palm);
  }
  for (let z = -168; z <= 168; z += 24) {
    for (const side of [-9.5, 9.5]) {
      if (propRng.chance(0.25)) continue;
      const palm = buildPalm(propRng, propRng.range(5.5, 7.5));
      palm.position.set(side + propRng.range(-1, 1), 0, z + propRng.range(-3, 3));
      palm.rotation.y = propRng.range(0, Math.PI * 2);
      scene.add(palm);
    }
  }
  for (const spot of [[-4, 156], [20, 156], [146, 138], [162, 138], [138, 158]]) {
    const palm = buildPalm(propRng, propRng.range(6, 8));
    palm.position.set(spot[0], 0, spot[1]);
    scene.add(palm);
  }

  // Park trees + benches in the two parks.
  for (const park of [[72, 72], [-120, -72]]) {
    for (let i = 0; i < 7; i += 1) {
      const tree = buildParkTree(propRng, propRng.range(4.5, 6.5));
      tree.position.set(park[0] + propRng.range(-14, 14), 0, park[1] + propRng.range(-14, 14));
      tree.rotation.y = propRng.range(0, Math.PI * 2);
      scene.add(tree);
    }
    for (let i = 0; i < 3; i += 1) {
      const bench = buildBench();
      bench.position.set(park[0] + propRng.range(-12, 12), 0, park[1] + propRng.range(-12, 12));
      bench.rotation.y = propRng.range(0, Math.PI * 2);
      scene.add(bench);
    }
  }

  // Lamps: one at every intersection corner, plus the beach promenade.
  for (const x of STREET_LINES) {
    for (const z of STREET_LINES) {
      const lamp = buildLamp();
      lamp.position.set(x + 8.5, 0, z + 8.5);
      lamp.rotation.y = Math.PI / 4;
      scene.add(lamp);
    }
  }
  for (let x = -168; x <= 168; x += 48) {
    const lamp = buildLamp();
    lamp.position.set(x, 0, 193);
    lamp.rotation.y = Math.PI;
    scene.add(lamp);
  }

  // Traffic lights at the four busiest crossings, cycling out of phase.
  const signals = [];
  const crossings = [[0, 0, 0], [0, -48, 3], [-48, 0, 6], [48, 48, 9]];

  for (let ci = 0; ci < crossings.length; ci += 1) {
    const spot = crossings[ci];
    const lampPost = buildTrafficLight();
    lampPost.group.position.set(spot[0] + 8.5, 0, spot[1] - 8.5);
    lampPost.group.rotation.y = Math.PI;
    scene.add(lampPost.group);
    const entry = { lenses: lampPost.lenses, phase: spot[2] };
    signals.push(entry);
  }

  tickers.push((dt, time) => {
    for (let i = 0; i < signals.length; i += 1) {
      const unit = signals[i];
      const cycle = (time + unit.phase) % 13.5;
      const lit = cycle < 6 ? 'green' : cycle < 7.5 ? 'amber' : 'red';
      const names = Object.keys(unit.lenses);
      for (let n = 0; n < names.length; n += 1) {
        const lens = unit.lenses[names[n]];
        lens.material.emissiveIntensity = names[n] === lit ? 2.6 : 0.08;
      }
    }
  });

  // Hydrants, planters and benches scattered along the sidewalks.
  for (let i = 0; i < 12; i += 1) {
    const hydrant = buildHydrant();
    const street = propRng.pick(STREET_LINES);
    hydrant.position.set(street + propRng.pick([-8.5, 8.5]), 0, propRng.range(-168, 168));
    scene.add(hydrant);
  }
  for (let i = 0; i < 10; i += 1) {
    const planter = buildPlanter(propRng);
    const street = propRng.pick(STREET_LINES);
    planter.position.set(propRng.range(-168, 168), 0, street + propRng.pick([-8.5, 8.5]));
    scene.add(planter);
  }

  // Beach umbrellas along the sand.
  for (let i = 0; i < 14; i += 1) {
    const umbrella = buildUmbrella(propRng);
    umbrella.position.set(propRng.range(-180, 180), 0, propRng.range(202, 226));
    umbrella.rotation.y = propRng.range(0, Math.PI * 2);
    scene.add(umbrella);
  }
  // Promenade benches facing the sea.
  for (let x = -150; x <= 150; x += 50) {
    const bench = buildBench();
    bench.position.set(x, 0, 194.5);
    bench.rotation.y = 0;
    scene.add(bench);
  }

  // The ferris wheel on the beach, and the three east piers.
  const wheel = buildFerrisWheel(scene);
  tickers.push((dt) => wheel.tick(dt));
  const pierSpecs = [[-60, 46], [0, 58], [60, 46]];
  for (let p = 0; p < pierSpecs.length; p += 1) {
    buildPier(scene, propRng, pierSpecs[p][0], pierSpecs[p][1]);
  }
  // A shack at the end of the middle pier.
  const shack = new THREE.Group();
  const shackBox = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 3.5),
    new THREE.MeshStandardMaterial({ map: plankTexture(propRng), roughness: 0.9 }),
  );
  shackBox.position.y = 1.6;
  shackBox.castShadow = true;
  shack.add(shackBox);
  const shackRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.2, 4.1),
    new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 }),
  );
  shackRoof.position.y = 3.2;
  shack.add(shackRoof);
  shack.position.set(244, 0, 0);
  scene.add(shack);
  colliders.push({ x: 244, z: 0, hw: 2.2, hd: 1.9 });

  // The lighthouse at the pier's end — the city's signature landmark.
  const lighthouse = buildLighthouse(scene);
  tickers.push((dt) => lighthouse.tick(dt));
  colliders.push({ x: 254, z: 0, hw: 2.7, hd: 2.7 });

  // Moored boats off the piers.
  const boatSpecs = [[232, -32, 0.4], [244, 28, -0.3], [226, 72, 0.9], [252, -70, 0.1]];
  for (let b = 0; b < boatSpecs.length; b += 1) {
    scene.add(buildBoat(propRng, boatSpecs[b][0], boatSpecs[b][1], boatSpecs[b][2]));
  }

  // Dock containers + crane.
  buildContainers(scene, propRng, colliders);
  buildCrane(scene, colliders);

  return { tick: (dt, time) => { for (let t = 0; t < tickers.length; t += 1) tickers[t](dt, time); } };
}
