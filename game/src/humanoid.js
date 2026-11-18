// People: proportioned humanoids built from rounded primitives.
// One job: make a character that reads as a PERSON at screenshot distance —
// a sphere head with a face and hair, a tapered torso with clothing colour
// separation, arms and legs as separate jointed capsules with elbows and
// knees, and a walk/run cycle with limb swing and body bob. No box heads,
// no box torsos, no ball-on-a-stick: those shapes are banned outright.
//
// Rig (heights in metres, total ~1.82): hip pivots at 0.98, knee 0.54,
// ankle 0.12; shoulders at 1.53; head centre 1.78. Forward is +Z at
// rotation.y = 0, matching the heading convention atan2(dx, dz).

// Shared geometry: one of each shape, reused by every character.
const GEO = {
  skull: new THREE.SphereGeometry(0.145, 20, 16),
  hairCap: new THREE.SphereGeometry(0.152, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  eye: new THREE.SphereGeometry(0.017, 8, 8),
  nose: new THREE.SphereGeometry(0.013, 8, 8),
  ear: new THREE.SphereGeometry(0.028, 8, 8),
  neck: new THREE.CylinderGeometry(0.052, 0.058, 0.1, 10),
  pelvis: new THREE.SphereGeometry(0.16, 14, 12),
  torso: new THREE.CylinderGeometry(0.165, 0.13, 0.52, 14),
  chest: new THREE.SphereGeometry(0.19, 14, 12),
  shoulder: new THREE.SphereGeometry(0.068, 10, 8),
  upperArm: new THREE.CapsuleGeometry(0.052, 0.22, 6, 10),
  forearm: new THREE.CapsuleGeometry(0.045, 0.2, 6, 10),
  hand: new THREE.SphereGeometry(0.05, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.075, 0.3, 6, 12),
  shin: new THREE.CapsuleGeometry(0.058, 0.3, 6, 12),
  shoe: new THREE.SphereGeometry(0.09, 10, 8),
  ponytail: new THREE.CapsuleGeometry(0.045, 0.22, 6, 8),
  bun: new THREE.SphereGeometry(0.055, 10, 8),
  capTop: new THREE.CylinderGeometry(0.15, 0.155, 0.07, 16),
  capBrim: new THREE.CylinderGeometry(0.15, 0.15, 0.015, 16, 1, false, -0.6, 1.2),
  belt: new THREE.TorusGeometry(0.145, 0.018, 8, 20),
};

function std(color, roughness = 0.75, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// ---- The rifle: receiver, barrel, stock, grip, magazine and sight ----
// Built pointing +Z in its own space; the hand mount rotates it to the
// forearm axis, so it hangs by the leg at rest and points ahead on aim.
export function createRifle() {
  const group = new THREE.Group();
  const gunmetal = std(0x23242a, 0.45, 0.7);
  const gripMat = std(0x3a2c1e, 0.8, 0);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.42), gunmetal);
  group.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 8), gunmetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.4);
  group.add(barrel);
  const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 8), std(0x2e3138, 0.6, 0.4));
  handguard.rotation.x = Math.PI / 2;
  handguard.position.set(0, 0.02, 0.28);
  group.add(handguard);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.22), gripMat);
  stock.position.set(0, -0.01, -0.3);
  group.add(stock);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), gripMat);
  grip.position.set(0, -0.11, -0.08);
  grip.rotation.x = 0.35;
  group.add(grip);
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), std(0x4a4d52, 0.5, 0.6));
  magazine.position.set(0, -0.12, 0.06);
  magazine.rotation.x = 0.12;
  group.add(magazine);
  const sightPost = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.015), gunmetal);
  sightPost.position.set(0, 0.09, 0.32);
  group.add(sightPost);
  const sightRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 14), gunmetal);
  sightRing.position.set(0, 0.1, 0.05);
  group.add(sightRing);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.62);
  group.add(muzzle);
  group.traverse((child) => {
    if (child.isMesh) { child.castShadow = true; }
  });
  return { group, muzzle };
}

