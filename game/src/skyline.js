// The skyline: streets, sidewalks and buildings with varied silhouettes.
// One job: build a city that reads as a LAYERED place — five building
// archetypes (stucco walk-ups, glass mid-rises, brick warehouses, stepped
// towers, tile-roofed villas), setbacks, rooflines, balconies, awnings and
// lit shopfronts, over a street grid with markings and crosswalks. Never
// endless extruded boxes with window grids.
//
// Colliders are axis-aligned boxes; the gameplay asks three questions of
// them: push this circle out, is this point solid, can A see B.

import {
  BLOCK_HI, BLOCK_LO, CITY_HALF, FACADE_SETS, STREET_LINES, STREET_PITCH,
  STREET_WIDTH, blockMiddle,
} from './settings.js';
import {
  asphaltTexture, awningTexture, brickFacade, glassFacade, lawnTexture, roofTexture,
  shopSignTexture, sidewalkTexture, stuccoFacade, tileRoofTexture,
} from './surfaces.js';

const SHOP_NAMES = [
  ['MARLIN TACKLE', 'bait · rods · reels', '#1d4a6a', '#ffd9a0'],
  ['SOLMAR BAKERY', 'fresh since 1987', '#7a4a2a', '#ffe8c8'],
  ['PIER 9 DINER', 'open late', '#8a2f3a', '#ffffff'],
  ['SUNSET SURF', 'boards & wax', '#2a6a7a', '#ffe8a0'],
  ['CORAL HOTEL', 'rooms · pool · bar', '#6a4a7a', '#ffd9a0'],
  ['TACO MAR', 'seafood tacos', '#a86a1a', '#ffffff'],
  ['NEON NAILS', 'salon', '#a82a6a', '#ffe8f0'],
  ['BAY BOOKS', 'new & used', '#2a5a3a', '#e8f0d8'],
  ['PALM PHARMACY', '24 hours', '#3a6a8a', '#ffffff'],
  ['GOLDEN HOUR CAFE', 'coffee · pastel', '#8a5a2a', '#ffe8c8'],
  ['REEF RECORDS', 'vinyl · tapes', '#4a3a6a', '#e8d8ff'],
  ['HARBOUR HARDWARE', 'tools · paint', '#5a5a5a', '#ffe8a0'],
];

// ---- Collision: axis-aligned boxes ----
export function resolveCircleCollisions(pos, radius, colliders) {
  for (const box of colliders) {
    const nearestX = Math.max(box.x - box.hw, Math.min(pos.x, box.x + box.hw));
    const nearestZ = Math.max(box.z - box.hd, Math.min(pos.z, box.z + box.hd));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      } else {
        // Dead centre: push out along the smallest overlap.
        const overlapX = box.hw + radius - Math.abs(pos.x - box.x);
        const overlapZ = box.hd + radius - Math.abs(pos.z - box.z);
        if (overlapX < overlapZ) pos.x += pos.x >= box.x ? overlapX : -overlapX;
        else pos.z += pos.z >= box.z ? overlapZ : -overlapZ;
      }
    }
  }
}

export function pointIsSolid(x, z, colliders) {
  for (const box of colliders) {
    if (Math.abs(x - box.x) <= box.hw && Math.abs(z - box.z) <= box.hd) return true;
  }
  return false;
}

// Does the segment (x1,z1)-(x2,z2) clear every collider? (Enemy line of fire.)
export function hasLineOfSight(x1, z1, x2, z2, colliders) {
  for (const box of colliders) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    let tMin = 0;
    let tMax = 1;
    for (const [origin, delta, lo, hi] of [
      [x1, dx, box.x - box.hw, box.x + box.hw],
      [z1, dz, box.z - box.hd, box.z + box.hd],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin < lo || origin > hi) { tMin = 1; tMax = 0; break; }
      } else {
        let t1 = (lo - origin) / delta;
        let t2 = (hi - origin) / delta;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) break;
      }
    }
    if (tMin <= tMax) return false;
  }
  return true;
}

