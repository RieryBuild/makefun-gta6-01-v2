// The hero: Dana on foot, Dana behind the wheel, and the camera that
// follows her. One job: turn input into motion — walk and run with a
// turning body, arcade driving with handbrake drifts and near misses, and
// a low, close third-person camera that keeps Dana LARGE in frame. The
// camera never goes through a wall: it pulls in when a building is behind
// her. On foot Dana stands on the terrain (beach dunes included); cars
// stay on the flat streets.

import { CAMERA, DRIVE, HERO } from './settings.js';
import { animateHumanoid, createHumanoid, heroLook, muzzleWorld } from './humanoid.js';
import { updateAutomobile } from './automobile.js';
import { pointIsSolid, resolveCircleCollisions } from './skyline.js';
import { groundHeight } from './terrain.js';

function angleLerp(current, target, rate, dt) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, rate * dt);
}

export class Hero {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.rig = createHumanoid(heroLook(), true);
    scene.add(this.rig.group);
    this.x = 0;
    this.z = 0;
    this.groundY = 0;
    this.heading = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.32;
    this.inCar = false;
    this.car = null;       // { vehicle, parkedRef, x, z, heading, speed, condition }
    this.carSpeed = 0;
    this.currentSpeed = 0; // m/s, on foot or driving, for the HUD and audio
    this.aiming = false;
    this.firing = false;
    this.drifting = false;
    this.nearMissCooldown = 0;
    this.smokeTimer = 0;
    this.cameraDistance = CAMERA.onFootDist;
    this.cameraShoulder = 0;
    this.fov = CAMERA.fov;
    this.camPos = new THREE.Vector3(0, 10, 20);
    this.camSnapped = false;
  }

  spawnAt(x, z, heading = 0) {
    if (this.inCar) this.exitCarSilent();
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.cameraYaw = heading;
    this.groundY = groundHeight(x, z);
    this.rig.group.position.set(x, this.groundY, z);
    this.rig.group.rotation.y = heading;
    this.rig.group.visible = true;
    this.camSnapped = false;
  }

  lookDirection() {
    return new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
  }

  muzzleWorldPosition() {
    return muzzleWorld(this.rig, new THREE.Vector3());
  }

  enterCar(parked, context) {
    parked.taken = true;
    this.inCar = true;
    this.car = {
      vehicle: parked.car, parkedRef: parked,
      x: parked.x, z: parked.z, heading: parked.heading,
      speed: 0, condition: 1,
    };
    this.rig.group.visible = false;
    this.cameraDistance = CAMERA.driveDist;
    if (!parked.own) context.onCrime?.('steal', 1);
    context.onEnterCar?.();
  }

  exitCar(context) {
    if (!this.inCar) return;
    const car = this.car;
    // Step out on the driver's side, clear of the car.
    const sideX = car.x + Math.cos(car.heading) * 2.4;
    const sideZ = car.z - Math.sin(car.heading) * 2.4;
    const pos = { x: sideX, z: sideZ };
    resolveCircleCollisions(pos, 0.5, this.colliders);
    car.parkedRef.x = car.x;
    car.parkedRef.z = car.z;
    car.parkedRef.heading = car.heading;
    car.parkedRef.taken = false;
    this.inCar = false;
    this.car = null;
    this.carSpeed = 0;
    this.x = pos.x;
    this.z = pos.z;
    this.groundY = groundHeight(this.x, this.z);
    this.rig.group.position.set(this.x, this.groundY, this.z);
    this.rig.group.visible = true;
    this.cameraDistance = CAMERA.onFootDist;
    context.onExitCar?.();
  }

  exitCarSilent() {
    if (!this.inCar) return;
    this.car.parkedRef.taken = false;
    this.inCar = false;
    this.car = null;
    this.carSpeed = 0;
    this.rig.group.visible = true;
  }

  // The sea stops Dana: the south waterline, and the east water past the
  // piers — except on a pier lane, where she can walk out to the end.
  eastLimit(z) {
    for (const pierZ of [-60, 0, 60]) {
      if (Math.abs(z - pierZ) < 3.2) return 256;
    }
    return 224;
  }

  updateOnFoot(dt, input, context) {
    // Move relative to the camera: W is "away from the camera".
    const forward = { x: Math.sin(this.cameraYaw), z: Math.cos(this.cameraYaw) };
    const right = { x: -forward.z, z: forward.x };
    let mx = 0;
    let mz = 0;
    if (input.held('KeyW')) { mx += forward.x; mz += forward.z; }
    if (input.held('KeyS')) { mx -= forward.x; mz -= forward.z; }
    if (input.held('KeyD')) { mx += right.x; mz += right.z; }
    if (input.held('KeyA')) { mx -= right.x; mz -= right.z; }
    const moving = Math.hypot(mx, mz) > 0.01;
    const running = input.held('ShiftLeft') || input.held('ShiftRight');
    const speed = this.aiming ? HERO.walk * 0.55 : running ? HERO.run : HERO.walk;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const pos = { x: this.x + mx * speed * dt, z: this.z + mz * speed * dt };
      resolveCircleCollisions(pos, 0.45, this.colliders);
      for (const circle of context.carCircles) {
        const dx = pos.x - circle.x;
        const dz = pos.z - circle.z;
        const dist = Math.hypot(dx, dz);
        if (dist < circle.r + 0.45 && dist > 1e-4) {
          pos.x = circle.x + (dx / dist) * (circle.r + 0.45);
          pos.z = circle.z + (dz / dist) * (circle.r + 0.45);
        }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, -225, this.eastLimit(pos.z));
      pos.z = THREE.MathUtils.clamp(pos.z, -225, 232);
      this.x = pos.x;
      this.z = pos.z;
      this.currentSpeed = speed;
      // Face the movement — or the camera, while aiming.
      const moveHeading = Math.atan2(mx, mz);
      this.heading = this.aiming
        ? angleLerp(this.heading, this.cameraYaw, 14, dt)
        : angleLerp(this.heading, moveHeading, 12, dt);
    } else {
      this.currentSpeed = 0;
      if (this.aiming) this.heading = angleLerp(this.heading, this.cameraYaw, 14, dt);
    }
    this.groundY = groundHeight(this.x, this.z);
    this.rig.group.position.set(this.x, this.groundY, this.z);
    this.rig.group.rotation.y = this.heading;
    animateHumanoid(this.rig, dt, this.currentSpeed, this.aiming);
  }

  updateDriving(dt, input, context) {
    const car = this.car;
    const forward = input.held('KeyW');
    const back = input.held('KeyS');
    const left = input.held('KeyA');
    const right = input.held('KeyD');
    const handbrake = input.held('Space');
    if (forward) car.speed += DRIVE.accel * dt * (car.condition < 0.25 ? 0.6 : 1);
    if (back) {
      car.speed -= (car.speed > 0.5 ? DRIVE.brake : DRIVE.accel * 0.7) * dt;
    }
    car.speed -= car.speed * DRIVE.drag * dt;
    const top = DRIVE.topSpeed * (0.55 + car.condition * 0.45);
    car.speed = THREE.MathUtils.clamp(car.speed, -DRIVE.reverse, top);
    // Steering: full lock at low speed, gentler as the speed rises.
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const steerAuthority = THREE.MathUtils.clamp(1.4 - Math.abs(car.speed) / 55, 0.45, 1.4);
    const steerAngle = steerInput * 0.5 * steerAuthority;
    const grip = handbrake ? DRIVE.handbrakeGrip : 1;
    car.heading += steerAngle * DRIVE.steerRate * dt * Math.sign(car.speed) * grip;
    this.drifting = handbrake && Math.abs(car.speed) > 12 && steerInput !== 0;
    const step = car.speed * dt;
    const pos = {
      x: car.x + Math.sin(car.heading) * step,
      z: car.z + Math.cos(car.heading) * step,
    };
    // Handbrake slides the car sideways, keeping some of its old line.
    if (this.drifting) {
      pos.x += Math.cos(car.heading) * steerInput * step * 0.45;
      pos.z -= Math.sin(car.heading) * steerInput * step * 0.45;
    }
    const before = { x: pos.x, z: pos.z };
    resolveCircleCollisions(pos, 2.1, this.colliders);
    if (Math.hypot(pos.x - before.x, pos.z - before.z) > 0.05 && Math.abs(car.speed) > 4) {
      this.registerCrash(Math.abs(car.speed), context);
      car.speed *= 0.35;
    }
    // Other cars: a soft bounce and a crumple.
    for (const circle of context.carCircles) {
      const dx = pos.x - circle.x;
      const dz = pos.z - circle.z;
      const dist = Math.hypot(dx, dz);
      if (dist < circle.r + 2.1 && dist > 1e-4) {
        pos.x = circle.x + (dx / dist) * (circle.r + 2.1);
        pos.z = circle.z + (dz / dist) * (circle.r + 2.1);
        if (Math.abs(car.speed) > 4) {
          this.registerCrash(Math.abs(car.speed), context);
          car.speed *= 0.45;
        }
      }
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -225, 224);
    pos.z = THREE.MathUtils.clamp(pos.z, -225, 232);
    car.x = pos.x;
    car.z = pos.z;
    this.x = car.x;
    this.z = car.z;
    this.carSpeed = car.speed;
    this.currentSpeed = Math.abs(car.speed);
    car.vehicle.group.position.set(car.x, 0, car.z);
    car.vehicle.group.rotation.y = car.heading;
    updateAutomobile(car.vehicle, car.speed, steerAngle, dt);
    // Pedestrians in the way go down — and the law notices.
    const ped = context.peds.nearestPed(car.x + Math.sin(car.heading) * 2.5, car.z + Math.cos(car.heading) * 2.5, 2.4);
    if (ped && Math.abs(car.speed) > 3) {
      context.peds.knockPedDown(ped);
      context.onCrime?.('hitPed', 2);
      this.registerCrash(Math.abs(car.speed) * 0.4, context);
    }
    // Near miss: threading past traffic at speed pays.
    this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt);
    if (Math.abs(car.speed) > 16 && this.nearMissCooldown <= 0) {
      for (const circle of context.carCircles) {
        const dist = Math.hypot(circle.x - car.x, circle.z - car.z);
        if (dist < 5.2 && dist > 3.4) {
          this.nearMissCooldown = 3;
          context.onNearMiss?.();
          break;
        }
      }
    }
    // Tyre smoke while drifting; engine smoke when the car is hurting.
    if (this.drifting) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.09;
        context.onTireSmoke?.(car.x - Math.sin(car.heading) * 1.6, car.z - Math.cos(car.heading) * 1.6);
      }
    }
    if (car.condition < 0.35) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.4;
        context.onTireSmoke?.(car.x + Math.sin(car.heading) * 1.8, car.z + Math.cos(car.heading) * 1.8);
      }
    }
  }

  registerCrash(speed, context) {
    context.onCrash?.(speed);
    if (this.car) {
      this.car.condition = Math.max(0.1, this.car.condition - 0.03 - speed * 0.0015);
    }
  }

  // A cruiser's ram shoves the car sideways.
  takeRam(fromX, fromZ) {
    if (!this.inCar) return;
    const dx = this.car.x - fromX;
    const dz = this.car.z - fromZ;
    const dist = Math.hypot(dx, dz) || 1;
    this.car.x += (dx / dist) * 1.6;
    this.car.z += (dz / dist) * 1.6;
    this.car.heading += 0.22 * (this.rng.next() > 0.5 ? 1 : -1);
    this.car.speed *= 0.7;
    this.registerCrash(10, { onCrash: () => {} });
  }

  // ---- The camera: low, close, and never inside a wall ----
  applyMouseLook(dx, dy) {
    this.cameraYaw -= dx * 0.0023;
    // Mouse up looks up: moving the mouse up (dy negative) raises the pitch.
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch - dy * 0.002, -0.12, 1.0);
  }

  snapCamera(camera, yaw, pitch, distance, height) {
    this.cameraYaw = yaw;
    this.cameraPitch = pitch;
    this.cameraDistance = distance;
    this.camSnapped = false;
    this.updateCamera(camera, 0.016, 0, height);
    this.camSnapped = true;
  }

  updateCamera(camera, dt, shake, forceHeight) {
    const inCar = this.inCar;
    const targetDist = inCar ? CAMERA.driveDist : CAMERA.onFootDist;
    this.cameraDistance += (targetDist - this.cameraDistance) * Math.min(1, dt * 4);
    // On foot the camera orbits freely; driving, it chases the car's line:
    // the view direction eases toward the car's heading, so the lens sits
    // behind the car looking where it is going.
    const camYaw = inCar
      ? angleLerp(this.cameraYaw, this.car.heading, 2.2, dt)
      : this.cameraYaw;
    if (inCar) this.cameraYaw = camYaw;
    // Aim pulls the camera over Dana's right shoulder.
    const shoulderTarget = !inCar && this.aiming ? CAMERA.onFootShoulder : 0;
    this.cameraShoulder += (shoulderTarget - this.cameraShoulder) * Math.min(1, dt * 8);
    // Where the camera wants to be.
    const headY = this.groundY + (inCar ? 1.7 : HERO.eyeHeight);
    const height = forceHeight ?? (inCar ? CAMERA.driveHeight : CAMERA.onFootHeight);
    const pitchDrop = Math.sin(this.cameraPitch) * this.cameraDistance;
    const desired = new THREE.Vector3(
      this.x - Math.sin(camYaw) * this.cameraDistance,
      headY + height - pitchDrop * 0.4,
      this.z - Math.cos(camYaw) * this.cameraDistance,
    );
    // Pull the camera in when a building stands between Dana and the lens.
    const head = new THREE.Vector3(this.x, headY, this.z);
    for (let t = 1; t > 0.25; t -= 0.12) {
      const probe = head.clone().lerp(desired, t);
      if (!pointIsSolid(probe.x, probe.z, this.colliders)) {
        desired.copy(probe);
        break;
      }
      if (t <= 0.3) desired.copy(head.clone().lerp(desired, 0.3));
    }
    desired.y = Math.max(desired.y, this.groundY + 0.6);
    // Shoulder offset, perpendicular to the view.
    const right = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
    desired.addScaledVector(right, -this.cameraShoulder);
    // Smooth the follow; snap on spawn and staging.
    if (!this.camSnapped) {
      this.camPos.copy(desired);
      this.camSnapped = true;
    } else {
      const rate = inCar ? 10 : 14;
      this.camPos.lerp(desired, Math.min(1, dt * rate));
    }
    // The view direction follows the pitch: looking up raises where the
    // camera looks, so the crosshair can sit on a distant enemy's chest
    // instead of the ground at its feet. The look target carries the same
    // shoulder offset as the lens — without it the view converges on the
    // centre line at 3 m and diverges past it, missing a 20 m target by
    // over a metre sideways.
    const lookAt = new THREE.Vector3(
      this.x + Math.sin(camYaw) * 3,
      headY + 0.4 + Math.sin(this.cameraPitch) * 2.0,
      this.z + Math.cos(camYaw) * 3,
    );
    lookAt.addScaledVector(right, -this.cameraShoulder);
    if (inCar) {
      lookAt.set(
        this.x + Math.sin(this.car.heading) * 6,
        headY + 0.2,
        this.z + Math.cos(this.car.heading) * 6,
      );
    }
    camera.position.copy(this.camPos);
    if (shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.5;
      camera.position.y += (Math.random() - 0.5) * shake * 0.4;
    }
    camera.lookAt(lookAt);
    // Speed stretches the field of view while driving.
    const targetFov = inCar
      ? CAMERA.driveFov + CAMERA.fovKick * Math.min(1, Math.abs(this.carSpeed) / DRIVE.topSpeed)
      : CAMERA.fov;
    if (Math.abs(this.fov - targetFov) > 0.05) {
      this.fov += (targetFov - this.fov) * Math.min(1, dt * 3);
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }
}
