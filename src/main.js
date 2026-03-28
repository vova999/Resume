// ============================================
// RPG Resume — Main Entry
// World coordinate system: 640x360
// ============================================

import { loadAssets } from './assets.js';
import { renderScene, getNearbyInteraction, getViewport, worldToScreen, screenToWorld, WORLD_W, WORLD_H } from './scene.js';
import { resumeData, sectionOrder } from './resumeData.js';
import { toggleEditor, isEditorActive, editorDraw, editorMouseDown, editorMouseMove, editorMouseUp, editorWheel, editorCopyValues, editorKeyDown } from './editor.js';

// ---- DOM Elements ----
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const panelOverlay = document.getElementById('panel-overlay');
const panelHeader = document.getElementById('panel-header');
const panelContent = document.getElementById('panel-content');
const panelClose = document.getElementById('panel-close');
const interactPrompt = document.getElementById('interact-prompt');

// ---- Player State (WORLD coordinates) ----
const player = {
  x: WORLD_W * 0.5,
  y: WORLD_H * 0.73,
  speed: 1.2, // world pixels per frame
  facing: 'down',
  moving: false,
};

// Walkable zones — array of polygons (each polygon = array of {x,y} vertices, perpendicular edges)
const WALK_ZONES = [
  [
    { x: 8, y: 247 },
    { x: 27, y: 247 },
    { x: 27, y: 268 },
    { x: 105, y: 268 },
    { x: 105, y: 244 },
    { x: 130, y: 244 },
    { x: 130, y: 266 },
    { x: 201, y: 266 },
    { x: 201, y: 253 },
    { x: 283, y: 253 },
    { x: 283, y: 227 },
    { x: 288, y: 227 },
    { x: 288, y: 261 },
    { x: 402, y: 261 },
    { x: 402, y: 238 },
    { x: 407, y: 238 },
    { x: 407, y: 265 },
    { x: 556, y: 265 },
    { x: 556, y: 243 },
    { x: 622, y: 243 },
    { x: 622, y: 251 },
    { x: 634, y: 251 },
    { x: 634, y: 325 },
    { x: 369, y: 325 },
    { x: 369, y: 296 },
    { x: 214, y: 296 },
    { x: 214, y: 322 },
    { x: 199, y: 322 },
    { x: 199, y: 299 },
    { x: 65, y: 299 },
    { x: 65, y: 323 },
    { x: 2, y: 323 },
    { x: 8, y: 323 },
  ],
];

// Point-in-polygon (ray casting)
function pointInPoly(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const yi = verts[i].y, yj = verts[j].y;
    if ((yi > py) !== (yj > py) &&
        px < (verts[j].x - verts[i].x) * (py - yi) / (yj - yi) + verts[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

// Nearest point on a line segment
function nearestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { x: ax + t * dx, y: ay + t * dy };
}

// Clamp a point to the nearest walkable zone
function clampToZones(x, y) {
  for (const poly of WALK_ZONES) {
    if (pointInPoly(x, y, poly)) return { x, y };
  }
  let bestDist = Infinity, bx = x, by = y;
  for (const poly of WALK_ZONES) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const p = nearestOnSeg(x, y, a.x, a.y, b.x, b.y);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestDist) { bestDist = d; bx = p.x; by = p.y; }
    }
  }
  return { x: bx, y: by };
}

// ---- Input State ----
const keys = {};
let isPanelOpen = false;
let activeSection = null;
let animFrame = null;