// ---- Streets ----
function buildStreets(scene, rng) {
  // One asphalt sheet under the whole grid; the block slabs sit on top of
  // it, so the streets read as the gaps between sidewalks.
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 16, CITY_HALF * 2 + 16),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(rng), roughness: 0.94, metalness: 0 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.02;
  asphalt.receiveShadow = true;
  scene.add(asphalt);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd9b93a });
  const dashGeo = new THREE.PlaneGeometry(0.3, 3);
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe8e6e0 });
  const stripeGeo = new THREE.PlaneGeometry(0.9, 5.4);
  // Centre dashes along every street, crosswalks at every crossing.
  for (const line of STREET_LINES) {
    for (let along = -CITY_HALF + 8; along < CITY_HALF - 4; along += 8) {
      if (Math.abs(((along % STREET_PITCH) + STREET_PITCH) % STREET_PITCH) < 9) continue; // keep crossings clear
      const dashV = new THREE.Mesh(dashGeo, dashMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(line, 0.045, along);
      scene.add(dashV);
      const dashH = new THREE.Mesh(dashGeo, dashMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.rotation.z = Math.PI / 2;
      dashH.position.set(along, 0.045, line);
      scene.add(dashH);
    }
    for (const cross of STREET_LINES) {
      for (let s = -2; s <= 2; s += 1) {
        const stripeV = new THREE.Mesh(stripeGeo, whiteMat);
        stripeV.rotation.x = -Math.PI / 2;
        stripeV.position.set(line + s * 1.5, 0.045, cross - 8.5);
        scene.add(stripeV);
        const stripeH = new THREE.Mesh(stripeGeo, whiteMat);
        stripeH.rotation.x = -Math.PI / 2;
        stripeH.rotation.z = Math.PI / 2;
        stripeH.position.set(cross - 8.5, 0.045, line + s * 1.5);
        scene.add(stripeH);
      }
    }
  }
}

// One block's sidewalk slab: a raised paver square the building sits on.
function buildSlab(scene, bx, bz, sidewalkMat) {
  const c = blockMiddle(bx, bz);
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(STREET_PITCH - STREET_WIDTH, 0.14, STREET_PITCH - STREET_WIDTH),
    sidewalkMat,
  );
  slab.position.set(c.x, 0.07, c.z);
  slab.receiveShadow = true;
  scene.add(slab);
}

// ---- Rooftop dressing: AC boxes, water tanks, antennae ----
function dressRoof(group, width, depth, topY, rng) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.6, metalness: 0.5 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: 0.8, metalness: 0.1 });
  if (rng.chance(0.7)) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), metal);
    ac.position.set(rng.range(-width / 4, width / 4), topY + 0.45, rng.range(-depth / 4, depth / 4));
    ac.castShadow = true;
    group.add(ac);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 }));
    fan.position.set(ac.position.x, topY + 0.95, ac.position.z);
    group.add(fan);
  }
  if (rng.chance(0.45)) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 12), tankMat);
    tank.position.set(rng.range(-width / 3, width / 3), topY + 1.2, rng.range(-depth / 3, depth / 3));
    tank.castShadow = true;
    group.add(tank);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.7, 12), tankMat);
    cone.position.set(tank.position.x, topY + 2.45, tank.position.z);
    group.add(cone);
    for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.6, 0.09), tankMat);
      leg.position.set(tank.position.x + lx, topY + 0.3, tank.position.z + lz);
      group.add(leg);
    }
  }
  if (rng.chance(0.5)) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6), metal);
    mast.position.set(rng.range(-width / 3, width / 3), topY + 1.75, rng.range(-depth / 3, depth / 3));
    group.add(mast);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a22, emissiveIntensity: 2 }),
    );
    tip.position.set(mast.position.x, topY + 3.55, mast.position.z);
    group.add(tip);
  }
}

