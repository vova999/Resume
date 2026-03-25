// ============================================
// Vietnamese Street Scene - Pixel Art Renderer
// ============================================

import { sectionOrder } from './resumeData.js';

// Color palette - warm 90s Vietnamese aesthetic
const COLORS = {
  sky: '#1a1a3e',
  skyGradientBottom: '#2d1b4e',
  stars: '#ffd700',
  moon: '#ffeaa7',

  // Buildings
  buildingDark: '#2c1810',
  buildingMid: '#4a2c1a',
  buildingLight: '#6b3a1f',
  buildingPink: '#8b4557',
  buildingYellow: '#c49a3c',
  buildingTeal: '#2d6b5e',
  buildingBlue: '#2a3d66',

  // Details
  windowLit: '#ffd700',
  windowDark: '#1a1a2e',
  neonRed: '#ff3366',
  neonGreen: '#00ff88',
  neonYellow: '#ffd700',
  neonOrange: '#ff6b35',
  neonPink: '#ff69b4',

  // Street
  road: '#3a3a4a',
  sidewalk: '#5a4a3a',
  sidewalkLight: '#6b5a4a',

  // Props
  lanternRed: '#cc0000',
  lanternYellow: '#ffaa00',
  plantGreen: '#2d8b4a',
  woodBrown: '#6b4423',
  metalGray: '#8a8a9a',
};

// Pixel scale factor
let PX = 3;

// Hotspot areas (will be calculated during render)
export let hotspots = [];

// Stars cache
let stars = [];

function initStars(w, h) {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.3,
      size: Math.random() < 0.3 ? 2 : 1,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2,
    });
  }
}

// Draw a filled pixel-aligned rect
function pxRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Draw a pixel-art window
function drawWindow(ctx, x, y, w, h, lit, time) {
  const flicker = lit && Math.sin(time * 0.002 + x) > -0.1;
  pxRect(ctx, x, y, w, h, flicker ? COLORS.windowLit : COLORS.windowDark);
  if (flicker && lit) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  }
}

