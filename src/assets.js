// ============================================
// Asset Loader — RPG Resume
// ============================================

export function getBgFrame() {
  return images.streetBackground || null;
}

const MANIFEST = {
  // Playable street
  streetBackground: '/assets/street-bg-v2.webp',

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

  // Character portraits (visual novel dialog)
  maincharPortrait: '/assets/sprites/mainchar-v2.webp',
  oldladyPortrait: '/assets/sprites/oldlady-v2.webp',
  middleagedmanPortrait: '/assets/sprites/middleagedman-v2.webp',
  cartgirlPortrait: '/assets/sprites/cartgirl-v2.webp',
  banhmiPortrait: '/assets/sprites/banhmi-v2.webp',
  threemenPortrait: '/assets/sprites/3men-v2.webp',
  boardPortrait: '/assets/sprites/board.webp',

  // NPC sprites
  npcWoman: '/assets/sprites/woman-east.png',
  npcMan: '/assets/sprites/man-east.png',

  // Scene props
  threeMenScene: '/assets/sprites/3men-scene-v2.webp',
  recyclingStation: '/assets/sprites/recycling-station-v2.webp',
  deliveryBike: '/assets/sprites/delivery-bike-v2.webp',
  electricTaxi: '/assets/sprites/electric-taxi-v2.webp',
};

const images = {};

export async function loadAssets(onProgress) {
  const entries = Object.entries(MANIFEST);
  const totalItems = entries.length;
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

  await Promise.all(spritePromises);
  return images;
}

export function getImage(key) {
  return images[key] || null;
}