// ---- Archetype A: stucco walk-up (2-4 floors) ----
// Parapet, balconies, a ground-floor shopfront with a sign and an awning.
function buildWalkup(scene, cx, cz, rng, colliders) {
  const floors = rng.int(2, 4);
  const width = rng.range(18, 26);
  const depth = rng.range(16, 22);
  const height = floors * 3.4 + 0.6;
  const palette = rng.pick(FACADE_SETS);
  const facade = stuccoFacade(palette, floors, rng);
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a,
    emissiveIntensity: 0.85, roughness: 0.85, metalness: 0,
  });
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTexture(rng), roughness: 0.95 });
  const main = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat],
  );
  main.position.y = height / 2 + 0.14;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  // Parapet lip.
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.3, 0.5, depth + 0.3),
    new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.9 }),
  );
  parapet.position.y = height + 0.35;
  parapet.castShadow = true;
  group.add(parapet);
  dressRoof(group, width, depth, height + 0.6, rng);
  // Balconies on the street face, upper floors.
  const face = rng.pick([1, -1]); // which side faces the street
  for (let f = 1; f < floors; f += 1) {
    const count = rng.int(1, 2);
    for (let b = 0; b < count; b += 1) {
      const bx = (b - (count - 1) / 2) * (width / 2.2);
      const slabB = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.12, 1.1),
        new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.9 }),
      );
      slabB.position.set(bx, 0.14 + f * 3.4 + 0.1, face * (depth / 2 + 0.55));
      slabB.castShadow = true;
      group.add(slabB);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.7, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6 }),
      );
      rail.position.set(bx, 0.14 + f * 3.4 + 0.55, face * (depth / 2 + 1.05));
      group.add(rail);
    }
  }
  // Shopfront: glass, door, sign, striped awning.
  const shop = rng.pick(SHOP_NAMES);
  const sign = shopSignTexture(shop[0], shop[1], shop[2], shop[3], rng);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 1.9),
    new THREE.MeshStandardMaterial({
      map: sign.map, emissiveMap: sign.glow, emissive: 0xffc27a,
      emissiveIntensity: 0.9, roughness: 0.6,
    }),
  );
  signMesh.position.set(0, 3.6, face * (depth / 2 + 0.08));
  if (face < 0) signMesh.rotation.y = Math.PI;
  group.add(signMesh);
  const glassFront = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.7, 2.4, 0.15),
    new THREE.MeshStandardMaterial({
      color: 0x2a3a44, roughness: 0.1, metalness: 0.8,
      emissive: 0xffb85e, emissiveIntensity: 0.25,
    }),
  );
  glassFront.position.set(-width * 0.1, 1.35, face * (depth / 2 + 0.02));
  group.add(glassFront);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.4, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.7 }),
  );
  door.position.set(width * 0.32, 1.35, face * (depth / 2 + 0.03));
  group.add(door);
  const awning = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.72, 1.4),
    new THREE.MeshStandardMaterial({
      map: awningTexture(rng.pick(['#c23a2e', '#2e6ac2', '#3a8a4a', '#d9a13a']), '#f0e8d8'),
      side: THREE.DoubleSide, roughness: 0.9,
    }),
  );
  awning.position.set(-width * 0.1, 2.9, face * (depth / 2 + 0.75));
  // Near-horizontal, sloping down and outward — a steep plane reads as a sign, not a shade.
  awning.rotation.x = face > 0 ? -1.12 : Math.PI + 1.12;
  awning.castShadow = true;
  group.add(awning);
  group.position.set(cx, 0, cz);
  group.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  scene.add(group);
  colliders.push({ x: cx, z: cz, hw: width / 2 + 0.4, hd: depth / 2 + 0.4 });
}

