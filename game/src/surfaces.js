// Procedural surfaces: every texture the city wears, painted on canvas.
// One job: turn palettes into CanvasTextures — facades with windows that
// glow at dusk, brick, glass, asphalt, sand, wood, signage — so no surface
// in the game is a flat colour. All textures repeat; none leaves the bundle.

function canvasTexture(width, height, paint, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

// Speckle a painted surface with fine noise so it reads as a material,
// not a colour swatch.
function grain(ctx, width, height, rng, alpha, light, dark) {
  for (let i = 0; i < width * height * 0.012; i += 1) {
    ctx.fillStyle = rng.chance(0.5) ? light : dark;
    ctx.globalAlpha = alpha * rng.next();
    const s = 1 + Math.floor(rng.next() * 2);
    ctx.fillRect(rng.next() * width, rng.next() * height, s, s);
  }
  ctx.globalAlpha = 1;
}

// ---- Facades ----
// A stucco front with a window grid. Returns { map, glow }: the glow canvas
// holds only the windows that are lit, warm amber, for the material's
// emissive map — at golden hour half the city has its lights on.
export function stuccoFacade(palette, floors, rng) {
  const lit = [];
  const map = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng, 0.05, '#ffffff', '#8a7a5a');
    const rows = floors;
    const cols = 4;
    const winW = 34;
    const winH = Math.floor(h / rows) - 26;
    for (let r = 0; r < rows; r += 1) {
      const y = 14 + r * Math.floor(h / rows);
      for (let c = 0; c < cols; c += 1) {
        const x = 12 + c * ((w - 24) / cols) + ((w - 24) / cols - winW) / 2;
        ctx.fillStyle = palette.trim;
        ctx.fillRect(x - 3, y - 3, winW + 6, winH + 6);
        ctx.fillStyle = palette.glass;
        ctx.fillRect(x, y, winW, winH);
        // A lit window: warm interior, drawn on the glow canvas too.
        if (rng.chance(0.42)) {
          ctx.fillStyle = '#ffca7a';
          ctx.fillRect(x, y, winW, winH);
          lit.push([x, y, winW, winH]);
        } else {
          // Glass glare: a diagonal sheen on the dark panes.
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath();
          ctx.moveTo(x, y + winH);
          ctx.lineTo(x + winW * 0.5, y);
          ctx.lineTo(x + winW * 0.8, y);
          ctx.lineTo(x + winW * 0.3, y + winH);
          ctx.closePath();
          ctx.fill();
        }
        // Mullion cross.
        ctx.fillStyle = 'rgba(30,30,40,0.55)';
        ctx.fillRect(x + winW / 2 - 1, y, 2, winH);
        ctx.fillRect(x, y + winH / 2 - 1, winW, 2);
      }
      // Floor shadow line.
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y + winH + 8, w, 3);
    }
  });
  const glow = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffb85e';
    for (const [x, y, winW, winH] of lit) ctx.fillRect(x, y, winW, winH);
  });
  return { map, glow };
}

// Weathered brick for the dock warehouses: courses, mortar, stains.
export function brickFacade(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a4553f';
    ctx.fillRect(0, 0, w, h);
    const bh = 10;
    const bw = 30;
    for (let y = 0, row = 0; y < h; y += bh, row += 1) {
      const offset = row % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw; x < w + bw; x += bw) {
        const shade = 0.85 + rng.next() * 0.3;
        ctx.fillStyle = `rgb(${Math.floor(168 * shade)},${Math.floor(88 * shade)},${Math.floor(66 * shade)})`;
        ctx.fillRect(x + offset + 1, y + 1, bw - 2, bh - 2);
      }
    }
    // Water stains running down from the roofline.
    ctx.fillStyle = 'rgba(40,25,15,0.18)';
    for (let i = 0; i < 7; i += 1) {
      const x = rng.next() * w;
      ctx.fillRect(x, 0, 4 + rng.next() * 8, 40 + rng.next() * 120);
    }
    grain(ctx, w, h, rng, 0.06, '#ffffff', '#3a2418');
  });
}

