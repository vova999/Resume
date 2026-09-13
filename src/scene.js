// ============================================
// RPG Resume — Scene Renderer
// World coordinate system: 640x360 (matches the playable street artwork)
// ============================================

import { getImage, getBgFrame } from './assets.js';

// World dimensions
export const WORLD_W = 640;
export const WORLD_H = 360;

// --- Interaction zones (rectangular boxes, world coords) ---
export const INTERACT_ZONES = [
  { id: 'oldlady',    label: 'About Tu', minX: 109, minY: 144, maxX: 149, maxY: 260 },
  { id: 'middleagedman', label: 'Experience', minX: 192, minY: 159, maxX: 229, maxY: 260 },
  { id: 'cartgirl',   label: 'Education', minX: 300, minY: 170, maxX: 363, maxY: 260 },
  { id: 'banhmiboy',  label: 'Skills & Tech', minX: 464, minY: 170, maxX: 544, maxY: 260 },
  { id: 'board',      label: 'Contact', minX: 554, minY: 162, maxX: 623, maxY: 260 },
  { id: 'threemen',   label: 'Hobbies', minX: 231, minY: 306, maxX: 345, maxY: 333 },
];

// --- Scene props (static + animated decorations) ---
export const SCENE_PROPS = [
  {
    id: 'threeMen',
    type: 'static',
    imageKey: 'threeMenScene',
    wx: 292, wy: 346,
    scale: 0.34,
  },
  {
    id: 'recyclingStation',
    type: 'static',
    imageKey: 'recyclingStation',
    wx: 133, wy: 346,
    scale: 0.5,
  },
];

// --- Moving vehicles ---
const MOVING_VEHICLES = [
  // xanhsm: drives from right to park spot, pauses 2s, drives off left, waits 8s
  {
    id: 'xanhsm',
    imageKey: 'electricTaxi',
    scale: 0.42,
    wy: 375,
    startX: 750, targetX: 458, exitX: -200,
    approachSpeed: 80, exitSpeed: 80, // world px/s
    pauseMs: 2000, waitMs: 8000,
    flipApproach: false, flipExit: false,
    layer: 0,
  },
  // grabbike left-to-right every 5s
  {
    id: 'grabbike-lr',
    imageKey: 'deliveryBike',
    scale: 0.36,
    wy: 365,
    startX: -80, exitX: 750,
    speed: 100,
    waitMs: 5000,
    flip: false,
    layer: 1,
  },
  // grabbike right-to-left every 7s
  {
    id: 'grabbike-rl',
    imageKey: 'deliveryBike',
    scale: 0.36,
    wy: 363,
    startX: 750, exitX: -80,
    speed: 100,
    waitMs: 7000,
    flip: true,
    layer: 0,
  },
];

// ============================================
// VIEWPORT — maps world coords to screen coords
// Uses "contain" fit (show full world, letterbox edges, maintain aspect ratio)
// ============================================
export function getViewport(screenW, screenH) {
  const videoAspect = WORLD_W / WORLD_H;
  const screenAspect = screenW / screenH;

  let scale, offsetX, offsetY;

  if (screenAspect > videoAspect) {
    // Screen is wider — fit to height, letterbox left/right
    scale = screenH / WORLD_H;
    offsetX = (screenW - WORLD_W * scale) / 2;
    offsetY = 0;
  } else {
    // Screen is taller — fit to width, letterbox top/bottom
    scale = screenW / WORLD_W;
    offsetX = 0;
    offsetY = (screenH - WORLD_H * scale) / 2;
  }

  return { scale, offsetX, offsetY };
}

export function worldToScreen(wx, wy, vp) {
  return {
    x: wx * vp.scale + vp.offsetX,
    y: wy * vp.scale + vp.offsetY,
  };
}

export function screenToWorld(sx, sy, vp) {
  return {
    x: (sx - vp.offsetX) / vp.scale,
    y: (sy - vp.offsetY) / vp.scale,
  };
}

// ============================================
// MAIN RENDER
// ============================================
export function renderScene(ctx, W, H, player, time) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  const vp = getViewport(W, H);

  // --- Layer 1: Playable street background ---
  const bgFrame = getBgFrame(time);
  if (bgFrame) {
    ctx.drawImage(bgFrame,
      0, 0, bgFrame.naturalWidth, bgFrame.naturalHeight,
      vp.offsetX, vp.offsetY, WORLD_W * vp.scale, WORLD_H * vp.scale
    );
  } else {
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, W, H);
  }

  // --- Layer 2: Lightweight ambient life over the static painted street ---
  drawStreetAtmosphere(ctx, vp, time);

  // --- Layer 3: Player character ---
  drawPlayer(ctx, player, vp, time);

  // --- Layer 4: Scene props ---
  drawProps(ctx, vp, time);

  // --- Layer 5: taxi (above player and props) ---
  drawMovingVehicles(ctx, vp, time, 0);

  // --- Layer 6: delivery bikes (above everything) ---
  drawMovingVehicles(ctx, vp, time, 1);
}

