// ============================================
// Visual Novel Dialog System
// ============================================

let dialogOverlay = null;
let dialogActive = false;
let currentSequence = [];
let currentStep = 0;
let typewriterTimer = null;
let typewriterDone = false;
let fullText = '';
let fullHtml = '';
let onSequenceEnd = null;
let justDragged = false;
let currentPortraitStyles = null;

export function wasJustDragged() {
  return justDragged;
}

export function initDialog() {
  dialogOverlay = document.getElementById('dialog-overlay');
  if (import.meta.env.DEV) {
    initPortraitDrag();
  }

  window.addEventListener('resize', () => {
    if (!dialogActive || !currentPortraitStyles) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const leftPortrait = dialogOverlay.querySelector('.dialog-portrait-left');
    const rightPortrait = dialogOverlay.querySelector('.dialog-portrait-right');
    applyPortraitStyle(leftPortrait, currentPortraitStyles.left, vw, vh);
    applyPortraitStyle(rightPortrait, currentPortraitStyles.right, vw, vh);
  });
}

export function isDialogActive() {
  return dialogActive;
}

/**
 * Dialog step types:
 *
 * Solo: { speaker, text, portrait, position }
 *   One character portrait + dialog box at bottom.
 *
 * Duo: { speaker, text, portraitLeft, portraitRight, position }
 *   Two portraits, speaker highlighted, dialog box centered at bottom.
 *
 * NPC Detail: { speaker, npcContent, text, portraitLeft, portraitRight, position, bigPortrait }
 *   Large scrollable NPC box on top with npcContent (HTML string).
 *   Small response box at bottom with text (typewriter).
 *   bigPortrait: 'left' or 'right' — which portrait is 1.5x bigger with 3/4 crop.
 */
export function startDialog(sequence, onEnd) {
  currentSequence = sequence;
  currentStep = 0;
  onSequenceEnd = onEnd || null;
  dialogActive = true;
  dialogOverlay.classList.remove('hidden');
  showStep();
}

export function advanceDialog() {
  if (!dialogActive) return;

  if (!typewriterDone) {
    clearInterval(typewriterTimer);
    const textEl = dialogOverlay.querySelector('.dialog-text');
    if (textEl) textEl.innerHTML = fullHtml;
    typewriterDone = true;
    showContinueIndicator();
    return;
  }

  currentStep++;
  if (currentStep >= currentSequence.length) {
    closeDialog();
    return;
  }
  showStep();
}

export function closeDialog() {
  dialogActive = false;
  currentPortraitStyles = null;
  clearInterval(typewriterTimer);
  dialogOverlay.classList.add('hidden');
  resetAll();
  if (onSequenceEnd) {
    const cb = onSequenceEnd;
    onSequenceEnd = null;
    cb();
  }
}

function parseBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function startTypewriter(textEl, text, onDone) {
  fullText = text;
  fullHtml = parseBold(text);
  textEl.innerHTML = '';
  typewriterDone = false;
  let charIdx = 0;
  clearInterval(typewriterTimer);
  typewriterTimer = setInterval(() => {
    charIdx++;
    textEl.innerHTML = parseBold(fullText.slice(0, charIdx));
    if (charIdx >= fullText.length) {
      clearInterval(typewriterTimer);
      typewriterDone = true;
      if (onDone) onDone();
    }
  }, 18);
}

function resetAll() {
  const leftPortrait = dialogOverlay.querySelector('.dialog-portrait-left');
  const rightPortrait = dialogOverlay.querySelector('.dialog-portrait-right');
  const npcBox = dialogOverlay.querySelector('.dialog-npc-box');
  const dialogBox = dialogOverlay.querySelector('.dialog-box');

  leftPortrait.classList.add('hidden');
  leftPortrait.classList.remove('portrait-dim', 'portrait-big');
  leftPortrait.style.cssText = '';
  leftPortrait.querySelector('img').style.cssText = '';
  rightPortrait.classList.add('hidden');
  rightPortrait.classList.remove('portrait-dim', 'portrait-big', 'portrait-npc-detail');
  rightPortrait.style.cssText = '';
  rightPortrait.querySelector('img').style.cssText = '';
  const centerPortrait = dialogOverlay.querySelector('.dialog-portrait-center');
  centerPortrait.classList.add('hidden');
  const boardEl = dialogOverlay.querySelector('.dialog-board');
  boardEl.classList.add('hidden');
  npcBox.classList.add('hidden');
  dialogBox.className = 'dialog-box';
}

function applyPortraitStyle(el, s, vw, vh) {
  if (!s) return;
  if (vw <= 640) return; // CSS handles mobile layout
  if (s.x != null) { el.style.left = (s.x * vw) + 'px'; el.style.right = 'auto'; }
  if (s.y != null) { el.style.top = (s.y * vh) + 'px'; el.style.bottom = 'auto'; }
  if (s.scale) {
    el.style.setProperty('--portrait-scale', s.scale);
    el.querySelector('img').style.transform = `scale(${s.scale})`;
    el.querySelector('img').style.transformOrigin = 'bottom center';
  }
}