// ---- Archetype B: glass mid-rise (5-9 floors) ----
// Curtain glass, a setback top floor, an entrance canopy.
function buildMidrise(scene, cx, cz, rng, colliders) {
  const floors = rng.int(5, 9);
  const width = rng.range(20, 26);
  const depth = rng.range(18, 24);
  const height = floors * 3.3;
  const facade = glassFacade(rng);
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a,
    emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.55,
  });
  const main = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  main.position.y = height / 2 + 0.14;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  // Setback crown floor.
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.7, 3, depth * 0.7),
    new THREE.MeshStandardMaterial({
      map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a,
      emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.55,
    }),
  );
  crown.position.y = height + 1.6;
  crown.castShadow = true;
  group.add(crown);
  dressRoof(group, width * 0.7, depth * 0.7, height + 3.1, rng);
  // Entrance canopy + lobby glow.
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.18, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.6 }),
  );
  canopy.position.set(0, 3.1, depth / 2 + 1);
  canopy.castShadow = true;
  group.add(canopy);
  const lobby = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffc98a, emissiveIntensity: 0.9 }),
  );
  lobby.position.set(0, 1.55, depth / 2 + 0.06);
  group.add(lobby);
  // Corner fins for a vertical read.
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, height, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 }),
    );
    fin.position.set(fx * (width / 2 - 0.1), height / 2 + 0.14, fz * (depth / 2 - 0.1));
    group.add(fin);
  }
  group.position.set(cx, 0, cz);
  group.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  scene.add(group);
  colliders.push({ x: cx, z: cz, hw: width / 2 + 0.4, hd: depth / 2 + 0.4 });
}

// ---- Archetype C: brick warehouse (the docks) ----
// Brick courses, a gabled roof, a roller door, a loading dock.
function buildWarehouse(scene, cx, cz, rng, colliders) {
  const width = rng.range(22, 28);
  const depth = rng.range(18, 24);
  const height = rng.range(7, 9.5);
  const group = new THREE.Group();
  const brickMat = new THREE.MeshStandardMaterial({ map: brickFacade(rng), roughness: 0.95 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), brickMat);
  main.position.y = height / 2 + 0.14;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  // Gable roof: two sloped slabs meeting at a ridge.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.6, metalness: 0.5 });
  const slopeLen = Math.sqrt((depth / 2) ** 2 + 2.4 ** 2) + 0.4;
  const slopeAngle = Math.atan2(2.4, depth / 2);
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.14, slopeLen), roofMat);
    slope.position.set(0, height + 1.2, side * (depth / 4));
    slope.rotation.x = side * slopeAngle;
    slope.castShadow = true;
    group.add(slope);
  }
  // Roller door + loading dock.
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4.2, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x6a6e75, roughness: 0.5, metalness: 0.7 }),
  );
  door.position.set(-width / 4, 2.25, depth / 2 + 0.05);
  group.add(door);
  for (let s = 0; s < 6; s += 1) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.08, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.6 }),
    );
    slat.position.set(-width / 4, 0.6 + s * 0.65, depth / 2 + 0.14);
    group.add(slat);
  }
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.5, 2.5),
    new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.95 }),
  );
  dock.position.set(-width / 4, 0.25, depth / 2 + 1.4);
  dock.castShadow = true;
  group.add(dock);
  // High windows under the eaves, some lit.
  for (let w = 0; w < 4; w += 1) {
    const lit = rng.chance(0.5);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x1a222c, emissive: lit ? 0xffc27a : 0x000000, emissiveIntensity: 0.9,
        roughness: 0.2, metalness: 0.6,
      }),
    );
    win.position.set(-width / 2 + 4 + w * (width - 8) / 3, height - 1.2, depth / 2 + 0.06);
    group.add(win);
  }
  group.position.set(cx, 0, cz);
  group.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  scene.add(group);
  colliders.push({ x: cx, z: cz, hw: width / 2 + 0.4, hd: depth / 2 + 0.4 });
}

