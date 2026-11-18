// Sunset Postcards: ten hidden collectibles across the city.
// One job: reward exploring — a spinning postcard at each landmark, worth
// $200 when Dana walks over it. The minimap shows the ones still out there.

import { POSTCARD_REWARD } from './settings.js';

export const POSTCARD_SPOTS = [
  { id: 'beach', name: 'South Beach', x: 0, z: 205 },
  { id: 'wheel', name: 'The Ferris Wheel', x: 60, z: 214 },
  { id: 'pier', name: 'Middle Pier End', x: 250, z: 0 },
  { id: 'tower', name: 'The Water Tower', x: 120, z: -120 },
  { id: 'north-park', name: 'North Park', x: -120, z: -72 },
  { id: 'east-park', name: 'East Park', x: 72, z: 72 },
  { id: 'hospital', name: 'Solmar General Steps', x: -72, z: -134 },
  { id: 'hideout', name: 'The Beach House', x: 150, z: 150 },
  { id: 'crane', name: 'The Dock Crane', x: 196, z: 96 },
  { id: 'station', name: 'SBPD Steps', x: -120, z: 134 },
];

function postcardFaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 80);
  gradient.addColorStop(0, '#3d2b5c');
  gradient.addColorStop(0.55, '#c65a7a');
  gradient.addColorStop(1, '#ffb36b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = '#fff2c0';
  ctx.beginPath();
  ctx.arc(96, 52, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#274b73';
  ctx.fillRect(0, 58, 128, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR BAY', 64, 22);
  ctx.font = '700 9px Arial, sans-serif';
  ctx.fillText('Greetings from the sunset coast', 64, 38);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 76);
  return new THREE.CanvasTexture(canvas);
}

export class Postcards {
  constructor(scene) {
    this.scene = scene;
    this.cards = [];
    this.collectedCount = 0;
    const face = postcardFaceTexture();
    for (const spot of POSTCARD_SPOTS) {
      const group = new THREE.Group();
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.62),
        new THREE.MeshStandardMaterial({
          map: face, side: THREE.DoubleSide, roughness: 0.6,
          emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.35,
        }),
      );
      group.add(card);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: face, color: 0xffd9a0, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(2.2, 2.2, 1);
      group.add(glow);
      group.position.set(spot.x, 1.6, spot.z);
      scene.add(group);
      this.cards.push({ spot, group, taken: false, spin: Math.random() * Math.PI * 2 });
    }
  }

  remaining() {
    return this.cards.filter((card) => !card.taken).map((card) => ({ x: card.spot.x, z: card.spot.z }));
  }

  collectedIds() {
    return this.cards.filter((card) => card.taken).map((card) => card.spot.id);
  }

  restore(ids) {
    const taken = new Set(ids || []);
    for (const card of this.cards) {
      if (taken.has(card.spot.id)) {
        card.taken = true;
        card.group.visible = false;
        this.collectedCount += 1;
      }
    }
  }

  update(dt, context) {
    for (const card of this.cards) {
      if (card.taken) continue;
      card.spin += dt * 1.6;
      card.group.rotation.y = card.spin;
      card.group.position.y = 1.6 + Math.sin(card.spin * 0.8) * 0.15;
      if (Math.hypot(context.playerX - card.spot.x, context.playerZ - card.spot.z) < 2.6) {
        card.taken = true;
        card.group.visible = false;
        this.collectedCount += 1;
        context.onPickup?.(card, POSTCARD_REWARD, this.collectedCount, this.cards.length);
      }
    }
  }
}