// Curtain glass for the mid-rise towers: dark reflective panes, mullions.
export function glassFacade(rng) {
  const lit = [];
  const map = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2c4258';
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 8;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = c * cw;
        const y = r * ch;
        const sunset = rng.chance(0.3);
        ctx.fillStyle = sunset ? '#7a5a7e' : `rgb(${44 + rng.next() * 22},${66 + rng.next() * 26},${88 + rng.next() * 30})`;
        ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        if (rng.chance(0.28)) {
          // Lit windows vary: some bright, some dim, some warm white —
          // a single flat amber reads as a checkerboard up close.
          const glowShade = rng.pick(['#ffd27a', '#ffd27a', '#c98a4a', '#fff0c8']);
          ctx.fillStyle = glowShade;
          ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
          lit.push([x + 2, y + 2, cw - 4, ch - 4, glowShade]);
        } else {
          ctx.fillStyle = 'rgba(255,190,120,0.10)';
          ctx.fillRect(x + 2, y + 2, cw - 4, 6);
        }
      }
    }
  });
  const glow = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    for (const [x, y, winW, winH, shade] of lit) {
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, winW, winH);
    }
  });
  return { map, glow };
}

// ---- Ground ----
// Asphalt: near-black with aggregate speckle and faint tyre-polish bands.
export function asphaltTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#33333a';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng, 0.16, '#9a9aa2', '#141416');
    // Tyre-polish bands along the driving line.
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(40, 0, 52, h);
    ctx.fillRect(164, 0, 52, h);
    // Hairline cracks.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      let x = rng.next() * w;
      let y = rng.next() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s += 1) {
        x += rng.range(-18, 18);
        y += rng.range(-18, 18);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, 8, 8);
}

// Sidewalk pavers: warm concrete slabs with joints and stains.
export function sidewalkTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng, 0.08, '#e8dcc0', '#7a6a4a');
    ctx.strokeStyle = 'rgba(60,50,35,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
    }
    // Oil and leaf stains.
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = `rgba(50,40,25,${0.05 + rng.next() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(rng.next() * w, rng.next() * h, 12 + rng.next() * 22, 8 + rng.next() * 14, rng.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 10, 10);
}

// Beach sand: pale grains with ripple ridges.
export function sandTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e6d199';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng, 0.12, '#fff2c8', '#b89a5e');
    ctx.strokeStyle = 'rgba(160,130,70,0.18)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 14) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
      ctx.stroke();
    }
  }, 12, 12);
}

// Sea: deep blue with sun glitter — scrolled slowly for a living swell.
export function seaTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#274b73';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      const warm = rng.chance(0.22);
      ctx.fillStyle = warm ? 'rgba(255,180,110,0.35)' : 'rgba(140,190,230,0.25)';
      const s = 1 + rng.next() * 3;
      ctx.fillRect(rng.next() * w, rng.next() * h, s * 3, s);
    }
    ctx.strokeStyle = 'rgba(200,230,255,0.10)';
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      const y = rng.next() * h;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 8, 170, y - 8, w, y);
      ctx.stroke();
    }
  }, 10, 10);
}

// Weathered dock planks: grey-brown boards with gaps and grain.
export function plankTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r += 1) {
      const shade = 0.85 + rng.next() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(142 * shade)},${Math.floor(112 * shade)},${Math.floor(78 * shade)})`;
      ctx.fillRect(0, r * rh + 1, w, rh - 2);
      ctx.strokeStyle = 'rgba(50,35,18,0.4)';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        const y = r * rh + 3 + rng.next() * (rh - 6);
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(80, y + 2, 170, y - 2, w, y);
        ctx.stroke();
      }
      // Nail heads.
      ctx.fillStyle = 'rgba(30,22,12,0.7)';
      ctx.fillRect(8, r * rh + rh / 2 - 1, 3, 3);
      ctx.fillRect(w - 11, r * rh + rh / 2 - 1, 3, 3);
    }
  }, 4, 4);
}

// Shipping-container ribs in a faded paint colour.
export function containerTexture(colour, rng) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 4, h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x + 4, 0, 3, h);
    }
    // Rust bleeding from the top edge.
    ctx.fillStyle = 'rgba(90,50,25,0.35)';
    for (let i = 0; i < 10; i += 1) {
      const x = rng.next() * w;
      ctx.fillRect(x, 0, 3 + rng.next() * 5, 12 + rng.next() * 40);
    }
    grain(ctx, w, h, rng, 0.08, '#ffffff', '#201408');
  });
}

// Flat roof: gravel grey with tar patches and a pale parapet line.
export function roofTexture(rng) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6e6a63';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng, 0.2, '#a8a49c', '#3a3733');
    ctx.fillStyle = 'rgba(20,18,16,0.3)';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(rng.next() * w, rng.next() * h, 14 + rng.next() * 26, 10 + rng.next() * 18);
    }
  }, 2, 2);
}