function showStep() {
  const step = currentSequence[currentStep];
  const leftPortrait = dialogOverlay.querySelector('.dialog-portrait-left');
  const rightPortrait = dialogOverlay.querySelector('.dialog-portrait-right');
  const npcBox = dialogOverlay.querySelector('.dialog-npc-box');
  const npcName = dialogOverlay.querySelector('.dialog-npc-name');
  const npcContent = dialogOverlay.querySelector('.dialog-npc-content');
  const dialogBox = dialogOverlay.querySelector('.dialog-box');
  const nameEl = dialogOverlay.querySelector('.dialog-name');
  const textEl = dialogOverlay.querySelector('.dialog-text');
  const continueEl = dialogOverlay.querySelector('.dialog-continue');

  // Reset
  continueEl.classList.add('hidden');
  leftPortrait.classList.add('hidden');
  leftPortrait.classList.remove('portrait-dim', 'portrait-big');
  rightPortrait.classList.add('hidden');
  rightPortrait.classList.remove('portrait-dim', 'portrait-big', 'portrait-npc-detail');
  npcBox.classList.add('hidden');
  dialogBox.className = 'dialog-box hidden';

  const speakerSide = step.position || 'left';
  const centerPortraitEl = dialogOverlay.querySelector('.dialog-portrait-center');
  const boardEl = dialogOverlay.querySelector('.dialog-board');

  // --- Board layout mode (image centered, clickable hotspots over image) ---
  if (step.layout === 'board') {
    boardEl.classList.remove('hidden');
    boardEl.querySelector('img').src = step.image;
    const hotspotsEl = boardEl.querySelector('.dialog-board-hotspots');
    hotspotsEl.innerHTML = '';
    for (const h of (step.hotspots || [])) {
      const a = document.createElement('a');
      a.href = h.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = h.label;
      a.style.cssText = `left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%`;
      hotspotsEl.appendChild(a);
    }
    dialogBox.classList.add('hidden');
    fullText = '';
    fullHtml = '';
    typewriterDone = true;
    return;
  }

  // --- Centered layout mode (image on top, dialog below) ---
  if (step.layout === 'centered') {
    if (step.portrait) {
      centerPortraitEl.classList.remove('hidden');
      centerPortraitEl.querySelector('img').src = step.portrait;
    }
    dialogBox.classList.remove('hidden');
    dialogBox.classList.add('dialog-box-below');

    if (step.speaker) {
      nameEl.textContent = step.speaker;
      nameEl.classList.remove('hidden');
    } else {
      nameEl.classList.add('hidden');
    }

    startTypewriter(textEl, step.text, showContinueIndicator);
    return;
  }

  // --- NPC Detail mode ---
  if (step.npcContent) {
    // Portraits
    if (step.portraitLeft) {
      leftPortrait.classList.remove('hidden');
      leftPortrait.querySelector('img').src = step.portraitLeft;
    }
    if (step.portraitRight) {
      rightPortrait.classList.remove('hidden');
      rightPortrait.querySelector('img').src = step.portraitRight;
    }

    // Big portrait (don't dim the other character)
    const bigSide = step.bigPortrait || 'left';
    if (bigSide === 'left') {
      leftPortrait.classList.add('portrait-big');
      rightPortrait.classList.add('portrait-npc-detail');
    } else {
      rightPortrait.classList.add('portrait-big');
      leftPortrait.classList.add('portrait-npc-detail');
    }

    // Apply per-NPC portrait positioning (ratios 0–1 relative to viewport)
    currentPortraitStyles = step.portraitStyles || null;
    if (step.portraitStyles) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      applyPortraitStyle(leftPortrait, step.portraitStyles.left, vw, vh);
      applyPortraitStyle(rightPortrait, step.portraitStyles.right, vw, vh);
    }

    // NPC box — show all content immediately (scrollable)
    npcBox.classList.remove('hidden');
    npcName.textContent = step.npcName || step.speaker || '';
    npcContent.innerHTML = step.npcContent;
    npcBox.scrollTop = 0;

    // Bottom response box
    if (step.text) {
      dialogBox.classList.remove('hidden');
      dialogBox.classList.add('dialog-box-center');
      if (step.responseSpeaker) {
        nameEl.textContent = step.responseSpeaker;
        nameEl.classList.remove('hidden');
      } else {
        nameEl.classList.add('hidden');
      }
      startTypewriter(textEl, step.text, showContinueIndicator);
    } else {
      // No response text — just show continue indicator right away
      dialogBox.classList.add('hidden');
      fullText = '';
      fullHtml = '';
      typewriterDone = true;
      showContinueIndicator();
    }
    return;
  }

  // --- Duo mode ---
  const isDuo = step.portraitLeft && step.portraitRight;

  if (isDuo) {
    leftPortrait.classList.remove('hidden');
    leftPortrait.querySelector('img').src = step.portraitLeft;
    rightPortrait.classList.remove('hidden');
    rightPortrait.querySelector('img').src = step.portraitRight;

    if (speakerSide === 'left') {
      rightPortrait.classList.add('portrait-dim');
    } else {
      leftPortrait.classList.add('portrait-dim');
    }
    dialogBox.classList.remove('hidden');
    dialogBox.classList.add('dialog-box-center');
  } else if (step.portrait) {
    // --- Solo mode ---
    dialogBox.classList.remove('hidden');
    if (speakerSide === 'left') {
      leftPortrait.classList.remove('hidden');
      leftPortrait.querySelector('img').src = step.portrait;
      dialogBox.classList.add('dialog-box-right');
    } else {
      rightPortrait.classList.remove('hidden');
      rightPortrait.querySelector('img').src = step.portrait;
      dialogBox.classList.add('dialog-box-left');
    }
  }

  // Name
  if (step.speaker) {
    nameEl.textContent = step.speaker;
    nameEl.classList.remove('hidden');
  } else {
    nameEl.classList.add('hidden');
  }

  // Typewriter
  startTypewriter(textEl, step.text, showContinueIndicator);
}