export function createPistol() {
  const group = new THREE.Group();
  const gunmetal = std(0x23242a, 0.45, 0.7);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), gunmetal);
  group.add(slide);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), std(0x3a2c1e, 0.8, 0));
  grip.position.set(0, -0.07, -0.06);
  grip.rotation.x = 0.25;
  group.add(grip);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.14);
  group.add(muzzle);
  return { group, muzzle };
}

// ---- The head: skull, face, hair ----
const SKIN_TONES = [0xe8b88a, 0xc98d5e, 0x8a5a34, 0xf0c8a0, 0x6e4423, 0xd9a066];
const HAIR_COLORS = [0x1a1210, 0x2e1a0e, 0x4a2c14, 0x6e4423, 0x8a8d90, 0xb8b0a0, 0x3a2a1a];

function buildHead(look, mats) {
  const head = new THREE.Group();
  const skull = new THREE.Mesh(GEO.skull, mats.skin);
  skull.scale.set(0.94, 1.06, 0.98);
  skull.castShadow = true;
  head.add(skull);
  // Eyes: dark, slightly proud of the skull, with a white glint.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(GEO.eye, std(0x14100c, 0.25, 0));
    eye.position.set(side * 0.052, 0.018, 0.128);
    head.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), std(0xffffff, 0.2, 0));
    glint.position.set(side * 0.052 + 0.006, 0.024, 0.141);
    head.add(glint);
  }
  const nose = new THREE.Mesh(GEO.nose, mats.skinDark);
  nose.position.set(0, -0.022, 0.142);
  nose.scale.set(0.8, 1.2, 0.8);
  head.add(nose);
  // Mouth: a short dark line, so the face reads at a glance.
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.008, 0.006),
    std(0x6e3a2e, 0.6, 0),
  );
  mouth.position.set(0, -0.062, 0.132);
  head.add(mouth);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(GEO.ear, mats.skin);
    ear.position.set(side * 0.138, -0.01, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  }
  // Hair, by style.
  if (look.hair === 'cap') {
    const top = new THREE.Mesh(GEO.capTop, mats.hair);
    top.position.y = 0.1;
    head.add(top);
    const brim = new THREE.Mesh(GEO.capBrim, mats.hair);
    brim.position.set(0, 0.075, 0.06);
    brim.rotation.x = 0.12;
    head.add(brim);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 10), std(0xe8b64c, 0.35, 0.7));
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0.1, 0.148);
    head.add(badge);
  } else if (look.hair === 'bald') {
    // Nothing: the skull is the look.
  } else {
    const cap = new THREE.Mesh(GEO.hairCap, mats.hair);
    cap.position.y = 0.012;
    cap.position.z = -0.008;
    cap.castShadow = true;
    head.add(cap);
    if (look.hair === 'long' || look.hair === 'ponytail') {
      const back = new THREE.Mesh(GEO.hairCap, mats.hair);
      back.position.set(0, -0.02, -0.045);
      back.rotation.x = 0.5;
      back.scale.set(1, 1.15, 1);
      head.add(back);
    }
    if (look.hair === 'ponytail') {
      const tail = new THREE.Mesh(GEO.ponytail, mats.hair);
      tail.position.set(0, -0.05, -0.16);
      tail.rotation.x = 0.5;
      tail.castShadow = true;
      head.add(tail);
    }
    if (look.hair === 'bun') {
      const bun = new THREE.Mesh(GEO.bun, mats.hair);
      bun.position.set(0, 0.14, -0.06);
      head.add(bun);
    }
  }
  return head;
}

// ---- The body: jointed limbs, tapered torso, clothing separation ----
// Each limb is a pivot group at the joint; the capsule hangs below it, so
// rotating the group swings the limb the way a real joint does.