// ---- Signage and detail ----
// A shopfront sign: bold letters on a coloured board, with a soft glow
// strip so it reads at dusk. `sub` is a small second line.
export function shopSignTexture(name, sub, bg, fg, rng) {
  const glowName = name;
  const map = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Border + rivets.
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 58;
    ctx.font = `900 ${size}px Arial, sans-serif`;
    while (ctx.measureText(name).width > w - 40 && size > 22) {
      size -= 4;
      ctx.font = `900 ${size}px Arial, sans-serif`;
    }
    ctx.fillText(name, w / 2, sub ? h / 2 - 16 : h / 2 + 2);
    if (sub) {
      ctx.font = '700 24px Arial, sans-serif';
      ctx.fillText(sub, w / 2, h / 2 + 34);
    }
    grain(ctx, w, h, rng, 0.04, '#ffffff', '#000000');
  });
  // The glow canvas carries only the lettering, for the emissive map.
  const glow = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd9a0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 58;
    ctx.font = `900 ${size}px Arial, sans-serif`;
    while (ctx.measureText(glowName).width > w - 40 && size > 22) {
      size -= 4;
      ctx.font = `900 ${size}px Arial, sans-serif`;
    }
    ctx.fillText(glowName, w / 2, sub ? h / 2 - 16 : h / 2 + 2);
  });
  return { map, glow };
}

// Striped canvas awning: alternating bands, slightly faded.
export function awningTexture(colourA, colourB) {
  return canvasTexture(128, 64, (ctx, w, h) => {
    const bands = 8;
    for (let i = 0; i < bands; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? colourA : colourB;
      ctx.fillRect((i * w) / bands, 0, w / bands + 1, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);
  });
}

// A palm frond: long leaf with a rib and slits, alpha-cut at the edges.
export function frondTexture() {
  const tex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#2e7a35';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.quadraticCurveTo(w, h * 0.35, w * 0.62, h);
    ctx.quadraticCurveTo(w / 2, h * 0.92, w * 0.38, h);
    ctx.quadraticCurveTo(0, h * 0.35, w / 2, 0);
    ctx.fill();
    // Centre rib.
    ctx.strokeStyle = '#7fb069';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    // Slits: cut the leaf edge into leaflets.
    ctx.globalCompositeOperation = 'destination-out';
    for (let y = 18; y < h - 8; y += 10) {
      ctx.fillRect(0, y, 12, 3);
      ctx.fillRect(w - 12, y + 5, 12, 3);
    }
    ctx.globalCompositeOperation = 'source-over';
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Alloy wheel face: dark tyre ring, silver rim, five spokes.
export function wheelFaceTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#151517';
    ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a3f';
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8ccd2';
    ctx.beginPath(); ctx.arc(64, 64, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#232326';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate(a);
      ctx.fillRect(-5, -38, 10, 30);
      ctx.restore();
    }
    ctx.fillStyle = '#e8eaec';
    ctx.beginPath(); ctx.arc(64, 64, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a2f2f';
    ctx.beginPath(); ctx.arc(64, 64, 5, 0, Math.PI * 2); ctx.fill();
  });
}

// SBPD door roundel: a gold star badge + "SBPD" on the cruiser door.
export function policeDoorTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a2f4a';
    ctx.beginPath(); ctx.arc(64, 58, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b64c';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 30 : 13;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](64 + Math.cos(a) * r, 58 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 64, 116);
  });
}

// Terracotta roof tiles for the beachfront villas.
export function tileRoofTexture(rng) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b85c38';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        const shade = 0.85 + rng.next() * 0.3;
        ctx.fillStyle = `rgb(${Math.floor(190 * shade)},${Math.floor(96 * shade)},${Math.floor(58 * shade)})`;
        ctx.beginPath();
        ctx.arc(x + 8, y + 16, 8, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(x, y + 8, 16, 8);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 2);
  }, 3, 3);
}

// Park lawn: green with mowing stripes and dry patches.
export function lawnTexture(rng) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5d8a3c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i += 1) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, (i * h) / 8, w, h / 8);
      }
    }
    grain(ctx, w, h, rng, 0.14, '#8fbf5a', '#3c5a24');
    ctx.fillStyle = 'rgba(170,150,80,0.20)';
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.ellipse(rng.next() * w, rng.next() * h, 10 + rng.next() * 20, 6 + rng.next() * 10, rng.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 6, 6);
}