// ---- Archetype D: stepped tower (downtown) ----
// Three stacked setbacks, a lit crown, vertical fins.
function buildTower(scene, cx, cz, rng, colliders) {
  const floors = rng.int(10, 16);
  const width = rng.range(20, 26);
  const depth = rng.range(18, 24);
  const facade = glassFacade(rng);
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a,
    emissiveIntensity: 0.9, roughness: 0.22, metalness: 0.6,
  });
  const baseH = floors * 3.3 * 0.55;
  const midH = floors * 3.3 * 0.3;
  const topH = floors * 3.3 * 0.15;
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, baseH, depth), wallMat);
  base.position.y = baseH / 2 + 0.14;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, midH, depth * 0.78), wallMat);
  mid.position.y = baseH + midH / 2 + 0.14;
  mid.castShadow = true;
  group.add(mid);
  const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, topH, depth * 0.55), wallMat);
  top.position.y = baseH + midH + topH / 2 + 0.14;
  top.castShadow = true;
  group.add(top);
  // Lit crown: a glowing band under the roofline.
  const totalH = baseH + midH + topH;
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.57, 0.5, depth * 0.57),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xff9a5a, emissiveIntensity: 1.6 }),
  );
  crown.position.y = totalH - 0.4;
  group.add(crown);
  dressRoof(group, width * 0.55, depth * 0.55, totalH + 0.14, rng);
  // Fins on the base corners.
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, baseH, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x9aa2ae, roughness: 0.35, metalness: 0.75 }),
    );
    fin.position.set(fx * (width / 2 - 0.15), baseH / 2 + 0.14, fz * (depth / 2 - 0.15));
    group.add(fin);
  }
  group.position.set(cx, 0, cz);
  group.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  scene.add(group);
  colliders.push({ x: cx, z: cz, hw: width / 2 + 0.4, hd: depth / 2 + 0.4 });
}

// ---- Archetype E: beachfront villa ----
// Pastel stucco, a terracotta tile roof, a patio.
function buildVilla(scene, cx, cz, rng, colliders, paletteOverride) {
  const palette = paletteOverride || rng.pick(FACADE_SETS);
  const width = rng.range(14, 18);
  const depth = rng.range(12, 15);
  const height = 6.4;
  const facade = stuccoFacade(palette, 2, rng);
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a,
    emissiveIntensity: 0.85, roughness: 0.85,
  });
  const main = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  main.position.y = height / 2 + 0.14;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  // Tile roof: two sloped slabs with a terracotta texture.
  const tileMat = new THREE.MeshStandardMaterial({ map: tileRoofTexture(rng), roughness: 0.9 });
  const slopeLen = Math.sqrt((depth / 2) ** 2 + 2.6 ** 2) + 0.6;
  const slopeAngle = Math.atan2(2.6, depth / 2);
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.16, slopeLen), tileMat);
    slope.position.set(0, height + 1.3, side * (depth / 4));
    slope.rotation.x = side * slopeAngle;
    slope.castShadow = true;
    group.add(slope);
  }
  // Patio slab + a low wall facing the sea.
  const patio = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.8, 0.12, 4),
    new THREE.MeshStandardMaterial({ map: sidewalkTexture(rng), roughness: 0.95 }),
  );
  patio.position.set(0, 0.2, depth / 2 + 2);
  patio.receiveShadow = true;
  group.add(patio);
  group.position.set(cx, 0, cz);
  group.rotation.y = rng.pick([0, Math.PI]);
  scene.add(group);
  colliders.push({ x: cx, z: cz, hw: width / 2 + 0.4, hd: depth / 2 + 0.4 });
}

// ---- Landmarks: the places the story names ----
// Rosa's garage: a workshop with a big door on the north face, opening onto
// the forecourt apron where every mission starts and ends.
function buildGarage(scene, rng, colliders) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: stuccoFacade({ base: '#e8dcc0', trim: '#c9b48c', glass: '#5d7f9e' }, 2, rng).map,
    roughness: 0.9,
  });
  const main = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 20), wallMat);
  main.position.y = 3.14;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(20.4, 0.4, 20.4),
    new THREE.MeshStandardMaterial({ map: roofTexture(rng), roughness: 0.95 }),
  );
  roof.position.y = 6.3;
  group.add(roof);
  // The big workshop door: a dark opening with a roller shutter half-up.
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(7, 4.6, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9 }),
  );
  opening.position.set(-3, 2.45, -10.05);
  group.add(opening);
  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(7, 1.6, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x6a6e75, roughness: 0.5, metalness: 0.7 }),
  );
  shutter.position.set(-3, 3.9, -10.15);
  group.add(shutter);
  const warmLight = new THREE.Mesh(
    new THREE.PlaneGeometry(6.6, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffb85e, emissiveIntensity: 0.7 }),
  );
  warmLight.position.set(-3, 1.5, -10.12);
  group.add(warmLight);
  // Office window + the sign.
  const office = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 1.6, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x2a3a44, emissive: 0xffc98a, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.6 }),
  );
  office.position.set(5.5, 3.4, -10.05);
  group.add(office);
  const sign = shopSignTexture("ROSA'S GARAGE", 'repairs · courier · no questions', '#14524a', '#ffe8a0', rng);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.2),
    new THREE.MeshStandardMaterial({ map: sign.map, emissiveMap: sign.glow, emissive: 0xffc27a, emissiveIntensity: 0.9 }),
  );
  signMesh.position.set(0, 5.2, -10.15);
  signMesh.rotation.y = Math.PI;
  group.add(signMesh);
  // Forecourt apron: stained concrete between the door and the road.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 7),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.95 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, 0.05, -13.5);
  apron.receiveShadow = true;
  group.add(apron);
  group.position.set(-24, 0, -24);
  scene.add(group);
  colliders.push({ x: -24, z: -24, hw: 10.2, hd: 10.2 });
}