function showContinueIndicator() {
  const continueEl = dialogOverlay.querySelector('.dialog-continue');
  continueEl.classList.remove('hidden');
}

// ============================================
// Portrait Drag & Scale (dev tool)
// ============================================
function initPortraitDrag() {
  const portraits = dialogOverlay.querySelectorAll('.dialog-portrait-left, .dialog-portrait-right');
  let dragging = null;
  let hasMoved = false;
  let startX, startY, origLeft, origTop, origBottom, origRight;

  // Info overlay
  const info = document.createElement('div');
  info.id = 'portrait-drag-info';
  info.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;' +
    'font:12px monospace;color:#ffd700;background:rgba(0,0,0,0.85);padding:6px 12px;border-radius:4px;' +
    'pointer-events:none;display:none;white-space:pre';
  document.body.appendChild(info);

  function showInfo(el) {
    const scale = parseFloat(el.style.getPropertyValue('--portrait-scale') || '1');
    const side = el.classList.contains('dialog-portrait-left') ? 'LEFT' : 'RIGHT';
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    info.textContent = `${side}  x:${(rect.left/vw).toFixed(3)} y:${(rect.top/vh).toFixed(3)} scale:${scale.toFixed(2)}`;
    info.style.display = 'block';
  }

  portraits.forEach(el => {
    el.style.cursor = 'grab';

    el.addEventListener('mousedown', (e) => {
      if (!dialogActive) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = el;
      hasMoved = false;
      el.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
    });

    el.addEventListener('wheel', (e) => {
      if (!dialogActive) return;
      e.preventDefault();
      e.stopPropagation();
      const current = parseFloat(el.style.getPropertyValue('--portrait-scale') || '1');
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newScale = Math.max(0.3, Math.min(3, current + delta));
      el.style.setProperty('--portrait-scale', newScale);
      el.querySelector('img').style.transform = `scale(${newScale})`;
      el.querySelector('img').style.transformOrigin = 'bottom center';
      showInfo(el);
    }, { passive: false });
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    hasMoved = true;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    dragging.style.left = (origLeft + dx) + 'px';
    dragging.style.bottom = 'auto';
    dragging.style.top = (origTop + dy) + 'px';
    dragging.style.right = 'auto';
    showInfo(dragging);
  });

  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging.style.cursor = 'grab';
      if (hasMoved) {
        justDragged = true;
        setTimeout(() => { justDragged = false; }, 100);
      }
      dragging = null;
    }
  });

  // Copy values on C key when dialog active — outputs ratios ready for portraitStyles
  window.addEventListener('keydown', (e) => {
    if (!dialogActive) return;
    if (e.key === 'c' || e.key === 'C') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const values = {};
      portraits.forEach(el => {
        const side = el.classList.contains('dialog-portrait-left') ? 'left' : 'right';
        const scale = parseFloat(el.style.getPropertyValue('--portrait-scale') || '1');
        const rect = el.getBoundingClientRect();
        values[side] = {
          x: parseFloat((rect.left / vw).toFixed(4)),
          y: parseFloat((rect.top / vh).toFixed(4)),
          scale: parseFloat(scale.toFixed(2)),
        };
      });
      const text = JSON.stringify(values, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        info.textContent = 'Copied! ' + text.replace(/\n/g, ' ');
        info.style.display = 'block';
        setTimeout(() => { info.style.display = 'none'; }, 2000);
      });
    }
  });
}
