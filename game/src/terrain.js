// Terrain: the ground the city stands on, the sea around it, and the sky.
// One job: give the world DEPTH — a coastal shelf that rises into hills to
// the west and north, dunes along the south beach, and a sunset sky dome
// with a low amber sun. The drivable street grid stays dead flat (y = 0);
// the height lives where the player looks, not where the cars drive.

import { SUNSET, TERRAIN, WORLD_HALF } from './settings.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Cheap deterministic undulation — no noise tables, just layered sines.
function undulate(x, z) {
  return Math.sin(x * 0.021 + 1.7) * Math.cos(z * 0.017 + 0.6) * 0.6
    + Math.sin(x * 0.043 - z * 0.031) * 0.4
    + Math.cos((x + z) * 0.011) * 0.5;
}

// Height of the ground at (x, z). Zero across the whole street grid and the
// building blocks; dunes on the south beach; hills hemming the west and
// north; the sea floor drops away to the east and far south.
export function groundHeight(x, z) {
  let h = 0;
  // South beach dunes: a gentle swell past the last street.
  if (z > TERRAIN.duneStart && Math.abs(x) < 250) {
    const t = smoothstep(TERRAIN.duneStart, 228, z);
    h += t * TERRAIN.duneHeight * (0.6 + 0.4 * undulate(x * 0.5, z * 0.5));
  }
  // West ridge: the sun sets behind these hills.
  if (x < -TERRAIN.hillStart) {
    const t = smoothstep(-TERRAIN.hillStart, -WORLD_HALF, x);
    h += t * TERRAIN.hillWest * (0.75 + 0.35 * undulate(x, z * 0.7));
  }
  // North ridge.
  if (z < -TERRAIN.hillStart) {
    const t = smoothstep(-TERRAIN.hillStart, -WORLD_HALF, z);
    h += t * TERRAIN.hillNorth * (0.75 + 0.35 * undulate(x * 0.7, z));
  }
  // Sea floor, east and far south.
  const eastDrop = smoothstep(232, 260, x);
  const southDrop = smoothstep(238, 262, z);
  const drop = Math.max(eastDrop, southDrop);
  if (drop > 0) h = h * (1 - drop) + TERRAIN.seaFloor * drop;
  return h;
}

// Colour the ground by place: warm pavement under the city, sand on the
// beach, dry grass and scrub on the hills, dark sand under the sea.
function groundColor(x, z, out) {
  const h = groundHeight(x, z);
  if (x > 232 || z > 240) {
    out.setRGB(0.36, 0.32, 0.22); // sea floor
  } else if (z > TERRAIN.duneStart && Math.abs(x) < 250) {
    const n = undulate(x, z) * 0.05;
    out.setRGB(0.88 + n, 0.78 + n, 0.55 + n); // sand
  } else if (h > 0.6) {
    const dry = 0.5 + 0.5 * undulate(x * 1.3, z * 1.3);
    out.setRGB(0.32 + dry * 0.18, 0.38 + dry * 0.10, 0.18 + dry * 0.05); // scrub
  } else {
    out.setRGB(0.62, 0.56, 0.46); // city underlay (mostly hidden by roads)
  }
  return out;
}

export function buildGround(scene, rng) {
  const size = WORLD_HALF * 2;
  const segments = 120;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
    groundColor(x, z, color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0,
  }));
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

