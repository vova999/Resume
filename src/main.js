// ============================================
// RPG Resume — Main Entry
// World coordinate system: 640x360
// ============================================

import { loadAssets } from './assets.js';
import { renderScene, getNearbyInteraction, getViewport, worldToScreen, screenToWorld, WORLD_W, WORLD_H } from './scene.js';
import { sectionOrder } from './resumeData.js';
// Editor only loaded in dev mode
let toggleEditor, isEditorActive, editorDraw, editorMouseDown, editorMouseMove, editorMouseUp, editorWheel, editorCopyValues, editorKeyDown;
if (import.meta.env.DEV) {
  const editor = await import('./editor.js');
  toggleEditor = editor.toggleEditor;
  isEditorActive = editor.isEditorActive;
  editorDraw = editor.editorDraw;
  editorMouseDown = editor.editorMouseDown;
  editorMouseMove = editor.editorMouseMove;
  editorMouseUp = editor.editorMouseUp;
  editorWheel = editor.editorWheel;
  editorCopyValues = editor.editorCopyValues;
  editorKeyDown = editor.editorKeyDown;
} else {
  const noop = () => {};
  const noopFalse = () => false;
  toggleEditor = noop; isEditorActive = noopFalse; editorDraw = noop;
  editorMouseDown = noopFalse; editorMouseMove = noop; editorMouseUp = noop;
  editorWheel = noopFalse; editorCopyValues = noop; editorKeyDown = noop;
}
import { initDialog, isDialogActive, startDialog, advanceDialog, wasJustDragged } from './dialog.js';

// ---- DOM Elements ----
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const interactPrompt = document.getElementById('interact-prompt');