function buildArm(side, mats, sleeveLong) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.235, 1.53, 0);
  const cap = new THREE.Mesh(GEO.shoulder, mats.shirt);
  cap.castShadow = true;
  shoulder.add(cap);
  const upper = new THREE.Mesh(GEO.upperArm, sleeveLong ? mats.shirt : mats.skin);
  upper.position.y = -0.17;
  upper.castShadow = true;
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = -0.31;
  shoulder.add(elbow);
  const fore = new THREE.Mesh(GEO.forearm, mats.skin);
  fore.position.y = -0.15;
  fore.castShadow = true;
  elbow.add(fore);
  const hand = new THREE.Mesh(GEO.hand, mats.skin);
  hand.position.y = -0.31;
  hand.castShadow = true;
  elbow.add(hand);
  return { shoulder, elbow, hand };
}

function buildLeg(side, mats) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.1, 0.98, 0);
  const thigh = new THREE.Mesh(GEO.thigh, mats.pants);
  thigh.position.y = -0.22;
  thigh.castShadow = true;
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.y = -0.44;
  hip.add(knee);
  const shin = new THREE.Mesh(GEO.shin, mats.pants);
  shin.position.y = -0.21;
  shin.castShadow = true;
  knee.add(shin);
  const shoe = new THREE.Mesh(GEO.shoe, mats.shoes);
  shoe.position.set(0, -0.42, 0.045);
  shoe.scale.set(0.85, 0.62, 1.5);
  shoe.castShadow = true;
  knee.add(shoe);
  return { hip, knee };
}

// Look presets. `look` may override any field.
export function heroLook() {
  return {
    skin: 0xc98d5e, hair: 0x1a1210, hairStyle: 'ponytail',
    shirt: 0x1f7a6e, jacket: 0x14524a, pants: 0x2c3242, shoes: 0x1c1a18,
    sleeveLong: true, jacketed: true, scale: 1,
  };
}

export function rosaLook() {
  return {
    skin: 0xe8b88a, hair: 0x4a2c14, hairStyle: 'bun',
    shirt: 0x7a4a8a, jacket: null, pants: 0x3a3a44, shoes: 0x2a2320,
    sleeveLong: false, jacketed: false, scale: 0.97,
  };
}

export function copLook(rng) {
  return {
    skin: rng.pick(SKIN_TONES), hair: 0x1a1210, hairStyle: 'cap',
    shirt: 0x1d2f4a, jacket: 0x16233a, pants: 0x1a2436, shoes: 0x101010,
    sleeveLong: true, jacketed: true, scale: 1,
  };
}

export function gangLook(rng) {
  return {
    skin: rng.pick(SKIN_TONES), hair: rng.pick(HAIR_COLORS),
    hairStyle: rng.pick(['short', 'short', 'bald', 'long']),
    shirt: rng.pick([0x8a2f2f, 0x7a2434, 0x9e3a2a, 0x6e2a3a]),
    jacket: null, pants: rng.pick([0x222226, 0x2c2c34, 0x3a3230]), shoes: 0x181614,
    sleeveLong: rng.chance(0.5), jacketed: false, scale: rng.range(0.97, 1.05),
  };
}

export function bossLook() {
  return {
    skin: 0xe8b88a, hair: 0x2e1a0e, hairStyle: 'bald',
    shirt: 0x8a2f2f, jacket: 0x141414, pants: 0x1c1c20, shoes: 0x0e0c0a,
    sleeveLong: true, jacketed: true, scale: 1.09,
  };
}