// ---- Canvas Sizing ----
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---- Keyboard Input ----
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Editor toggle
  if (e.key === '`') { toggleEditor(); return; }
  if (isEditorActive() && (e.key === 'c' || e.key === 'C')) { editorCopyValues(WALK_ZONES); return; }
  if (isEditorActive()) { editorKeyDown(e, WALK_ZONES); }

  if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && !isPanelOpen) {
    const nearby = getNearbyInteraction(player);
    if (nearby) openPanel(nearby.id);
  }

  if (e.key === 'Escape' && isPanelOpen) closePanel();

  if (!isPanelOpen) {
    const num = parseInt(e.key);
    if (num >= 1 && num <= sectionOrder.length) openPanel(sectionOrder[num - 1]);
  }

  if (isPanelOpen) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const idx = sectionOrder.indexOf(activeSection);
      openPanel(sectionOrder[(idx + 1) % sectionOrder.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const idx = sectionOrder.indexOf(activeSection);
      openPanel(sectionOrder[(idx - 1 + sectionOrder.length) % sectionOrder.length]);
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// ---- Panel System ----
function openPanel(sectionId) {
  const data = resumeData[sectionId];
  if (!data) return;
  panelHeader.innerHTML = `<h2>${data.title}</h2><div class="panel-subtitle">${data.subtitle}</div>`;
  panelContent.innerHTML = data.content;
  panelOverlay.classList.remove('hidden');
  isPanelOpen = true;
  activeSection = sectionId;
}

function closePanel() {
  panelOverlay.classList.add('hidden');
  isPanelOpen = false;
  activeSection = null;
}

panelClose.addEventListener('click', closePanel);
panelOverlay.addEventListener('click', (e) => {
  if (e.target === panelOverlay) closePanel();
});

// ---- Player Movement (world coords) ----
function updatePlayer() {
  if (isPanelOpen) {
    player.moving = false;
    return;
  }

  let dx = 0;
  let dy = 0;

  if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;

  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    player.x += dx * player.speed;
    player.y += dy * player.speed;

    if (Math.abs(dx) > Math.abs(dy)) {
      player.facing = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      player.facing = dy > 0 ? 'down' : 'up';
    }

    // Clamp to walkable zones
    const clamped = clampToZones(player.x, player.y);
    player.x = clamped.x;
    player.y = clamped.y;
  }
}

// ---- Interaction Prompt ----
function updateInteractPrompt() {
  if (isPanelOpen) {
    interactPrompt.classList.add('hidden');
    return;
  }

  const nearby = getNearbyInteraction(player);

  if (nearby) {
    interactPrompt.classList.remove('hidden');
    interactPrompt.textContent = `Press E — ${nearby.label}`;
    // Position prompt above player in screen coords
    const vp = getViewport(canvas.width, canvas.height);
    const { x: sx, y: sy } = worldToScreen(player.x, player.y, vp);
    interactPrompt.style.left = sx + 'px';
    interactPrompt.style.top = (sy - 80 * vp.scale) + 'px';
  } else {
    interactPrompt.classList.add('hidden');
  }
}

// ---- Animation Loop ----
function animate(time) {
  updatePlayer();
  renderScene(ctx, canvas.width, canvas.height, player, time);
  editorDraw(ctx, canvas.width, canvas.height, WALK_ZONES);
  updateInteractPrompt();
  animFrame = requestAnimationFrame(animate);
}

// ---- Click/Touch support ----
canvas.addEventListener('contextmenu', (e) => { if (isEditorActive()) e.preventDefault(); });
canvas.addEventListener('mousedown', (e) => {
  if (editorMouseDown(e, canvas, WALK_ZONES)) return;
});
canvas.addEventListener('mousemove', (e) => {
  editorMouseMove(e, canvas, WALK_ZONES);
});
canvas.addEventListener('mouseup', (e) => { editorMouseUp(e, canvas, WALK_ZONES); });
canvas.addEventListener('wheel', (e) => {
  if (editorWheel(e, canvas)) return;
}, { passive: false });

canvas.addEventListener('click', (e) => {
  if (isPanelOpen || isEditorActive()) return;

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Convert screen click to world coords
  const vp = getViewport(canvas.width, canvas.height);
  const { x: wx, y: wy } = screenToWorld(sx, sy, vp);

  // Move player to clicked position (clamped to zones)
  const cl = clampToZones(wx, wy);
  player.x = cl.x;
  player.y = cl.y;
  player.facing = wx > player.x ? 'right' : 'left';

  const nearby = getNearbyInteraction(player);
  if (nearby) openPanel(nearby.id);
});

// ---- Loading & Init ----
async function init() {
  await loadAssets((progress) => {
    loaderBar.style.width = Math.round(progress * 50) + '%';
  });

  loaderBar.style.width = '100%';

  setTimeout(() => {
    loader.classList.add('fade-out');
    animate(0);
    setTimeout(() => { loader.style.display = 'none'; }, 800);
  }, 300);
}

document.fonts.ready.then(() => { init(); });