// ---- Player State (WORLD coordinates) ----
const player = {
  x: 50,
  y: WORLD_H * 0.82,
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

// NOTE: Walk zones and interact zones were manually tuned via the visual editor (` key).
// INTERACT_ZONES are defined in scene.js.
// SCENE_PROPS positions: threeMen wx:292 wy:346 scale:0.69, trashbinet wx:133 wy:346 scale:1.28

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

// ---- Touch device detection ----
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---- Input State ----
const keys = {};

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

  // Dialog system takes priority
  if (isDialogActive()) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      advanceDialog();
    }
    return;
  }

  // Editor toggle
  if (e.key === '`') { toggleEditor(); return; }
  if (isEditorActive() && (e.key === 'c' || e.key === 'C')) { editorCopyValues(WALK_ZONES); return; }
  if (isEditorActive()) { editorKeyDown(e, WALK_ZONES); }

  if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
    const nearby = getNearbyInteraction(player);
    if (nearby) triggerInteraction(nearby.id);
  }

  const num = parseInt(e.key);
  if (num >= 1 && num <= sectionOrder.length) triggerInteraction(sectionOrder[num - 1]);
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// ---- Dialog-based Interactions ----
const DIALOG_SEQUENCES = {
  middleagedman: [
    {
      npcName: 'Middle-aged Man',
      portraitStyles: {
        left: { x: -0.056, y: 0.1978, scale: 1.2 },
        right: { x: 0.7752, y: 0.3, scale: 1.15 },
      },
      npcContent: `
        <p>Haha, Tu's house is just next to mine, so I know the kid quite well. Tu has over <strong>10 years</strong> of experience building and leading products across <strong>fintech</strong>, <strong>enterprise systems</strong>, and <strong>climate tech</strong>:</p>
        <p style="font-size:0.85em;color:#ffd700;margin-bottom:0.5rem">Pick a chapter to hear the story:</p>
        <details>
          <summary>DCarbon (Dec 2021 – Present) — Founder & CTO</summary>
          <ul>
            <li>Builds a platform for <strong>trustless measurement and verification</strong> of carbon reduction and sequestration.</li>
            <li>Combines <strong>IoT</strong> (real-time observation) with <strong>blockchain</strong> (immutability and transparency) to strengthen ESG credibility.</li>
            <li>Focuses on scalable architecture, data integrity, and product delivery from concept to production.</li>
            <li>Winner of the <strong>Solana Renaissance</strong> hackathon (Vietnam).</li>
          </ul>
        </details>
        <details>
          <summary>MAI Trading Fintech App (Jun 2019 – 2025) — Project Lead & Co-founder</summary>
          <ul>
            <li>Led the build of <strong>iOS and Android</strong> apps, core services, and data infrastructure.</li>
            <li>Defined the back-end stack, API approach, and technical roadmap.</li>
            <li>Oversaw ML and model improvements using in-house data, with ongoing evaluation for accuracy and performance.</li>
            <li>Designed and approved <strong>security</strong>, <strong>stress</strong>, and <strong>performance</strong> testing aligned to exchange regulations.</li>
            <li>Managed post-launch operations, bug fixes, and iterative UX improvements.</li>
          </ul>
        </details>
        <details>
          <summary>Viet Tin Pay (2017 – 2019) — Project Director</summary>
          <ul>
            <li>Delivered an <strong>e-wallet</strong> and <strong>payment gateway</strong> platform end to end.</li>
            <li>Translated State Bank compliance requirements into architecture, specs, and audit-ready documentation.</li>
            <li>Coordinated solution design and participated in development where needed.</li>
            <li>Led integrations with banking partners (BIDV, Lien Viet Post Bank) and Napas.</li>
          </ul>
        </details>
        <details>
          <summary>IBM / Nghi Son Refinery (Apr 2016 – Jun 2017) — ERP Consultant</summary>
          <ul>
            <li>Implemented and configured <strong>IBM Maximo EAM</strong> across refinery operations.</li>
            <li>Delivered workflows for work orders, preventive maintenance, inventory, procurement, reporting, and KPI tracking.</li>
            <li>Trained administrators and end users, and supported go-live issue resolution.</li>
            <li>Worked with vendors and stakeholders to keep delivery on track.</li>
          </ul>
        </details>
      `,
      responseSpeaker: 'You',
      text: 'That\'s really helpful, thank you sir!',
      portraitLeft: '/assets/sprites/middleagedman.png',
      portraitRight: '/assets/sprites/mainchar.png',
      bigPortrait: 'left',
    },
  ],
  board: [
    {
      layout: 'board',
      image: '/assets/sprites/board.png',
      hotspots: [
        // Email text line
        { label: 'Email', url: 'mailto:nguyenngoctu1112@gmail.com', x: 12, y: 35, w: 76, h: 16 },
        // Facebook icon
        { label: 'Facebook', url: 'https://www.facebook.com/tu.nguyenngoc.357', x: 13, y: 55, w: 24, h: 38 },
        // LinkedIn icon
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/tu-nguyen-757026109/', x: 38, y: 55, w: 24, h: 38 },
        // GitHub icon
        { label: 'GitHub', url: 'https://github.com/vova999', x: 63, y: 55, w: 26, h: 38 },
      ],
    },
  ],
  threemen: [
    {
      layout: 'centered',
      speaker: 'The Guys',
      portrait: '/assets/sprites/3men.png',
      text: 'Tu? Haha, pull up a chair! He\'s our drinking buddy. When he\'s not coding, he loves **playing games**, watching and playing **football**, **vibe coding** side projects for fun, and **DIY** — always building or fixing something around the house.',
    },
  ],
  banhmiboy: [
    {
      npcName: 'Banh Mi Boy',
      portraitStyles: {
        left: { x: -0.02, y: 0.2, scale: 1.3 },
        right: { x: 0.776, y: 0.3, scale: 1.15 },
      },
      npcContent: `
        <p>Anh Tu? He's one of my best customers! Always orders extra chili. He knows a lot about tech stuff, I hear him talk on the phone all the time:</p>
        <details>
          <summary>Domain Expertise</summary>
          <ul>
            <li><strong>Financial Technology</strong> — stock exchanges, trading systems, wealth management</li>
            <li><strong>Blockchain / DeFi</strong> — smart contracts, on-chain architecture</li>
            <li><strong>Payment Systems</strong> — e-wallets, payment gateways, banking integrations</li>
            <li><strong>RegTech & Compliance</strong> — State Bank regulations, exchange certification</li>
            <li><strong>Carbon Markets / ESG</strong> — carbon credits, dMRV, sustainability</li>
          </ul>
        </details>
        <details>
          <summary>Technology</summary>
          <ul>
            <li><strong>AI / Machine Learning</strong> — neural networks, LLMs, prompt engineering</li>
            <li><strong>IoT</strong> — real-time observation, sensor data pipelines</li>
            <li><strong>Mobile Development</strong> — iOS & Android</li>
            <li><strong>Back-end Architecture</strong> — API design, microservices</li>
            <li><strong>Smart Contracts</strong> — Solana, on-chain systems</li>
          </ul>
        </details>
      `,
      responseSpeaker: 'You',
      text: 'Got it, thanks kid!',
      portraitLeft: '/assets/sprites/banhmi.png',
      portraitRight: '/assets/sprites/mainchar.png',
      bigPortrait: 'left',
    },
  ],
  cartgirl: [
    {
      npcName: 'Cart Girl',
      portraitStyles: {
        left: { x: -0.016, y: 0.1989, scale: 1.5 },
        right: { x: 0.776, y: 0.3, scale: 1.15 },
      },
      npcContent: `
        <p>Anh Tu? Of course, I know him. I'm applying to university next year, so I ask Tu about school whenever he's here for breakfast:</p>
        <details>
          <summary>Master's Degree — University of Glasgow (2016)</summary>
          <ul>
            <li><strong>Engineering & Management</strong> — Scotland, UK</li>
            <li>Studied abroad, came back with both the degree and a taste for Scottish weather.</li>
          </ul>
        </details>
        <details>
          <summary>Bachelor's Degree — National University of Civil Engineering (2012)</summary>
          <ul>
            <li><strong>Offshore Engineering</strong> — Hanoi, Vietnam</li>
            <li>Started in engineering, then found his way into tech. Smart kid.</li>
          </ul>
        </details>
        <details>
          <summary>Patent & Certifications</summary>
          <ul>
            <li>Tu authored a <strong>patent (1-2023-09382)</strong> for an IoT dMRV system for carbon accounting.</li>
            <li>Holds <strong>IBM deployment certifications</strong> for Tivoli and Maximo.</li>
          </ul>
        </details>
        <details>
          <summary>Languages</summary>
          <ul>
            <li><strong>Vietnamese</strong> — Native</li>
            <li><strong>English</strong> — Fluent (speaking, reading, writing)</li>
          </ul>
        </details>
      `,
      responseSpeaker: 'You',
      text: 'Thank you, that\'s very helpful!',
      portraitLeft: '/assets/sprites/cartgirl.png',
      portraitRight: '/assets/sprites/mainchar.png',
      bigPortrait: 'left',
    },
  ],
  oldlady: [
    {
      npcName: 'Old Lady',
      portraitStyles: {
        left: { x: -0.028, y: 0.2289, scale: 1.3 },
        right: { x: 0.7765, y: 0.3005, scale: 1.15 },
      },
      npcContent: `
        <p>Oh, Tu heh heh? His full name is <strong>Nguyen Ngoc Tu</strong>. He's like a grandson to me, everyone around this street knows him.</p>
        <p>He is the Founder and CTO of <strong>DCarbon</strong> (started in Dec 2021). Tu is the kind of tech person who cares about the planet, using <strong>blockchain</strong> and <strong>IoT</strong> to make carbon data transparent and trustworthy, you know, so ESG claims are not just talk.</p>
        <p>Before that, Tu built a lot in <strong>fintech</strong> too, like trading apps, e-wallets, payment gateways, and asset systems, always keeping an eye on the regulations.</p>
        <p>If you want to know more about Tu, ask the man in blue over there about his experience.</p>
      `,
      responseSpeaker: 'You',
      text: 'Thanks, ma\'am. That helps a lot.',
      portraitLeft: '/assets/sprites/oldlady.png',
      portraitRight: '/assets/sprites/mainchar.png',
      bigPortrait: 'left',
    },
  ],
};

