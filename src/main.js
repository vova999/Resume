// ============================================
// Vietnamese Street Resume - Main Entry
// ============================================

import { renderScene, hotspots } from './scene.js';
import { resumeData, sectionOrder } from './resumeData.js';

// ---- DOM Elements ----
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const panelOverlay = document.getElementById('panel-overlay');
const panelHeader = document.getElementById('panel-header');
const panelContent = document.getElementById('panel-content');
const panelClose = document.getElementById('panel-close');
const tooltip = document.getElementById('tooltip');
const hintText = document.getElementById('hint-text');
const navDotsContainer = document.getElementById('nav-dots');
const soundToggle = document.getElementById('sound-toggle');

// ---- State ----
let animFrame = null;
let currentHover = null;
let isPanelOpen = false;
let activeSection = null;
let soundEnabled = false;
let audioCtx = null;

// ---- Canvas Sizing ----
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---- Navigation Dots ----
function createNavDots() {
  navDotsContainer.innerHTML = '';
  sectionOrder.forEach(key => {
    const dot = document.createElement('div');
    dot.className = 'nav-dot';
    dot.dataset.section = key;
    dot.dataset.label = resumeData[key].label;
    dot.addEventListener('click', () => openPanel(key));
    navDotsContainer.appendChild(dot);
  });
}
createNavDots();

function updateNavDots(sectionId) {
  document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.section === sectionId);
  });
}

// ---- Panel System ----
function openPanel(sectionId) {
  const data = resumeData[sectionId];
  if (!data) return;

  panelHeader.innerHTML = `<h2>${data.title}</h2><div class="panel-subtitle">${data.subtitle}</div>`;
  panelContent.innerHTML = data.content;
  panelOverlay.classList.remove('hidden');
  isPanelOpen = true;
  activeSection = sectionId;
  updateNavDots(sectionId);

  // Play click sound
  playSound('click');
}

function closePanel() {
  panelOverlay.classList.add('hidden');
  isPanelOpen = false;
  activeSection = null;
  updateNavDots(null);
}

panelClose.addEventListener('click', closePanel);
panelOverlay.addEventListener('click', (e) => {
  if (e.target === panelOverlay) closePanel();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isPanelOpen) closePanel();
});

// ---- Hit Testing ----
function getHotspotAt(mx, my) {
  // Convert mouse coords to canvas coords
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const h = hotspots[i];
    if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
      return h;
    }
  }
  return null;
}

// ---- Mouse / Touch Events ----
canvas.addEventListener('mousemove', (e) => {
  if (isPanelOpen) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const hit = getHotspotAt(mx, my);

  if (hit) {
    currentHover = hit.id;
    canvas.style.cursor = 'pointer';
    tooltip.textContent = hit.label;
    tooltip.classList.remove('hidden');
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY - 10) + 'px';
    hintText.classList.add('hidden');
  } else {
    currentHover = null;
    canvas.style.cursor = 'default';
    tooltip.classList.add('hidden');
    hintText.classList.remove('hidden');
  }
});

canvas.addEventListener('mouseleave', () => {
  currentHover = null;
  tooltip.classList.add('hidden');
  canvas.style.cursor = 'default';
});

canvas.addEventListener('click', (e) => {
  if (isPanelOpen) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const hit = getHotspotAt(mx, my);
  if (hit) {
    openPanel(hit.id);
  }
});

// Touch support
canvas.addEventListener('touchend', (e) => {
  if (isPanelOpen) return;
  e.preventDefault();

  const touch = e.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const mx = touch.clientX - rect.left;
  const my = touch.clientY - rect.top;

  const hit = getHotspotAt(mx, my);
  if (hit) {
    openPanel(hit.id);
  }
});

// ---- Simple Audio (Web Audio API) ----
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
  if (!soundEnabled || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'click') {
    osc.frequency.value = 800;
    osc.type = 'square';
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
  }
}

// Ambient drone for atmosphere
let ambientNodes = null;

function startAmbient() {
  if (!audioCtx || ambientNodes) return;

  // Low drone
  const drone = audioCtx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 80;
  const droneGain = audioCtx.createGain();
  droneGain.gain.value = 0.03;
  drone.connect(droneGain);
  droneGain.connect(audioCtx.destination);
  drone.start();

  // High atmospheric tone
  const atmo = audioCtx.createOscillator();
  atmo.type = 'sine';
  atmo.frequency.value = 320;
  const atmoGain = audioCtx.createGain();
  atmoGain.gain.value = 0.008;
  atmo.connect(atmoGain);
  atmoGain.connect(audioCtx.destination);
  atmo.start();

  // Noise (rain-like)
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.015;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 800;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.15;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start();

  ambientNodes = { drone, droneGain, atmo, atmoGain, noise, noiseGain };
}

function stopAmbient() {
  if (!ambientNodes) return;
  try {
    ambientNodes.drone.stop();
    ambientNodes.atmo.stop();
    ambientNodes.noise.stop();
  } catch (e) { /* already stopped */ }
  ambientNodes = null;
}

soundToggle.addEventListener('click', () => {
  initAudio();
  soundEnabled = !soundEnabled;
  soundToggle.classList.toggle('muted', !soundEnabled);

  if (soundEnabled) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startAmbient();
  } else {
    stopAmbient();
  }
});

// ---- Highlight overlay for hovered hotspot ----
function drawHoverHighlight(ctx, time) {
  if (!currentHover || isPanelOpen) return;

  const hs = hotspots.find(h => h.id === currentHover);
  if (!hs) return;

  const pulse = 0.08 + Math.sin(time * 0.004) * 0.04;
  ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
  ctx.fillRect(hs.x, hs.y, hs.w, hs.h);

  // Border
  ctx.strokeStyle = `rgba(255, 215, 0, ${pulse * 3})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(hs.x, hs.y, hs.w, hs.h);
}

// ---- Animation Loop ----
function animate(time) {
  renderScene(canvas, time);
  drawHoverHighlight(ctx, time);
  animFrame = requestAnimationFrame(animate);
}

// ---- Loading Screen ----
let loadProgress = 0;

function simulateLoading() {
  const interval = setInterval(() => {
    loadProgress += 2 + Math.random() * 5;
    if (loadProgress >= 100) {
      loadProgress = 100;
      loaderBar.style.width = '100%';
      clearInterval(interval);

      setTimeout(() => {
        loader.classList.add('fade-out');
        // Start the scene
        animate(0);
        setTimeout(() => {
          loader.style.display = 'none';
        }, 800);
      }, 400);
    } else {
      loaderBar.style.width = loadProgress + '%';
    }
  }, 80);
}

// Ensure fonts are loaded before starting
document.fonts.ready.then(() => {
  simulateLoading();
});

// ---- Keyboard Navigation ----
document.addEventListener('keydown', (e) => {
  if (isPanelOpen) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = sectionOrder.indexOf(activeSection);
      const next = sectionOrder[(idx + 1) % sectionOrder.length];
      openPanel(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = sectionOrder.indexOf(activeSection);
      const prev = sectionOrder[(idx - 1 + sectionOrder.length) % sectionOrder.length];
      openPanel(prev);
    }
  } else {
    // Number keys 1-6 to open sections directly
    const num = parseInt(e.key);
    if (num >= 1 && num <= sectionOrder.length) {
      openPanel(sectionOrder[num - 1]);
    }
  }
});