const STEAM_SOURCES = [
  { x: 261, y: 196 },
  { x: 325, y: 203 },
  { x: 505, y: 210 },
];

const REFLECTION_GLINTS = [
  { x: 47, y: 286, w: 8 },
  { x: 170, y: 310, w: 5 },
  { x: 255, y: 289, w: 7 },
  { x: 382, y: 315, w: 6 },
  { x: 491, y: 297, w: 9 },
  { x: 578, y: 318, w: 5 },
];

function drawStreetAtmosphere(ctx, vp, time) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Small, square-edged steam puffs keep the food stalls alive without
  // loading a full video frame sequence.
  STEAM_SOURCES.forEach((source, sourceIndex) => {
    for (let puff = 0; puff < 3; puff++) {
      const phase = (time / 55 + puff * 11 + sourceIndex * 7) % 30;
      const x = source.x + Math.round(Math.sin((time / 420) + puff) * 1.5);
      const y = source.y - phase;
      const size = Math.max(1, Math.round((2.8 - phase / 16) * vp.scale));
      ctx.globalAlpha = Math.max(0, 0.24 - phase / 145);
      ctx.fillStyle = '#f7ead0';
      ctx.fillRect(
        Math.round(x * vp.scale + vp.offsetX),
        Math.round(y * vp.scale + vp.offsetY),
        size,
        size
      );
    }
  });

  // Warm reflections pulse gently across the wet pavement.
  REFLECTION_GLINTS.forEach((glint, index) => {
    const pulse = (Math.sin(time / 520 + index * 1.7) + 1) / 2;
    ctx.globalAlpha = 0.08 + pulse * 0.12;
    ctx.fillStyle = index % 2 ? '#74b9b1' : '#f3bf67';
    ctx.fillRect(
      Math.round(glint.x * vp.scale + vp.offsetX),
      Math.round(glint.y * vp.scale + vp.offsetY),
      Math.max(2, Math.round(glint.w * vp.scale)),
      Math.max(1, Math.round(vp.scale))
    );
  });

  ctx.restore();
}

// ============================================
// DRAW INTERACTION POINTS
// ============================================
function drawProps(ctx, vp, time) {
  SCENE_PROPS.forEach(prop => {
    const { x: sx, y: sy } = worldToScreen(prop.wx, prop.wy, vp);
    const img = getImage(prop.imageKey);
    if (!img) return;

    if (prop.type === 'animated') {
      const animDur = prop.frames / prop.fps * 1000; // one cycle in ms
      const pause = (prop.pause || 0) * 1000;        // pause between cycles
      const cycle = animDur + pause;
      const t = time % cycle;
      const frameIdx = t < animDur
        ? Math.floor((t / 1000) * prop.fps) % prop.frames
        : prop.frames - 1; // hold last frame during pause
      const srcX = frameIdx * prop.fw;
      const dw = prop.fw * prop.scale * vp.scale;
      const dh = prop.fh * prop.scale * vp.scale;
      ctx.drawImage(img,
        srcX, 0, prop.fw, prop.fh,
        sx - dw / 2, sy - dh, dw, dh
      );
    } else {
      const dw = img.width * prop.scale * vp.scale;
      const dh = img.height * prop.scale * vp.scale;
      ctx.drawImage(img, sx - dw / 2, sy - dh, dw, dh);
    }
  });
}

