// ============================================
// Asset Loader — RPG Resume
// ============================================

// Background frame config
const BG_TOTAL_FRAMES = 121;
const BG_FPS = 24;
const bgFrames = [];

export function getBgFrame(time) {
  if (bgFrames.length === 0) return null;
  const frameIdx = Math.floor((time / (1000 / BG_FPS))) % bgFrames.length;
  return bgFrames[frameIdx];
}

const MANIFEST = {
  // Player static directions
  playerSouth: '/assets/sprites/char/south.png',
  playerEast: '/assets/sprites/char/east.png',
  playerWest: '/assets/sprites/char/west.png',
  playerNorth: '/assets/sprites/char/north.png',

  // Player walk spritesheets
  walkSouth: '/assets/sprites/char/south-walking-sheet.png',
  walkEast: '/assets/sprites/char/east-walking-sheet.png',
  walkWest: '/assets/sprites/char/west-walking-sheet.png',
  walkNorth: '/assets/sprites/char/north-walking-sheet.png',

  // Player idle spritesheets (multiple per direction where available)
  idleSouth1: '/assets/sprites/char/south-idle1-sheet.png',
  idleSouth2: '/assets/sprites/char/south-idle2-sheet.png',
  idleEast1: '/assets/sprites/char/east-idle1-sheet.png',
  idleEast2: '/assets/sprites/char/east-idle2-sheet.png',
  idleWest1: '/assets/sprites/char/west-idle1-sheet.png',
  idleWest2: '/assets/sprites/char/west-idle2-sheet.png',
  idleNorth1: '/assets/sprites/char/north-idle1-sheet.png',
  idleNorth2: '/assets/sprites/char/north-idle2-sheet.png',

  // NPC sprites
  npcWoman: '/assets/sprites/woman-east.png',
  npcMan: '/assets/sprites/man-east.png',

  // Scene props
  threeMenSheet: '/assets/sprites/3men-sheet.png',
  trashbinet: '/assets/sprites/electric-trashbinet.png',
  grabbikeSheet: '/assets/sprites/grabbike-sheet.png',
  xanhsmSheet: '/assets/sprites/xanhsm-sheet.png',
};

const images = {};

export async function loadAssets(onProgress) {
  const entries = Object.entries(MANIFEST);
  const totalItems = entries.length + BG_TOTAL_FRAMES;
  let loaded = 0;

  function reportProgress() {
    loaded++;
    if (onProgress) onProgress(loaded / totalItems);
  }

  // Load sprite assets
  const spritePromises = entries.map(([key, src]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[key] = img; reportProgress(); resolve(); };
      img.onerror = () => { console.warn(`Failed to load: ${key}`); reportProgress(); resolve(); };
      img.src = src;
    });
  });

  // Load background frames
  const bgPromises = [];
  for (let i = 0; i < BG_TOTAL_FRAMES; i++) {
    const idx = String(i).padStart(3, '0');
    bgPromises.push(new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { bgFrames[i] = img; reportProgress(); resolve(); };
      img.onerror = () => { reportProgress(); resolve(); };
      img.src = `/assets/bg-frames/sprite_${idx}.png`;
    }));
  }

  await Promise.all([...spritePromises, ...bgPromises]);
  return images;
}

export function getImage(key) {
  return images[key] || null;
}