function buildHospital(scene, rng, colliders) {
  const group = new THREE.Group();
  const facade = stuccoFacade({ base: '#f0ece2', trim: '#d8d2c2', glass: '#6f9db8' }, 3, rng);
  const wallMat = new THREE.MeshStandardMaterial({
    map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a, emissiveIntensity: 0.8, roughness: 0.85,
  });
  const main = new THREE.Mesh(new THREE.BoxGeometry(24, 10.5, 20), wallMat);
  main.position.y = 5.4;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  // Red cross on the facade, glowing at dusk.
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2a22, emissiveIntensity: 1.2 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3, 0.2), crossMat);
  crossV.position.set(0, 8.6, -10.1);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.2), crossMat);
  crossH.position.set(0, 8.6, -10.1);
  group.add(crossV, crossH);
  const sign = shopSignTexture('SOLMAR GENERAL', 'hospital · emergency', '#f0ece2', '#a82a2a', rng);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.8),
    new THREE.MeshStandardMaterial({ map: sign.map, emissiveMap: sign.glow, emissive: 0xffc27a, emissiveIntensity: 0.7 }),
  );
  signMesh.position.set(0, 4.2, -10.15);
  signMesh.rotation.y = Math.PI;
  group.add(signMesh);
  group.position.set(-72, 0, -120);
  scene.add(group);
  colliders.push({ x: -72, z: -120, hw: 12.2, hd: 10.2 });
}

function buildStation(scene, rng, colliders) {
  const group = new THREE.Group();
  const facade = stuccoFacade({ base: '#c4d3e6', trim: '#9db2cc', glass: '#3f5f7d' }, 3, rng);
  const wallMat = new THREE.MeshStandardMaterial({
    map: facade.map, emissiveMap: facade.glow, emissive: 0xffc27a, emissiveIntensity: 0.8, roughness: 0.85,
  });
  const main = new THREE.Mesh(new THREE.BoxGeometry(24, 10.5, 20), wallMat);
  main.position.y = 5.4;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  const sign = shopSignTexture('SBPD', 'Solmar Bay Police Department', '#1d2f4a', '#e8b64c', rng);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.8),
    new THREE.MeshStandardMaterial({ map: sign.map, emissiveMap: sign.glow, emissive: 0xffc27a, emissiveIntensity: 0.8 }),
  );
  signMesh.position.set(0, 4.6, 10.15);
  group.add(signMesh);
  // Flag pole with the city's pennant.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 11, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.8 }),
  );
  pole.position.set(8, 5.5, 12);
  pole.castShadow = true;
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1d2f4a, side: THREE.DoubleSide, roughness: 0.9 }),
  );
  flag.position.set(9.25, 10.2, 12);
  group.add(flag);
  group.position.set(-120, 0, 120);
  scene.add(group);
  colliders.push({ x: -120, z: 120, hw: 12.2, hd: 10.2 });
}