// ============================================
// DRAW MOVING VEHICLES
// ============================================
function drawMovingVehicles(ctx, vp, time, layerFilter) {
  MOVING_VEHICLES.forEach(v => {
    if (v.layer !== layerFilter) return;
    const img = getImage(v.imageKey);
    if (!img) return;

    let wx, freeze = false;

    if (v.targetX !== undefined) {
      // --- xanhsm-style: approach → pause → exit → wait ---
      const approachDist = Math.abs(v.startX - v.targetX);
      const exitDist = Math.abs(v.targetX - v.exitX);
      const approachMs = (approachDist / v.approachSpeed) * 1000;
      const exitMs = (exitDist / v.exitSpeed) * 1000;
      const totalCycle = approachMs + v.pauseMs + exitMs + v.waitMs;
      const t = time % totalCycle;

      if (t < approachMs) {
        // Approaching
        const progress = t / approachMs;
        wx = v.startX + (v.targetX - v.startX) * progress;
      } else if (t < approachMs + v.pauseMs) {
        // Parked
        wx = v.targetX;
        freeze = true;
      } else if (t < approachMs + v.pauseMs + exitMs) {
        // Exiting
        const progress = (t - approachMs - v.pauseMs) / exitMs;
        wx = v.targetX + (v.exitX - v.targetX) * progress;
      } else {
        // Waiting (off screen)
        return;
      }
    } else {
      // --- grabbike-style: simple pass-through ---
      const dist = Math.abs(v.exitX - v.startX);
      const driveMs = (dist / v.speed) * 1000;
      const totalCycle = driveMs + v.waitMs;
      const t = time % totalCycle;

      if (t < driveMs) {
        const progress = t / driveMs;
        wx = v.startX + (v.exitX - v.startX) * progress;
      } else {
        return; // waiting off screen
      }
    }

    // Determine flip
    const shouldFlip = v.flip || (v.flipApproach && !freeze) || (v.flipExit && freeze);

    const { x: sx, y: sy } = worldToScreen(wx, v.wy, vp);
    const frameWidth = v.fw || img.naturalWidth;
    const frameHeight = v.fh || img.naturalHeight;
    const dw = frameWidth * v.scale * vp.scale;
    const dh = frameHeight * v.scale * vp.scale;
    const travelLift = freeze ? 0 : Math.round(Math.sin(time / 95) * 0.4 * vp.scale);

    ctx.fillStyle = 'rgba(10, 29, 33, 0.28)';
    ctx.fillRect(
      Math.round(sx - dw * 0.36),
      Math.round(sy - 3 * vp.scale),
      Math.round(dw * 0.72),
      Math.max(1, Math.round(2 * vp.scale))
    );

    ctx.save();
    if (shouldFlip) {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      if (v.fw) {
        const frameIdx = freeze ? 0 : Math.floor((time / (1000 / v.fps))) % v.frames;
        ctx.drawImage(img, frameIdx * v.fw, 0, v.fw, v.fh, -dw / 2, sy - dh + travelLift, dw, dh);
      } else {
        ctx.drawImage(img, -dw / 2, sy - dh + travelLift, dw, dh);
      }
    } else {
      if (v.fw) {
        const frameIdx = freeze ? 0 : Math.floor((time / (1000 / v.fps))) % v.frames;
        ctx.drawImage(img, frameIdx * v.fw, 0, v.fw, v.fh, sx - dw / 2, sy - dh + travelLift, dw, dh);
      } else {
        ctx.drawImage(img, sx - dw / 2, sy - dh + travelLift, dw, dh);
      }
    }
    ctx.restore();
  });
}

// ============================================
// ANIMATION CONFIG per direction
// ============================================
const ANIMS = {
  walk: {
    south: { key: 'walkSouth', fw: 118, fh: 118, frames: 8, fps: 10 },
    east:  { key: 'walkEast',  fw: 117, fh: 117, frames: 9, fps: 10 },
    west:  { key: 'walkWest',  fw: 118, fh: 118, frames: 9, fps: 10 },
    north: { key: 'walkNorth', fw: 118, fh: 118, frames: 11, fps: 10 },
  },
  // Multiple idle animations per direction (played one-shot, then pause)
  idle: {
    south: [
      { key: 'idleSouth1', fw: 118, fh: 118, frames: 16, fps: 8 },
      { key: 'idleSouth2', fw: 118, fh: 118, frames: 4, fps: 8 },
    ],
    east: [
      { key: 'idleEast1', fw: 117, fh: 117, frames: 16, fps: 8 },
      { key: 'idleEast2', fw: 117, fh: 117, frames: 16, fps: 8 },
    ],
    west: [
      { key: 'idleWest1', fw: 118, fh: 118, frames: 16, fps: 8 },
      { key: 'idleWest2', fw: 118, fh: 118, frames: 16, fps: 8 },
    ],
    north: [
      { key: 'idleNorth1', fw: 118, fh: 118, frames: 16, fps: 8 },
      { key: 'idleNorth2', fw: 118, fh: 118, frames: 16, fps: 8 },
    ],
  },
};

const FACING_TO_DIR = { down: 'south', up: 'north', left: 'west', right: 'east' };

// Idle animation state
const idleState = {
  stoppedAt: null,     // timestamp when player stopped moving (null = still moving)
  playing: false,      // is an idle animation currently playing?
  animStartTime: 0,    // when the current idle animation started
  animIndex: 0,        // which idle variant is playing
  firstDelay: 2000,    // ms before first idle animation triggers
  repeatDelay: 4000,   // ms between subsequent idle animations
  waitingForNext: false,
};