// Draw pixel-art Vietnamese lantern
function drawLantern(ctx, x, y, color, time) {
  const sway = Math.sin(time * 0.001 + x * 0.1) * 2;
  const lx = x + sway;

  // String
  pxRect(ctx, lx, y - 12, PX, 12, '#888');
  // Lantern body
  pxRect(ctx, lx - 6, y, 14, 18, color);
  pxRect(ctx, lx - 4, y - 2, 10, 2, color);
  pxRect(ctx, lx - 4, y + 18, 10, 2, color);
  // Tassel
  pxRect(ctx, lx, y + 20, PX, 6, color);
  pxRect(ctx, lx - 2, y + 26, PX, 4, color);

  // Glow
  const gradient = ctx.createRadialGradient(lx + 4, y + 9, 2, lx + 4, y + 9, 35);
  gradient.addColorStop(0, color === COLORS.lanternRed ? 'rgba(255,50,50,0.25)' : 'rgba(255,180,50,0.25)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(lx - 30, y - 25, 70, 70);
}

// Draw neon sign with glow
function drawNeonSign(ctx, x, y, text, color, time) {
  const flicker = Math.sin(time * 0.003 + text.length) > -0.85;
  if (!flicker) return;

  ctx.save();
  ctx.font = `${PX * 5}px 'Press Start 2P', monospace`;
  ctx.textBaseline = 'top';

  // Glow layers
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 8;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;

  // Bright core
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.4;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Draw a motorbike (parked)
function drawMotorbike(ctx, x, y, color) {
  // Wheels
  pxRect(ctx, x, y, 10, 10, '#333');
  pxRect(ctx, x + 2, y + 2, 6, 6, '#555');
  pxRect(ctx, x + 22, y, 10, 10, '#333');
  pxRect(ctx, x + 24, y + 2, 6, 6, '#555');

  // Body
  pxRect(ctx, x + 5, y - 8, 22, 8, color);
  pxRect(ctx, x + 8, y - 14, 8, 6, color);

  // Seat
  pxRect(ctx, x + 10, y - 18, 14, 4, '#222');

  // Handlebar
  pxRect(ctx, x + 4, y - 20, 3, 6, COLORS.metalGray);
  pxRect(ctx, x + 1, y - 22, 9, 3, COLORS.metalGray);
}

// Draw plastic stool (iconic Vietnamese street furniture)
function drawStool(ctx, x, y, color) {
  pxRect(ctx, x, y, 12, 4, color);
  pxRect(ctx, x + 1, y + 4, 2, 6, color);
  pxRect(ctx, x + 9, y + 4, 2, 6, color);
}

// Draw a food stall awning
function drawAwning(ctx, x, y, w, color1, color2) {
  const stripeW = 8;
  for (let i = 0; i < w; i += stripeW * 2) {
    pxRect(ctx, x + i, y, stripeW, 10, color1);
    pxRect(ctx, x + i + stripeW, y, stripeW, 10, color2);
  }
  // Scalloped edge
  for (let i = 0; i < w; i += 6) {
    pxRect(ctx, x + i, y + 10, 4, 4, (i / 6) % 2 === 0 ? color1 : color2);
  }
}

// Draw hanging string lights across the street
function drawStringLights(ctx, x1, y1, x2, y2, time) {
  const segments = 12;
  const sag = 25;

  ctx.beginPath();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.moveTo(x1, y1);

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag;
    points.push({ x: px, y: py });
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Bulbs
  for (let i = 1; i < points.length - 1; i += 2) {
    const bulbColors = [COLORS.neonRed, COLORS.neonYellow, COLORS.neonGreen, COLORS.neonOrange, COLORS.neonPink];
    const color = bulbColors[i % bulbColors.length];
    const on = Math.sin(time * 0.002 + i * 1.5) > -0.3;

    if (on) {
      ctx.fillStyle = color;
      ctx.fillRect(points[i].x - 2, points[i].y, 5, 5);

      const glow = ctx.createRadialGradient(points[i].x, points[i].y + 2, 1, points[i].x, points[i].y + 2, 15);
      glow.addColorStop(0, color.replace(')', ',0.3)').replace('rgb', 'rgba'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(points[i].x - 15, points[i].y - 12, 30, 30);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillRect(points[i].x - 2, points[i].y, 5, 5);
    }
  }
}

// Draw electric wires (tangled, Vietnamese style)
function drawWires(ctx, w, baseY) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;

  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const startY = baseY + i * 3 - 8;
    ctx.moveTo(0, startY + Math.sin(i) * 5);
    for (let x = 0; x < w; x += 50) {
      ctx.lineTo(x + 25, startY + Math.sin(x * 0.01 + i) * (3 + i));
    }
    ctx.lineTo(w, startY + Math.sin(w * 0.01 + i) * 5);
    ctx.stroke();
  }
}

// Draw rain effect
function drawRain(ctx, w, h, time) {
  ctx.strokeStyle = 'rgba(150, 180, 255, 0.15)';
  ctx.lineWidth = 1;
  const rainSpeed = time * 0.3;
  for (let i = 0; i < 60; i++) {
    const rx = (i * 37 + rainSpeed) % w;
    const ry = (i * 53 + rainSpeed * 1.5) % h;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 2, ry + 8);
    ctx.stroke();
  }
}

// ============================================
// MAIN SCENE RENDER
// ============================================
export function renderScene(canvas, time) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Responsive pixel size
  PX = W < 600 ? 2 : W < 1000 ? 3 : 3;

  if (stars.length === 0) initStars(W, H);

  ctx.clearRect(0, 0, W, H);
  hotspots = [];

  // ---- Sky gradient ----
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  skyGrad.addColorStop(0, '#0a0a1e');
  skyGrad.addColorStop(0.5, '#1a1a3e');
  skyGrad.addColorStop(1, '#2d1b4e');
  pxRect(ctx, 0, 0, W, H * 0.55, '#000');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.55);

  // ---- Stars ----
  stars.forEach(s => {
    const alpha = 0.4 + Math.sin(time * 0.001 * s.speed + s.twinkle) * 0.4;
    ctx.fillStyle = `rgba(255, 215, 100, ${alpha})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });

  // ---- Moon ----
  const moonX = W * 0.82;
  const moonY = H * 0.08;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 60);
  moonGlow.addColorStop(0, 'rgba(255, 234, 167, 0.4)');
  moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(moonX - 60, moonY - 60, 120, 120);
  pxRect(ctx, moonX - 8, moonY - 8, 16, 16, COLORS.moon);
  pxRect(ctx, moonX - 6, moonY - 10, 12, 2, COLORS.moon);
  pxRect(ctx, moonX - 4, moonY - 3, 4, 4, '#ddc');

  // ---- Layout calculations ----
  const groundY = H * 0.75;
  const streetY = H * 0.82;
  const buildingBaseY = groundY;

  // ---- Electric wires ----
  drawWires(ctx, W, H * 0.2);

  // ---- BACKGROUND BUILDINGS (far) ----
  const farBuildingY = H * 0.25;
  pxRect(ctx, W * 0.05, farBuildingY, W * 0.12, groundY - farBuildingY, '#1a1020');
  pxRect(ctx, W * 0.2, farBuildingY + 20, W * 0.1, groundY - farBuildingY - 20, '#1c1225');
  pxRect(ctx, W * 0.65, farBuildingY + 10, W * 0.15, groundY - farBuildingY - 10, '#1a1020');
  pxRect(ctx, W * 0.85, farBuildingY + 30, W * 0.12, groundY - farBuildingY - 30, '#1c1225');

  // Far building windows (dim)
  for (let bx = W * 0.06; bx < W * 0.16; bx += 14) {
    for (let by = farBuildingY + 8; by < groundY - 20; by += 16) {
      if (Math.random() > 0.3) {
        pxRect(ctx, bx, by, 6, 8, 'rgba(255,200,100,0.15)');
      }
    }
  }

  // ---- STRING LIGHTS across street ----
  drawStringLights(ctx, W * 0.08, H * 0.28, W * 0.92, H * 0.26, time);
  drawStringLights(ctx, W * 0.05, H * 0.35, W * 0.95, H * 0.33, time);

  // ============================================
  // LEFT SIDE BUILDINGS
  // ============================================

  // == BUILDING 1: PHỞ STALL (About Me) ==
  const b1x = W * 0.02;
  const b1w = W * 0.22;
  const b1h = H * 0.42;
  const b1y = buildingBaseY - b1h;

  // Main structure
  pxRect(ctx, b1x, b1y, b1w, b1h, COLORS.buildingPink);
  pxRect(ctx, b1x, b1y, b1w, 6, '#6b3040');

  // Balcony
  pxRect(ctx, b1x, b1y + b1h * 0.35, b1w + 8, 5, COLORS.woodBrown);
  // Laundry
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(b1x + 5, b1y + b1h * 0.36);
  ctx.lineTo(b1x + b1w - 5, b1y + b1h * 0.36);
  ctx.stroke();
  // Clothes
  const clothColors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71'];
  for (let i = 0; i < 4; i++) {
    pxRect(ctx, b1x + 10 + i * 18, b1y + b1h * 0.36 + 2, 10, 12, clothColors[i]);
  }

  // Windows
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      drawWindow(ctx, b1x + 10 + col * (b1w / 3.5), b1y + 12 + row * 30, 14, 18, true, time);
    }
  }

  // Food stall awning at ground level
  const stallY = buildingBaseY - 40;
  drawAwning(ctx, b1x, stallY, b1w + 10, '#cc0000', '#ffffff');

  // Stall counter
  pxRect(ctx, b1x, buildingBaseY - 20, b1w + 5, 20, COLORS.woodBrown);
  // Steam pots
  pxRect(ctx, b1x + 8, buildingBaseY - 30, 16, 12, COLORS.metalGray);
  pxRect(ctx, b1x + 30, buildingBaseY - 28, 14, 10, COLORS.metalGray);
  // Steam
  for (let i = 0; i < 3; i++) {
    const sy = buildingBaseY - 35 - i * 8 + Math.sin(time * 0.003 + i * 2) * 3;
    ctx.fillStyle = `rgba(255,255,255,${0.15 - i * 0.04})`;
    ctx.fillRect(b1x + 12 + Math.sin(time * 0.002 + i) * 3, sy, 6, 3);
  }

  // PHỞ sign
  drawNeonSign(ctx, b1x + 10, stallY - 28, 'PHỞ', COLORS.neonRed, time);

  // Plastic stools in front
  drawStool(ctx, b1x + 5, buildingBaseY + 2, '#e74c3c');
  drawStool(ctx, b1x + 22, buildingBaseY + 5, '#3498db');
  drawStool(ctx, b1x + 40, buildingBaseY + 3, '#f39c12');

  hotspots.push({
    id: 'about',
    x: b1x, y: stallY - 30,
    w: b1w + 10, h: buildingBaseY - stallY + 40,
    label: 'Phở Stall → About Me',
  });


  // == BUILDING 2: BULLETIN BOARD WALL (Experience) ==
  const b2x = W * 0.26;
  const b2w = W * 0.2;
  const b2h = H * 0.48;
  const b2y = buildingBaseY - b2h;

  pxRect(ctx, b2x, b2y, b2w, b2h, COLORS.buildingYellow);
  pxRect(ctx, b2x, b2y, b2w, 5, '#a07c2c');

  // Shuttered windows
  for (let col = 0; col < 2; col++) {
    const wx = b2x + 12 + col * (b2w / 2.2);
    const wy = b2y + 15;
    pxRect(ctx, wx, wy, 20, 24, COLORS.windowDark);
    // Shutters
    pxRect(ctx, wx - 4, wy, 4, 24, '#7a6020');
    pxRect(ctx, wx + 20, wy, 4, 24, '#7a6020');
  }

  // Balcony with plants
  pxRect(ctx, b2x - 3, b2y + b2h * 0.4, b2w + 6, 5, '#8a7a5a');
  // Plant pots
  for (let i = 0; i < 3; i++) {
    pxRect(ctx, b2x + 5 + i * 25, b2y + b2h * 0.4 - 10, 10, 10, '#8b4513');
    pxRect(ctx, b2x + 3 + i * 25, b2y + b2h * 0.4 - 18, 14, 10, COLORS.plantGreen);
  }

  // Bulletin board
  const bbx = b2x + 8;
  const bby = buildingBaseY - 70;
  pxRect(ctx, bbx, bby, b2w - 16, 55, '#3a2a15');
  pxRect(ctx, bbx + 3, bby + 3, b2w - 22, 49, '#f5e6c8');
  // Paper notes
  const noteColors = ['#fff5e6', '#ffe0e0', '#e0f0ff', '#e8ffe0', '#fff0d0'];
  for (let i = 0; i < 5; i++) {
    pxRect(ctx, bbx + 6 + (i % 3) * 18, bby + 7 + Math.floor(i / 3) * 22, 14, 18, noteColors[i]);
    // Text lines
    for (let l = 0; l < 3; l++) {
      pxRect(ctx, bbx + 8 + (i % 3) * 18, bby + 11 + Math.floor(i / 3) * 22 + l * 4, 10, 1, '#999');
    }
  }

  // "TIN TỨC" sign above board
  drawNeonSign(ctx, b2x + 10, bby - 25, 'TIN TỨC', COLORS.neonYellow, time);

  hotspots.push({
    id: 'experience',
    x: b2x, y: bby - 28,
    w: b2w, h: buildingBaseY - bby + 28,
    label: 'Bulletin Board → Experience',
  });


  // == BUILDING 3: BOOKSHOP (Skills/Education) ==
  const b3x = W * 0.48;
  const b3w = W * 0.18;
  const b3h = H * 0.38;
  const b3y = buildingBaseY - b3h;

  pxRect(ctx, b3x, b3y, b3w, b3h, COLORS.buildingTeal);
  pxRect(ctx, b3x, b3y, b3w, 4, '#1d4b3e');

  // Windows on upper floor
  for (let col = 0; col < 2; col++) {
    drawWindow(ctx, b3x + 8 + col * (b3w / 2.5), b3y + 10, 16, 20, col === 0, time);
  }

  // Bookshelf storefront
  const shelfY = buildingBaseY - 55;
  pxRect(ctx, b3x + 3, shelfY, b3w - 6, 55, COLORS.woodBrown);
  // Book rows
  const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e74c3c', '#1abc9c'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const bw = 5 + Math.floor(Math.random() * 4);
      pxRect(ctx, b3x + 7 + col * 12, shelfY + 4 + row * 16, bw, 12, bookColors[(row + col) % bookColors.length]);
    }
    pxRect(ctx, b3x + 5, shelfY + 16 + row * 16, b3w - 10, 2, '#5a3a15');
  }

  // "SÁCH" sign
  drawNeonSign(ctx, b3x + 12, shelfY - 22, 'SÁCH', COLORS.neonGreen, time);

  hotspots.push({
    id: 'skills',
    x: b3x, y: shelfY - 25,
    w: b3w, h: buildingBaseY - shelfY + 25,
    label: 'Bookshop → Skills & Education',
  });


  // ============================================
  // RIGHT SIDE BUILDINGS
  // ============================================

  // == BUILDING 4: TV/ELECTRONICS SHOP (Projects) ==
  const b4x = W * 0.68;
  const b4w = W * 0.17;
  const b4h = H * 0.45;
  const b4y = buildingBaseY - b4h;

  pxRect(ctx, b4x, b4y, b4w, b4h, COLORS.buildingBlue);
  pxRect(ctx, b4x, b4y, b4w, 5, '#1a2d56');

  // Windows
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      drawWindow(ctx, b4x + 10 + col * (b4w / 2.5), b4y + 12 + row * 28, 14, 18, true, time);
    }
  }

  // TV Display
  const tvY = buildingBaseY - 60;
  pxRect(ctx, b4x + 5, tvY, b4w - 10, 50, '#1a1a2e');
  // TV screens
  for (let i = 0; i < 3; i++) {
    const tx = b4x + 10 + i * ((b4w - 24) / 3);
    pxRect(ctx, tx, tvY + 5, 18, 14, '#111');
    // Animated screen content
    const screenPhase = (time * 0.002 + i * 2) % 6;
    const screenColor = screenPhase < 2 ? '#0066ff' : screenPhase < 4 ? '#00cc66' : '#ff6600';
    pxRect(ctx, tx + 2, tvY + 7, 14, 10, screenColor);
    // Scan lines
    for (let sl = 0; sl < 5; sl++) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(tx + 2, tvY + 7 + sl * 2, 14, 1);
    }
  }
  // Larger TV below
  pxRect(ctx, b4x + 15, tvY + 22, 30, 22, '#111');
  const mainScreenColor = `hsl(${(time * 0.05) % 360}, 70%, 40%)`;
  pxRect(ctx, b4x + 17, tvY + 24, 26, 18, mainScreenColor);

  // "ĐIỆN TỬ" sign
  drawNeonSign(ctx, b4x + 5, tvY - 22, 'ĐIỆN TỬ', COLORS.neonOrange, time);

  // Antenna on roof
  pxRect(ctx, b4x + b4w / 2, b4y - 20, 2, 20, COLORS.metalGray);
  pxRect(ctx, b4x + b4w / 2 - 8, b4y - 18, 16, 2, COLORS.metalGray);
  pxRect(ctx, b4x + b4w / 2 - 5, b4y - 24, 10, 2, COLORS.metalGray);

  hotspots.push({
    id: 'projects',
    x: b4x, y: tvY - 25,
    w: b4w, h: buildingBaseY - tvY + 25,
    label: 'Electronics Shop → Projects',
  });


  // == BUILDING 5: POST OFFICE / PHONE (Contact) ==
  const b5x = W * 0.87;
  const b5w = W * 0.12;
  const b5h = H * 0.4;
  const b5y = buildingBaseY - b5h;

  pxRect(ctx, b5x, b5y, b5w, b5h, COLORS.buildingLight);
  pxRect(ctx, b5x, b5y, b5w, 4, '#5b2a0f');

  // Door
  pxRect(ctx, b5x + b5w / 2 - 8, buildingBaseY - 30, 16, 30, '#3a1a0a');
  pxRect(ctx, b5x + b5w / 2 + 4, buildingBaseY - 18, 3, 3, COLORS.neonYellow);

  // Window
  drawWindow(ctx, b5x + 8, b5y + 15, 16, 20, true, time);

  // Mailbox
  const mbx = b5x + 5;
  const mby = buildingBaseY - 35;
  pxRect(ctx, mbx, mby, 14, 18, '#cc3300');
  pxRect(ctx, mbx + 3, mby + 6, 8, 2, '#ff6600');
  pxRect(ctx, mbx, mby - 2, 14, 4, '#aa2200');

  // "BƯU ĐIỆN" sign
  drawNeonSign(ctx, b5x - 5, b5y + b5h * 0.45, 'BĐ', COLORS.neonPink, time);

  hotspots.push({
    id: 'contact',
    x: b5x - 5, y: b5y,
    w: b5w + 10, h: b5h,
    label: 'Post Office → Contact',
  });


  // == EDUCATION (above bookshop) ==
  hotspots.push({
    id: 'education',
    x: b3x, y: b3y,
    w: b3w, h: b3y + b3h * 0.5 - b3y,
    label: 'Upper Floor → Education',
  });


  // ============================================
  // STREET LEVEL
  // ============================================

  // Sidewalk
  pxRect(ctx, 0, buildingBaseY, W, streetY - buildingBaseY, COLORS.sidewalk);
  // Sidewalk tiles
  for (let tx = 0; tx < W; tx += 20) {
    pxRect(ctx, tx, buildingBaseY, 1, streetY - buildingBaseY, COLORS.sidewalkLight);
  }

  // Road
  pxRect(ctx, 0, streetY, W, H - streetY, COLORS.road);
  // Road center line
  for (let lx = 0; lx < W; lx += 30) {
    pxRect(ctx, lx, streetY + (H - streetY) / 2 - 1, 15, 2, '#555');
  }

  // Puddle reflections
  for (let i = 0; i < 3; i++) {
    const px = W * 0.15 + i * W * 0.3;
    const py = streetY + 10 + i * 5;
    ctx.fillStyle = `rgba(100, 120, 200, ${0.08 + Math.sin(time * 0.001 + i) * 0.03})`;
    ctx.fillRect(px, py, 40 + i * 10, 3);
  }

  // ---- Motorbikes on street ----
  drawMotorbike(ctx, W * 0.15, streetY + 10, '#e74c3c');
  drawMotorbike(ctx, W * 0.55, streetY + 15, '#3498db');
  drawMotorbike(ctx, W * 0.78, streetY + 8, '#27ae60');

  // ---- Lanterns ----
  drawLantern(ctx, W * 0.12, H * 0.35, COLORS.lanternRed, time);
  drawLantern(ctx, W * 0.35, H * 0.32, COLORS.lanternYellow, time);
  drawLantern(ctx, W * 0.58, H * 0.34, COLORS.lanternRed, time);
  drawLantern(ctx, W * 0.75, H * 0.31, COLORS.lanternYellow, time);
  drawLantern(ctx, W * 0.92, H * 0.33, COLORS.lanternRed, time);

  // ---- Light rain effect ----
  drawRain(ctx, W, H, time);

  // ---- Ambient ground glow from stalls ----
  const groundGlow = ctx.createLinearGradient(0, buildingBaseY - 10, 0, buildingBaseY + 20);
  groundGlow.addColorStop(0, 'rgba(255, 150, 50, 0.08)');
  groundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = groundGlow;
  ctx.fillRect(0, buildingBaseY - 10, W, 30);

  // ---- Vignette ----
  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  return hotspots;
}