// The water tower: a rust-red landmark on the north-west skyline.
function buildWaterTower(scene, rng, colliders) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.7, metalness: 0.4 });
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 13, 8), steel);
    leg.position.set(lx, 6.5, lz);
    leg.rotation.z = lx > 0 ? -0.06 : 0.06;
    leg.rotation.x = lz > 0 ? 0.06 : -0.06;
    leg.castShadow = true;
    group.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 5, 16), steel);
  tank.position.y = 15.5;
  tank.castShadow = true;
  group.add(tank);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.2, 16), new THREE.MeshStandardMaterial({ color: 0x6a3a2c, roughness: 0.7, metalness: 0.4 }));
  cone.position.y = 19.1;
  cone.castShadow = true;
  group.add(cone);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(4.25, 4.25, 0.8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 }),
  );
  band.position.y = 14.2;
  group.add(band);
  group.position.set(120, 0, -120);
  scene.add(group);
  colliders.push({ x: 120, z: -120, hw: 4, hd: 4 });
}

// The beach parking lot: open asphalt with painted bays, where the Kings
// leave their prize car in mission 2.
function buildBeachLot(scene) {
  const lot = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.95 }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(24, 0.16, 168);
  lot.receiveShadow = true;
  scene.add(lot);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e6e0 });
  for (let i = 0; i < 6; i += 1) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(13 + i * 4.4, 0.18, 162);
    scene.add(line);
  }
}

// ---- Assembly ----
export function buildSkyline(scene, rng) {
  const colliders = [];
  buildStreets(scene, rng.fork(11));
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(rng.fork(12)), roughness: 0.95 });
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTexture(rng.fork(13)), roughness: 1 });

  const downtown = new Set(['0,-1', '1,-1', '-1,0', '0,0', '1,0', '-1,-2', '0,-2', '1,-2']);
  const parks = new Set(['1,1', '-3,-2']);
  for (let bx = BLOCK_LO; bx <= BLOCK_HI; bx += 1) {
    for (let bz = BLOCK_LO; bz <= BLOCK_HI; bz += 1) {
      const key = `${bx},${bz}`;
      const c = blockMiddle(bx, bz);
      const blockRng = rng.fork(100 + (bx + 4) * 16 + (bz + 4));
      if (key === '-1,-1') { buildSlab(scene, bx, bz, sidewalkMat); buildGarage(scene, blockRng, colliders); continue; }
      if (key === '-2,-3') { buildSlab(scene, bx, bz, sidewalkMat); buildHospital(scene, blockRng, colliders); continue; }
      if (key === '-3,2') { buildSlab(scene, bx, bz, sidewalkMat); buildStation(scene, blockRng, colliders); continue; }
      if (key === '2,-3') { buildSlab(scene, bx, bz, sidewalkMat); buildWaterTower(scene, blockRng, colliders); continue; }
      if (key === '0,3') { buildSlab(scene, bx, bz, sidewalkMat); buildBeachLot(scene); continue; }
      if (parks.has(key)) {
        const lawn = new THREE.Mesh(
          new THREE.BoxGeometry(STREET_PITCH - STREET_WIDTH, 0.16, STREET_PITCH - STREET_WIDTH),
          lawnMat,
        );
        lawn.position.set(c.x, 0.08, c.z);
        lawn.receiveShadow = true;
        scene.add(lawn);
        continue;
      }
      buildSlab(scene, bx, bz, sidewalkMat);
      if (key === '3,3') { buildVilla(scene, 162, 162, blockRng, colliders, { base: '#f2cdb4', trim: '#d9a586', glass: '#4f7390' }); continue; }
      if (bz === 3) { buildVilla(scene, c.x, c.z, blockRng, colliders); continue; }
      if (bx === 3 && bz >= -2 && bz <= 1) { buildWarehouse(scene, c.x, c.z, blockRng, colliders); continue; }
      if (bx === 3 && bz === 2) continue; // open dock apron: containers live here
      if (downtown.has(key)) { buildTower(scene, c.x, c.z, blockRng, colliders); continue; }
      if (blockRng.chance(0.6)) buildWalkup(scene, c.x, c.z, blockRng, colliders);
      else buildMidrise(scene, c.x, c.z, blockRng, colliders);
    }
  }
  return { colliders };
}