function triggerInteraction(zoneId) {
  if (DIALOG_SEQUENCES[zoneId]) {
    startDialog(DIALOG_SEQUENCES[zoneId]);
  } else {
    openPanel(zoneId);
  }
}

// ---- Mobile touch joystick state ----
const touchMove = { active: false, dx: 0, dy: 0 };

// ---- Player Movement (world coords) ----
function updatePlayer() {
  if (isDialogActive()) {
    player.moving = false;
    return;
  }

  let dx = 0;
  let dy = 0;

  // Keyboard
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;

  // Mobile touch joystick
  if (touchMove.active) {
    dx += touchMove.dx;
    dy += touchMove.dy;
  }

  // Normalize diagonal
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1) { dx /= len; dy /= len; }

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
  const nearby = getNearbyInteraction(player);

  if (nearby) {
    interactPrompt.classList.remove('hidden');
    interactPrompt.textContent = isTouchDevice ? `Tap — ${nearby.label}` : `Press E — ${nearby.label}`;
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
  requestAnimationFrame(animate);
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

// ---- Shared move logic for click & touch ----
function handleMoveToPoint(sx, sy) {
  if (isEditorActive() || isDialogActive()) return;

  const vp = getViewport(canvas.width, canvas.height);
  const { x: wx, y: wy } = screenToWorld(sx, sy, vp);

  const cl = clampToZones(wx, wy);
  player.x = cl.x;
  player.y = cl.y;
  player.facing = wx > player.x ? 'right' : 'left';

  const nearby = getNearbyInteraction(player);
  if (nearby) triggerInteraction(nearby.id);
}

canvas.addEventListener('click', (e) => {
  if (isEditorActive() || isDialogActive()) return;
  const rect = canvas.getBoundingClientRect();
  handleMoveToPoint(e.clientX - rect.left, e.clientY - rect.top);
});

// ---- Mobile split-screen touch controls ----
// Left half: drag to move (virtual joystick)
// Right half: tap to interact
let joystickTouchId = null;
let joystickOrigin = null;
let joystickMoved = false;
const JOYSTICK_DEAD_ZONE = 10; // px
const JOYSTICK_MAX = 60; // px — full tilt distance

canvas.addEventListener('touchstart', (e) => {
  if (isEditorActive() || isDialogActive()) return;
  e.preventDefault();

  for (const touch of e.changedTouches) {
    const halfW = window.innerWidth / 2;
    if (touch.clientX < halfW && joystickTouchId === null) {
      // Left side — start joystick
      joystickTouchId = touch.identifier;
      joystickOrigin = { x: touch.clientX, y: touch.clientY };
      joystickMoved = false;
      touchMove.active = false;
      touchMove.dx = 0;
      touchMove.dy = 0;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (isEditorActive() || isDialogActive()) return;
  e.preventDefault();

  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId && joystickOrigin) {
      const dx = touch.clientX - joystickOrigin.x;
      const dy = touch.clientY - joystickOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > JOYSTICK_DEAD_ZONE) {
        joystickMoved = true;
        const clamped = Math.min(dist, JOYSTICK_MAX);
        touchMove.dx = (dx / dist) * (clamped / JOYSTICK_MAX);
        touchMove.dy = (dy / dist) * (clamped / JOYSTICK_MAX);
        touchMove.active = true;
      } else {
        touchMove.active = false;
        touchMove.dx = 0;
        touchMove.dy = 0;
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (isEditorActive() || isDialogActive()) return;
  e.preventDefault();

  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      // Release joystick — if it was a tap (no drag), treat as click-to-move
      const wasTap = !joystickMoved;
      joystickTouchId = null;
      joystickOrigin = null;
      joystickMoved = false;
      touchMove.active = false;
      touchMove.dx = 0;
      touchMove.dy = 0;
      if (wasTap) {
        const rect = canvas.getBoundingClientRect();
        handleMoveToPoint(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    } else {
      // Non-joystick tap — if near an NPC, interact directly; otherwise move there
      const nearby = getNearbyInteraction(player);
      if (nearby) {
        triggerInteraction(nearby.id);
      } else {
        const rect = canvas.getBoundingClientRect();
        handleMoveToPoint(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    }
  }
}, { passive: false });

// ---- Loading & Init ----
async function init() {
  const loadingPhase = document.getElementById('loader-phase-loading');
  const titlePhase = document.getElementById('loader-phase-title');
  const startBtn = document.getElementById('loader-start-btn');
  const loaderHintEl = document.getElementById('loader-hint');

  // Update hints for touch devices
  if (isTouchDevice) {
    const controlsHint = document.getElementById('controls-hint');
    if (controlsHint) controlsHint.innerHTML = '<span>Drag left to move</span> · <span>Tap right to interact</span>';
    if (loaderHintEl) loaderHintEl.textContent = 'Drag left to move · Tap right to interact';
  }

  await loadAssets((progress) => {
    loaderBar.style.width = Math.round(progress * 50) + '%';
  });

  loaderBar.style.width = '100%';
  initDialog();

  // Transition: loading phase → title phase
  setTimeout(() => {
    loadingPhase.classList.add('loader-phase-hidden');
    setTimeout(() => {
      titlePhase.classList.remove('loader-phase-hidden');
    }, 400);
  }, 500);

  // Start button → enter game
  let gameStarted = false;
  function enterGame() {
    if (gameStarted) return;
    gameStarted = true;
    startBtn.removeEventListener('click', enterGame);
    window.removeEventListener('keydown', handleStartKey);
    loader.classList.add('fade-out');
    animate(0);
    setTimeout(() => { loader.style.display = 'none'; }, 1000);

    // Intro dialog — 1 second after scene appears
    setTimeout(() => {
      startDialog([
        {
          speaker: 'You',
          text: 'Is this where Tu lives?',
          portrait: '/assets/sprites/mainchar.png',
          position: 'left',
        },
        {
          speaker: 'You',
          text: 'Maybe I should ask around.',
          portrait: '/assets/sprites/mainchar.png',
          position: 'left',
        },
      ]);
    }, 1000);
  }

  startBtn.addEventListener('click', enterGame);

  // Also allow Enter/Space to start
  function handleStartKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.removeEventListener('keydown', handleStartKey);
      enterGame();
    }
  }
  // Only listen for start keys after title phase is visible
  setTimeout(() => {
    window.addEventListener('keydown', handleStartKey);
  }, 1000);
}

// Click/tap on dialog overlay to advance — only on background, bottom dialog box, or portraits
// NOT on the NPC scrollable box (so toggles work)
const dialogOverlayEl = document.getElementById('dialog-overlay');
dialogOverlayEl.addEventListener('click', (e) => {
  if (!isDialogActive() || wasJustDragged()) return;
  // Don't advance if clicking inside the NPC scrollable box or board links
  if (e.target.closest('.dialog-npc-box')) return;
  if (e.target.closest('.dialog-board-hotspots')) return;
  if (e.target.closest('.dialog-board-inner')) return;
  advanceDialog();
});

document.fonts.ready.then(() => { init(); });