// ============================================
// DRAW PLAYER (world coords, directional animated spritesheets)
// ============================================
function drawPlayer(ctx, player, vp, time) {
  const { x: sx, y: sy } = worldToScreen(player.x, player.y, vp);
  const spriteScale = 0.6 * vp.scale;
  const dir = FACING_TO_DIR[player.facing] || 'south';

  // Shadow (positioned at character's feet)
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 4 * vp.scale, 9 * vp.scale, 2.5 * vp.scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.moving) {
    // --- WALKING ---
    idleState.stoppedAt = null;
    idleState.playing = false;
    idleState.waitingForNext = false;

    const anim = ANIMS.walk[dir];
    const sheet = anim ? getImage(anim.key) : null;
    if (sheet) {
      const frameIdx = Math.floor((time / (1000 / anim.fps))) % anim.frames;
      drawSpriteFrame(ctx, sheet, anim, frameIdx, sx, sy, spriteScale);
    } else {
      drawStaticFallback(ctx, dir, sx, sy, spriteScale, vp);
    }
    return;
  }

  // --- IDLE LOGIC ---
  const idleAnims = ANIMS.idle[dir];

  // Track when player stopped
  if (idleState.stoppedAt === null) {
    idleState.stoppedAt = time;
    idleState.playing = false;
    idleState.waitingForNext = false;
  }

  const timeSinceStopped = time - idleState.stoppedAt;

  if (idleState.playing) {
    // Currently playing an idle animation
    const anim = idleAnims[idleState.animIndex % idleAnims.length];
    const sheet = anim ? getImage(anim.key) : null;
    const elapsed = time - idleState.animStartTime;
    const animDuration = (anim.frames / anim.fps) * 1000;

    if (elapsed >= animDuration) {
      // Animation finished — go back to static, wait for next
      idleState.playing = false;
      idleState.waitingForNext = true;
      idleState.stoppedAt = time; // reset timer for next delay
      idleState.animIndex++;
      drawStaticFallback(ctx, dir, sx, sy, spriteScale, vp);
    } else if (sheet) {
      // Play current frame
      const frameIdx = Math.min(
        Math.floor((elapsed / 1000) * anim.fps),
        anim.frames - 1
      );
      drawSpriteFrame(ctx, sheet, anim, frameIdx, sx, sy, spriteScale);
    } else {
      drawStaticFallback(ctx, dir, sx, sy, spriteScale, vp);
    }
  } else {
    // Waiting to trigger an idle animation
    const delay = idleState.waitingForNext ? idleState.repeatDelay : idleState.firstDelay;

    if (timeSinceStopped >= delay && idleAnims && idleAnims.length > 0) {
      // Trigger idle animation
      idleState.playing = true;
      idleState.animStartTime = time;
      // Draw first frame immediately
      const anim = idleAnims[idleState.animIndex % idleAnims.length];
      const sheet = anim ? getImage(anim.key) : null;
      if (sheet) {
        drawSpriteFrame(ctx, sheet, anim, 0, sx, sy, spriteScale);
      } else {
        drawStaticFallback(ctx, dir, sx, sy, spriteScale, vp);
      }
    } else {
      // Static pose while waiting
      drawStaticFallback(ctx, dir, sx, sy, spriteScale, vp);
    }
  }
}

function drawSpriteFrame(ctx, sheet, anim, frameIdx, sx, sy, spriteScale) {
  const srcX = frameIdx * anim.fw;
  const dw = anim.fw * spriteScale;
  const dh = anim.fh * spriteScale;
  ctx.drawImage(sheet,
    srcX, 0, anim.fw, anim.fh,
    sx - dw / 2, sy - dh, dw, dh
  );
}

function drawStaticFallback(ctx, dir, sx, sy, spriteScale, vp) {
  const staticMap = { south: 'playerSouth', east: 'playerEast', west: 'playerWest', north: 'playerNorth' };
  const img = getImage(staticMap[dir]);
  if (img) {
    const dw = img.width * spriteScale;
    const dh = img.height * spriteScale;
    ctx.drawImage(img, sx - dw / 2, sy - dh, dw, dh);
  } else {
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(sx - 15 * vp.scale, sy - 40 * vp.scale, 30 * vp.scale, 40 * vp.scale);
  }
}

// ============================================
// GET NEARBY INTERACTION (player near zone box edge)
// ============================================
const INTERACT_PROXIMITY = 15; // must be within this many world pixels of the box edge

export function getNearbyInteraction(player) {
  let closest = null;
  let closestDist = INTERACT_PROXIMITY;

  for (const zone of INTERACT_ZONES) {
    // Distance from player to nearest point on box edge (0 if inside)
    const cx = Math.max(zone.minX, Math.min(zone.maxX, player.x));
    const cy = Math.max(zone.minY, Math.min(zone.maxY, player.y));
    const dist = Math.sqrt((player.x - cx) ** 2 + (player.y - cy) ** 2);
    if (dist < closestDist) {
      closestDist = dist;
      closest = zone;
    }
  }
  return closest;
}