export function pedLook(rng) {
  const shirts = [0xd96a4a, 0x4a7ad9, 0xe8c84a, 0x6ab04a, 0xd94a8a, 0x4ad9c8, 0xe8e4da, 0x9a6ad9];
  const pantsList = [0x2c3242, 0x4a3a2c, 0x3a3a3a, 0x5a6a7a, 0x6e5a3a];
  return {
    skin: rng.pick(SKIN_TONES), hair: rng.pick(HAIR_COLORS),
    hairStyle: rng.pick(['short', 'short', 'long', 'ponytail', 'bun', 'bald']),
    shirt: rng.pick(shirts), jacket: null,
    pants: rng.pick(pantsList), shoes: rng.pick([0x1c1a18, 0x4a2c1e, 0x2c2c2c]),
    sleeveLong: rng.chance(0.4), jacketed: false, scale: rng.range(0.94, 1.04),
  };
}

// Build one person. Returns the rig: the group plus every joint the
// animator needs, plus the weapon mount when `armed` is set.
export function createHumanoid(look, armed = false) {
  const mats = {
    skin: std(look.skin, 0.65, 0),
    skinDark: std(new THREE.Color(look.skin).multiplyScalar(0.82), 0.65, 0),
    hair: std(look.hair, 0.85, 0),
    shirt: std(look.shirt, 0.8, 0),
    jacket: look.jacket ? std(look.jacket, 0.7, 0) : null,
    pants: std(look.pants, 0.85, 0),
    shoes: std(look.shoes, 0.5, 0.1),
  };
  const group = new THREE.Group();
  group.scale.setScalar(look.scale || 1);

  // Pelvis + torso: the torso is a tapered cylinder (wider at the chest),
  // rounded at the chest by a flattened sphere, with a belt at the waist.
  const pelvis = new THREE.Mesh(GEO.pelvis, mats.pants);
  pelvis.position.y = 1.0;
  pelvis.scale.set(1, 0.72, 0.78);
  pelvis.castShadow = true;
  group.add(pelvis);
  const belt = new THREE.Mesh(GEO.belt, std(0x1a140e, 0.6, 0));
  belt.position.y = 1.08;
  belt.rotation.x = Math.PI / 2;
  group.add(belt);

  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.06;
  group.add(torsoGroup);
  const torso = new THREE.Mesh(GEO.torso, mats.shirt);
  torso.position.y = 0.28;
  torso.castShadow = true;
  torsoGroup.add(torso);
  const chest = new THREE.Mesh(GEO.chest, mats.shirt);
  chest.position.y = 0.44;
  chest.scale.set(0.95, 0.62, 0.72);
  chest.castShadow = true;
  torsoGroup.add(chest);
  if (mats.jacket) {
    // An open jacket: a slightly larger tapered shell over the torso.
    const jacket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.155, 0.4, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: look.jacket, roughness: 0.7, side: THREE.DoubleSide }),
    );
    jacket.position.y = 0.3;
    jacket.castShadow = true;
    torsoGroup.add(jacket);
  }
  const neck = new THREE.Mesh(GEO.neck, mats.skin);
  neck.position.y = 0.58;
  torsoGroup.add(neck);
  const head = buildHead({ hair: look.hairStyle }, mats);
  head.position.y = 0.72;
  torsoGroup.add(head);

  const armL = buildArm(-1, mats, look.sleeveLong);
  const armR = buildArm(1, mats, look.sleeveLong);
  armL.shoulder.position.y -= 1.06;
  armR.shoulder.position.y -= 1.06;
  torsoGroup.add(armL.shoulder, armR.shoulder);
  const legL = buildLeg(-1, mats);
  const legR = buildLeg(1, mats);
  group.add(legL.hip, legR.hip);

  const rig = {
    group, torsoGroup, head,
    armL: armL.shoulder, elbowL: armL.elbow,
    armR: armR.shoulder, elbowR: armR.elbow,
    legL: legL.hip, kneeL: legL.knee,
    legR: legR.hip, kneeR: legR.knee,
    phase: Math.random() * Math.PI * 2,
    weapon: null, muzzle: null,
  };
  if (armed) {
    const rifle = createRifle();
    // Mounted on the right forearm, barrel along the forearm axis: it hangs
    // by the leg at rest and swings up to aim with the arm.
    rifle.group.position.set(0, -0.33, 0.03);
    rifle.group.rotation.x = Math.PI / 2;
    rig.elbowR.add(rifle.group);
    rig.weapon = rifle.group;
    rig.muzzle = rifle.muzzle;
  }
  return rig;
}

