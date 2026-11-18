// The radar: a living minimap of Solmar Bay.
// One job: show where Dana is, where the job is, and where the law is —
// streets, water, beach and parks painted once, then the player arrow,
// the gold waypoint, police blips and enemy dots redrawn every frame.

import { STREET_LINES } from './settings.js';

const VIEW_HALF = 215; // world metres from the centre to the map's edge

export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = this.size;
    this.staticLayer.height = this.size;
    this.paintStaticLayer();
  }

  toMap(x, z) {
    const s = this.size / (VIEW_HALF * 2);
    return { x: this.size / 2 + x * s, y: this.size / 2 + z * s };
  }

  paintStaticLayer() {
    const ctx = this.staticLayer.getContext('2d');
    const s = this.size / (VIEW_HALF * 2);
    // Land: dark green-grey; the sea eats the east and the south.
    ctx.fillStyle = '#2a3325';
    ctx.fillRect(0, 0, this.size, this.size);
    ctx.fillStyle = '#274b73';
    const eastEdge = this.toMap(225, 0).x;
    ctx.fillRect(eastEdge, 0, this.size - eastEdge, this.size);
    const southEdge = this.toMap(0, 238).y;
    ctx.fillRect(0, southEdge, this.size, this.size - southEdge);
    // Sand along the south shore.
    ctx.fillStyle = '#c9b078';
    const sandTop = this.toMap(0, 196).y;
    ctx.fillRect(0, sandTop, this.size, southEdge - sandTop);
    // Parks.
    ctx.fillStyle = '#4a7a2e';
    for (const [px, pz] of [[72, 72], [-120, -72]]) {
      const p = this.toMap(px - 17, pz - 17);
      ctx.fillRect(p.x, p.y, 34 * s, 34 * s);
    }
    // Streets.
    ctx.strokeStyle = '#5a6258';
    ctx.lineWidth = Math.max(2, 14 * s);
    for (const line of STREET_LINES) {
      const v = this.toMap(line, 0);
      ctx.beginPath();
      ctx.moveTo(v.x, this.toMap(0, -192).y);
      ctx.lineTo(v.x, this.toMap(0, 192).y);
      ctx.stroke();
      const h = this.toMap(0, line);
      ctx.beginPath();
      ctx.moveTo(this.toMap(-192, 0).x, h.y);
      ctx.lineTo(this.toMap(192, 0).x, h.y);
      ctx.stroke();
    }
    // The garage: a home marker the player learns to find.
    const garage = this.toMap(-24, -24);
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(garage.x - 2, garage.y - 2, 4, 4);
    // North marker.
    ctx.fillStyle = '#e8e6e0';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', this.size / 2, 13);
  }

  draw(view) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.staticLayer, 0, 0);
    // Postcards still out there: small gold dots.
    ctx.fillStyle = '#ffd23a';
    for (const card of view.collectibles) {
      const p = this.toMap(card.x, card.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies: red dots.
    ctx.fillStyle = '#ff3a2e';
    for (const enemy of view.enemies) {
      const p = this.toMap(enemy.x, enemy.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police: flashing blue/red blips; the helicopter is a ring.
    for (const blip of view.police) {
      const p = this.toMap(blip.x, blip.z);
      if (blip.kind === 'heli') {
        ctx.strokeStyle = '#7ab8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = Math.sin(view.time * 10) > 0 ? '#ff3a2e' : '#3a7aff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Waypoint: a pulsing gold diamond.
    if (view.waypoint) {
      const p = this.toMap(view.waypoint.x, view.waypoint.z);
      const pulse = 5 + Math.sin(view.time * 4) * 1.5;
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - pulse);
      ctx.lineTo(p.x + pulse, p.y);
      ctx.lineTo(p.x, p.y + pulse);
      ctx.lineTo(p.x - pulse, p.y);
      ctx.closePath();
      ctx.fill();
    }
    // The player: a white arrow that turns with the heading.
    const p = this.toMap(view.playerX, view.playerZ);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(view.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#14161c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
