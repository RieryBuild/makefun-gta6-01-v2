// Gunplay: the rifle, the Kings who shoot back, and the light show.
// One job: resolve shots — a ray from the camera against people and walls,
// tracers and muzzle flash and sparks so every shot reads, enemies with
// health who take cover fire back, and a reload that leaves Dana exposed.

import { RIFLE } from './settings.js';
import {
  animateHumanoid, bossLook, createHumanoid, gangLook, layHumanoidDown,
} from './humanoid.js';

// Ray vs a tall box (a building): the slab test in 3D. Returns the distance
// along the ray to the box's near face, or Infinity when it misses.
function rayVsBox(origin, dir, box, top) {
  let tMin = 0;
  let tMax = Infinity;
  const axes = [
    [origin.x, dir.x, box.x - box.hw, box.x + box.hw],
    [origin.y, dir.y, 0, top],
    [origin.z, dir.z, box.z - box.hd, box.z + box.hd],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return Infinity;
    }
  }
  return tMin;
}

export class Gunplay {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.ammo = RIFLE.mag;
    this.reloading = false;
    this.reloadTimer = 0;
    this.lastShotTime = -10;
    this.enemies = []; // { rig, x, z, heading, hp, isBoss, shootTimer, strafeDir, deadTimer }
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = RIFLE.range;
    this.tracers = [];
    this.tracerGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 5);
    this.tracerGeo.translate(0, 0.5, 0);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    // Muzzle flash: a sprite plus a light, both alive for a blink.
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture(), color: 0xffd9a0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.flash.scale.set(1.1, 1.1, 1);
    this.flash.visible = false;
    this.scene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc27a, 0, 12, 2);
    this.scene.add(this.flashLight);
    this.flashTimer = 0;
    this.sparkPool = [];
  }

  glowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255,255,240,1)');
    gradient.addColorStop(0.35, 'rgba(255,200,110,0.85)');
    gradient.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  canFire(time) {
    return !this.reloading && this.ammo > 0 && time - this.lastShotTime >= RIFLE.interval;
  }

  startReload() {
    if (this.reloading || this.ammo === RIFLE.mag) return false;
    this.reloading = true;
    this.reloadTimer = RIFLE.reload;
    return true;
  }

  // A tracer: a glowing rod from muzzle to impact, gone in a blink.
  showTracer(from, to) {
    let tracer = this.tracers.find((t) => t.timer <= 0);
    if (!tracer) {
      if (this.tracers.length >= 10) return;
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
      this.scene.add(mesh);
      tracer = { mesh, timer: 0 };
      this.tracers.push(tracer);
    }
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length();
    tracer.mesh.position.copy(from);
    tracer.mesh.scale.set(1, length, 1);
    tracer.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    tracer.mesh.material.opacity = 0.9;
    tracer.mesh.visible = true;
    tracer.timer = 0.09;
  }

  showSpark(point) {
    let spark = this.sparkPool.find((s) => s.timer <= 0);
    if (!spark) {
      if (this.sparkPool.length >= 8) return;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture(), color: 0xffc27a, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      this.scene.add(sprite);
      spark = { sprite, timer: 0 };
      this.sparkPool.push(spark);
    }
    spark.sprite.position.copy(point);
    spark.sprite.scale.set(0.7, 0.7, 1);
    spark.sprite.material.opacity = 0.95;
    spark.sprite.visible = true;
    spark.timer = 0.18;
  }

  showMuzzleFlash(muzzlePos) {
    this.flash.position.copy(muzzlePos);
    this.flash.visible = true;
    this.flash.material.opacity = 1;
    this.flashLight.position.copy(muzzlePos);
    this.flashLight.intensity = 3.2;
    this.flashTimer = 0.06;
  }

  // One ray against the world: characters, walls, ground. Returns the
  // endpoint and whoever it hit (or null). Shared by the aim step and the
  // shot itself, so both agree on where the bullet lands.
  castShot(origin, dir, context) {
    const targets = [];
    for (const enemy of this.enemies) {
      if (enemy.hp > 0) targets.push(enemy.rig.group);
    }
    for (const officer of context.officers || []) targets.push(officer.rig.group);
    for (const ped of context.peds || []) {
      if (ped.state !== 'down') targets.push(ped.rig.group);
    }
    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects(targets, true);
    let wallDist = RIFLE.range;
    for (const box of this.colliders) {
      wallDist = Math.min(wallDist, rayVsBox(origin, dir, box, 60));
    }
    const groundHit = dir.y < -0.01 ? -origin.y / dir.y : RIFLE.range;
    wallDist = Math.min(wallDist, groundHit > 0 ? groundHit : RIFLE.range);
    const end = new THREE.Vector3().copy(origin).addScaledVector(dir, wallDist);
    if (hits.length > 0 && hits[0].distance < wallDist) {
      const hit = hits[0];
      end.copy(hit.point);
      let node = hit.object;
      while (node && !node.userData.owner) node = node.parent;
      return { end, owner: node ? node.userData.owner : null };
    }
    return { end, owner: null, hitWall: wallDist < RIFLE.range };
  }

  // Where the crosshair points: the first thing along a ray from the
  // camera. The shot is then fired from the muzzle toward this point —
  // firing along the camera's own downward-tilted ray would drive every
  // shot into the ground past ~20 m.
  aimPoint(origin, dir, context) {
    return this.castShot(origin, dir, context).end;
  }

  // Dana fires from the muzzle toward a point. Returns 'shot', 'dry' or 'wait'.
  playerShoot(origin, dir, time, context, muzzlePos) {
    if (this.reloading) return 'wait';
    if (this.ammo <= 0) return 'dry';
    if (time - this.lastShotTime < RIFLE.interval) return 'wait';
    this.lastShotTime = time;
    this.ammo -= 1;
    if (muzzlePos) this.showMuzzleFlash(muzzlePos);
    const { end, owner, hitWall } = this.castShot(origin, dir, context);
    if (owner) {
      if (owner.kind === 'enemy') {
        this.damageEnemy(owner.ref, RIFLE.damage, context);
        context.onHitMarker?.();
      } else if (owner.kind === 'officer') {
        context.onOfficerShot?.(owner.ref);
        context.onHitMarker?.();
      } else if (owner.kind === 'ped') {
        context.onPedShot?.(owner.ref);
      }
    } else if (hitWall) {
      this.showSpark(end);
    }
    this.showTracer(muzzlePos || origin, end);
    return 'shot';
  }

  damageEnemy(enemy, damage, context) {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.deadTimer = 8;
      layHumanoidDown(enemy.rig);
      context.onEnemyKilled?.();
    }
  }

  spawnEnemy(x, z, isBoss = false) {
    const rig = createHumanoid(isBoss ? bossLook() : gangLook(this.rng), true);
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);
    const enemy = {
      rig, x, z, heading: this.rng.range(0, Math.PI * 2),
      hp: isBoss ? 300 : 68, isBoss,
      shootTimer: 1 + this.rng.next(), strafeDir: this.rng.pick([-1, 1]),
      strafeTimer: 2 + this.rng.next() * 2, deadTimer: 0,
    };
    rig.group.userData.owner = { kind: 'enemy', ref: enemy };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.rig.group);
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((enemy) => enemy.hp > 0);
  }

  // Enemies close to a firing lane, strafe, and shoot back.
  updateEnemies(dt, context) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy.hp <= 0) {
        enemy.deadTimer -= dt;
        if (enemy.deadTimer <= 0) {
          this.scene.remove(enemy.rig.group);
          this.enemies.splice(i, 1);
        }
        continue;
      }
      const dx = context.playerX - enemy.x;
      const dz = context.playerZ - enemy.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - enemy.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      enemy.heading += THREE.MathUtils.clamp(diff, -3 * dt, 3 * dt);
      // Advance until in range, then strafe sideways to stay lively.
      let moveX = 0;
      let moveZ = 0;
      let speed = 0;
      if (dist > 20) {
        speed = 4.2;
        moveX = Math.sin(enemy.heading);
        moveZ = Math.cos(enemy.heading);
      } else {
        enemy.strafeTimer -= dt;
        if (enemy.strafeTimer <= 0) {
          enemy.strafeTimer = 2 + this.rng.next() * 2;
          enemy.strafeDir *= -1;
        }
        speed = 1.6;
        moveX = Math.cos(enemy.heading) * enemy.strafeDir;
        moveZ = -Math.sin(enemy.heading) * enemy.strafeDir;
      }
      const pos = { x: enemy.x + moveX * speed * dt, z: enemy.z + moveZ * speed * dt };
      resolveCircleCollisionsLocal(pos, 0.5, this.colliders);
      enemy.x = pos.x;
      enemy.z = pos.z;
      enemy.rig.group.position.set(enemy.x, 0, enemy.z);
      enemy.rig.group.rotation.y = enemy.heading;
      animateHumanoid(enemy.rig, dt, speed, dist < 34);
      // Fire when in range with a line of fire.
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 34 && dist > 3) {
        enemy.shootTimer = 1.2 + this.rng.next() * 0.9;
        const muzzle = new THREE.Vector3();
        enemy.rig.muzzle.getWorldPosition(muzzle);
        const target = new THREE.Vector3(context.playerX, 1.2, context.playerZ);
        this.showTracer(muzzle, target);
        this.showMuzzleFlash(muzzle);
        if (this.rng.chance(0.38)) context.onPlayerShot?.(6 + this.rng.next() * 6);
      }
    }
  }

  update(dt) {
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = RIFLE.mag;
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      } else {
        this.flash.material.opacity = this.flashTimer / 0.06;
      }
    }
    for (const tracer of this.tracers) {
      if (tracer.timer > 0) {
        tracer.timer -= dt;
        tracer.mesh.material.opacity = Math.max(0, tracer.timer / 0.09) * 0.9;
        if (tracer.timer <= 0) tracer.mesh.visible = false;
      }
    }
    for (const spark of this.sparkPool) {
      if (spark.timer > 0) {
        spark.timer -= dt;
        spark.sprite.material.opacity = Math.max(0, spark.timer / 0.18);
        spark.sprite.scale.multiplyScalar(1 + dt * 4);
        if (spark.timer <= 0) spark.sprite.visible = false;
      }
    }
  }
}

// Local copy of the circle resolver (kept here so gunplay never imports
// the whole skyline for one helper).
function resolveCircleCollisionsLocal(pos, radius, colliders) {
  for (const box of colliders) {
    const nearestX = Math.max(box.x - box.hw, Math.min(pos.x, box.x + box.hw));
    const nearestZ = Math.max(box.z - box.hd, Math.min(pos.z, box.z + box.hd));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
}