// ---- Motion: the walk cycle, the aim pose, the fall ----
// `speed` is metres per second; 0 is idle, ~5 is a walk, ~9 is a run.
// The stride frequency scales with speed, the swing with effort, and the
// torso bobs twice per stride — the read is "person moving", not "toy sliding".

function lerpAngle(current, target, rate, dt) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, rate * dt);
}

export function animateHumanoid(rig, dt, speed, aiming) {
  const effort = Math.min(1, speed / 8.5);
  rig.phase += dt * (2.2 + speed * 1.15);
  const swing = Math.sin(rig.phase) * (0.12 + effort * 0.62);
  const counter = Math.sin(rig.phase + Math.PI) * (0.12 + effort * 0.62);

  // Legs: opposite swings, knees folding on the forward swing.
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = counter;
  rig.kneeL.rotation.x = Math.max(0, Math.cos(rig.phase)) * (0.25 + effort * 0.85);
  rig.kneeR.rotation.x = Math.max(0, Math.cos(rig.phase + Math.PI)) * (0.25 + effort * 0.85);

  if (aiming) {
    // Two-handed aim: right arm drives the rifle forward, left arm braces
    // across the chest, torso squares to the target.
    rig.armR.rotation.x = lerpAngle(rig.armR.rotation.x, -1.32, 14, dt);
    rig.elbowR.rotation.x = lerpAngle(rig.elbowR.rotation.x, -0.12, 14, dt);
    rig.armL.rotation.x = lerpAngle(rig.armL.rotation.x, -1.05, 14, dt);
    rig.elbowL.rotation.x = lerpAngle(rig.elbowL.rotation.x, -0.85, 14, dt);
    rig.torsoGroup.rotation.y = lerpAngle(rig.torsoGroup.rotation.y, 0, 10, dt);
  } else {
    // Arms counter-swing the legs; elbows carry a soft bend.
    rig.armL.rotation.x = counter * 0.75;
    rig.armR.rotation.x = swing * 0.75;
    rig.elbowL.rotation.x = -0.18 - effort * 0.25;
    rig.elbowR.rotation.x = -0.18 - effort * 0.25;
    rig.torsoGroup.rotation.y = Math.sin(rig.phase) * 0.06 * effort;
  }

  // Bob: two bounces per stride, plus a forward lean that grows with speed.
  const bob = Math.abs(Math.cos(rig.phase)) * 0.045 * effort;
  rig.torsoGroup.position.y = 1.06 + bob;
  rig.torsoGroup.rotation.x = 0.05 + effort * 0.09;
  rig.torsoGroup.rotation.z = Math.sin(rig.phase) * 0.045 * effort;
  // Idle breathing when still: a slow rise of the chest.
  if (speed < 0.2 && !aiming) {
    rig.torsoGroup.position.y = 1.06 + Math.sin(rig.phase * 0.35) * 0.008;
    rig.torsoGroup.rotation.x = 0.02;
  }
}

// Drop a character flat on their back (shot peds, dead enemies).
export function layHumanoidDown(rig) {
  rig.group.rotation.x = -Math.PI / 2;
  rig.group.position.y = 0.28;
  rig.legL.rotation.x = 0.1;
  rig.legR.rotation.x = -0.15;
  rig.armL.rotation.x = 0.5;
  rig.armR.rotation.x = -0.4;
}

// The muzzle's world position, for tracers and muzzle flash.
export function muzzleWorld(rig, out) {
  if (!rig.muzzle) return out.set(0, 1.4, 0);
  rig.muzzle.getWorldPosition(out);
  return out;
}