export function buildSea(scene, seaTexture) {
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2.4, WORLD_HALF * 2.4),
    new THREE.MeshStandardMaterial({
      map: seaTexture, color: 0x9fc4dd, roughness: 0.18, metalness: 0.55,
      transparent: true, opacity: 0.96,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.35;
  scene.add(sea);
  return sea;
}

// ---- The sunset sky ----
// A dome whose vertices are coloured by direction: violet overhead, rose
// in the middle band, amber at the horizon — warmest toward the sun, so
// the west glows and the east cools. No shader needed; vertex colours do it.
function skyDome(scene) {
  const radius = 760;
  const geometry = new THREE.SphereGeometry(radius, 32, 18);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(SUNSET.skyZenith);
  const mid = new THREE.Color(SUNSET.skyMid);
  const horizon = new THREE.Color(SUNSET.skyHorizon);
  const sunDir = new THREE.Vector3(
    Math.cos(SUNSET.sunElevation) * Math.cos(SUNSET.sunAzimuth),
    Math.sin(SUNSET.sunElevation),
    Math.cos(SUNSET.sunElevation) * Math.sin(SUNSET.sunAzimuth),
  ).normalize();
  const dir = new THREE.Vector3();
  const mixed = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const up = Math.max(0, dir.y);
    if (up > 0.45) mixed.copy(zenith).lerp(mid, (1 - up) / 0.55);
    else mixed.copy(mid).lerp(horizon, 1 - up / 0.45);
    // Warm the sky toward the sun; cool it away.
    const toward = Math.max(0, dir.dot(sunDir));
    mixed.lerp(new THREE.Color(0xffc98a), toward * toward * 0.55 * (1 - up));
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  dome.renderOrder = -10;
  scene.add(dome);
  return sunDir;
}

// The sun itself: a bright disc low over the western sea, with a soft halo.
function sunDisc(scene, sunDir) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, transparent: true, opacity: 0.98 }),
  );
  disc.position.copy(sunDir).multiplyScalar(700);
  disc.lookAt(0, 0, 0);
  group.add(disc);
  // Halo: a radial-gradient sprite, additive, so the sun bleeds into the sky.
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,220,150,0.85)');
  gradient.addColorStop(0.4, 'rgba(255,160,90,0.35)');
  gradient.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, fog: false,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.position.copy(sunDir).multiplyScalar(690);
  halo.scale.set(260, 260, 1);
  group.add(halo);
  scene.add(group);
  return group;
}

// Dusk clouds: flattened puffs in rose and mauve, drifting east.
function buildClouds(scene, rng) {
  const clouds = [];
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xe89a8a, roughness: 1, metalness: 0,
    emissive: 0x7a3a4a, emissiveIntensity: 0.25, flatShading: true,
  });
  const puffMat2 = new THREE.MeshStandardMaterial({
    color: 0xc97a9e, roughness: 1, metalness: 0,
    emissive: 0x5a2a44, emissiveIntensity: 0.25, flatShading: true,
  });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + rng.int(0, 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(puffGeo, p % 2 === 0 ? puffMat : puffMat2);
      puff.position.set((p - puffs / 2) * 9 + rng.range(-3, 3), rng.range(-1.5, 2), rng.range(-4, 4));
      puff.scale.set(rng.range(7, 13), rng.range(2.5, 4.5), rng.range(5, 8));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-320, 320), rng.range(55, 110), rng.range(-320, 320));
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

// ---- Lights: one low amber sun, one violet sky bounce ----
function buildLights(scene, sunDir) {
  const sun = new THREE.DirectionalLight(SUNSET.sunColor, SUNSET.sunIntensity);
  sun.position.copy(sunDir).multiplyScalar(260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 560;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(SUNSET.hemiSky, SUNSET.hemiGround, SUNSET.hemiIntensity);
  scene.add(hemi);
  // A faint warm fill from the east so shadowed faces never go black.
  const fill = new THREE.DirectionalLight(0x8a7ab8, 0.35);
  fill.position.set(120, 80, -60);
  scene.add(fill);
  return sun;
}

// Assemble the whole environment: ground, sea, sky, lights, clouds.
// Returns the live handles the game loop needs (sea scroll, cloud drift,
// and the shadow rig that follows the player).
export function buildTerrain(scene, rng, seaTexture) {
  scene.fog = new THREE.Fog(SUNSET.fogColor, SUNSET.fogNear, SUNSET.fogFar);
  buildGround(scene, rng);
  const sea = buildSea(scene, seaTexture);
  const sunDir = skyDome(scene);
  sunDisc(scene, sunDir);
  const clouds = buildClouds(scene, rng);
  const sun = buildLights(scene, sunDir);
  return {
    sea,
    clouds,
    // Keep the shadow frustum centred on the action; the sun itself never moves.
    followPlayer(x, z) {
      sun.position.set(x + sunDir.x * 260, sunDir.y * 260, z + sunDir.z * 260);
      sun.target.position.set(x, 0, z);
    },
    tick(dt) {
      seaTexture.offset.x += dt * 0.006;
      seaTexture.offset.y += dt * 0.004;
      for (const cloud of clouds) {
        cloud.position.x += dt * 0.8;
        if (cloud.position.x > 360) cloud.position.x = -360;
      }
    },
  };
}
