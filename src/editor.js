// ============================================
// Visual Editor — Toggle with ` key
// Draw polygon walkable zones + interaction zone boxes
// ============================================

import { getViewport, worldToScreen, screenToWorld, SCENE_PROPS, INTERACT_ZONES, WORLD_W, WORLD_H } from './scene.js';
import { getImage } from './assets.js';

// Get prop visual center in screen coords
function propCenter(prop, vp) {
  const { x: sx, y: sy } = worldToScreen(prop.wx, prop.wy, vp);
  const img = getImage(prop.imageKey);
  let dh;
  if (prop.type === 'animated') {
    dh = prop.fh * prop.scale * vp.scale;
  } else if (img) {
    dh = img.height * prop.scale * vp.scale;
  } else {
    dh = 40 * vp.scale;
  }
  return { x: sx, y: sy - dh / 2 };
}

let active = false;
let mode = 'select'; // 'select' | 'draw' | 'interact'
let dragging = null;
let selectedZone = -1;
let selectedVert = -1;
let selectedProp = null;
let selectedIZone = -1; // selected interact zone index
const VERT_HIT = 8;
const PROP_HIT = 14;
const EDGE_HIT = 6;

// Walk zone drawing state
let drawVerts = [];
let drawMouse = null;

// Interact zone drawing state
let iDrawStart = null;
let iDrawCurrent = null;

export function toggleEditor() {
  active = !active;
  mode = 'select';
  drawVerts = [];
  drawMouse = null;
  iDrawStart = null;
  iDrawCurrent = null;
  updatePanel();
}
export function isEditorActive() { return active; }

// ---- Snap to perpendicular from last vertex ----
function snapPerp(last, wx, wy) {
  if (!last) return { x: Math.round(wx), y: Math.round(wy) };
  const dx = Math.abs(wx - last.x);
  const dy = Math.abs(wy - last.y);
  if (dx >= dy) return { x: Math.round(wx), y: last.y };
  return { x: last.x, y: Math.round(wy) };
}

// ---- Draw overlay ----
export function editorDraw(ctx, W, H, zones) {
  if (!active) return;
  const vp = getViewport(W, H);
  ctx.save();

  // ---- Walk zones (green) ----
  zones.forEach((poly, zi) => {
    if (poly.length < 3) return;
    const isSel = zi === selectedZone && selectedProp === null && mode === 'select';
    ctx.fillStyle = isSel ? 'rgba(0, 255, 0, 0.15)' : 'rgba(0, 255, 0, 0.06)';
    ctx.beginPath();
    const p0 = worldToScreen(poly[0].x, poly[0].y, vp);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < poly.length; i++) {
      const p = worldToScreen(poly[i].x, poly[i].y, vp);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isSel ? '#00ff00' : '#00aa00';
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.stroke();
    poly.forEach((v, vi) => {
      const sp = worldToScreen(v.x, v.y, vp);
      ctx.fillStyle = (isSel && vi === selectedVert) ? '#ffff00' : (isSel ? '#00ff00' : '#00aa00');
      ctx.fillRect(sp.x - 4, sp.y - 4, 8, 8);
    });
    ctx.fillStyle = isSel ? '#00ff00' : '#00aa00';
    ctx.font = '11px monospace';
    ctx.fillText(`walk ${zi}`, p0.x + 6, p0.y - 6);
  });

  // ---- Interaction zones (orange) ----
  INTERACT_ZONES.forEach((iz, i) => {
    const tl = worldToScreen(iz.minX, iz.minY, vp);
    const br = worldToScreen(iz.maxX, iz.maxY, vp);
    const bw = br.x - tl.x, bh = br.y - tl.y;
    const isSel = i === selectedIZone && mode === 'select';

    ctx.fillStyle = isSel ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 165, 0, 0.08)';
    ctx.fillRect(tl.x, tl.y, bw, bh);
    ctx.strokeStyle = isSel ? '#ffaa00' : '#cc8800';
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(tl.x, tl.y, bw, bh);
    ctx.setLineDash([]);

    // Corner handles for selected
    if (isSel) {
      const corners = [
        { sx: tl.x, sy: tl.y }, { sx: br.x, sy: tl.y },
        { sx: tl.x, sy: br.y }, { sx: br.x, sy: br.y },
      ];
      corners.forEach(c => {
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(c.sx - 4, c.sy - 4, 8, 8);
      });
    }

    ctx.fillStyle = isSel ? '#ffaa00' : '#cc8800';
    ctx.font = '11px monospace';
    ctx.fillText(`${iz.id}: ${iz.label}`, tl.x + 4, tl.y - 4);
  });

  // ---- Interact draw mode preview ----
  if (mode === 'interact' && iDrawStart && iDrawCurrent) {
    const x1 = Math.min(iDrawStart.x, iDrawCurrent.x);
    const y1 = Math.min(iDrawStart.y, iDrawCurrent.y);
    const x2 = Math.max(iDrawStart.x, iDrawCurrent.x);
    const y2 = Math.max(iDrawStart.y, iDrawCurrent.y);
    const tl = worldToScreen(x1, y1, vp);
    const br = worldToScreen(x2, y2, vp);
    ctx.fillStyle = 'rgba(255, 165, 0, 0.15)';
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffaa00';
    ctx.font = '11px monospace';
    ctx.fillText(`${r(x2 - x1)} x ${r(y2 - y1)}`, tl.x + 4, tl.y - 4);
  }

  // ---- Interact mode crosshair ----
  if (mode === 'interact' && iDrawCurrent) {
    const sm = worldToScreen(iDrawCurrent.x, iDrawCurrent.y, vp);
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sm.x, 0); ctx.lineTo(sm.x, H);
    ctx.moveTo(0, sm.y); ctx.lineTo(W, sm.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- Walk draw mode: vertices + preview ----
  if (mode === 'draw') {
    if (drawVerts.length > 0) {
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const s0 = worldToScreen(drawVerts[0].x, drawVerts[0].y, vp);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < drawVerts.length; i++) {
        const sp = worldToScreen(drawVerts[i].x, drawVerts[i].y, vp);
        ctx.lineTo(sp.x, sp.y);
      }
      if (drawMouse) {
        const sm = worldToScreen(drawMouse.x, drawMouse.y, vp);
        ctx.lineTo(sm.x, sm.y);
        ctx.stroke();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(sm.x, sm.y);
        ctx.lineTo(s0.x, s0.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.stroke();
      }
      drawVerts.forEach((v, i) => {
        const sp = worldToScreen(v.x, v.y, vp);
        ctx.fillStyle = i === 0 ? '#ff0' : '#00ccff';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, i === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      });
      if (drawVerts.length >= 3) {
        const s0 = worldToScreen(drawVerts[0].x, drawVerts[0].y, vp);
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s0.x, s0.y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (drawMouse) {
      const sm = worldToScreen(drawMouse.x, drawMouse.y, vp);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sm.x, 0); ctx.lineTo(sm.x, H);
      ctx.moveTo(0, sm.y); ctx.lineTo(W, sm.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- Prop handles (red) — centered on visual middle ----
  SCENE_PROPS.forEach((prop, i) => {
    const { x: px, y: py } = propCenter(prop, vp);
    const isSel = selectedProp === i;
    const isDrag = dragging?.type === 'prop' && dragging.index === i;
    ctx.strokeStyle = isDrag ? '#ffff00' : (isSel ? '#ffff00' : '#ff4444');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 10, py); ctx.lineTo(px + 10, py);
    ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, PROP_HIT, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = isSel ? '#ffff00' : '#ff8888';
    ctx.font = '12px monospace';
    ctx.fillText(prop.id, px + 18, py - 12);
    ctx.fillText(`wx:${r(prop.wx)} wy:${r(prop.wy)} s:${prop.scale.toFixed(2)}`, px + 18, py + 2);
  });

  // ---- Instructions bar ----
  const modeLabel = mode === 'draw' ? 'DRAW WALK' : mode === 'interact' ? 'DRAW INTERACT' : 'SELECT';
  const modeColor = mode === 'draw' ? '#00ccff' : mode === 'interact' ? '#ffaa00' : '#aaa';
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(8, H - 86, 600, 78);
  ctx.fillStyle = modeColor;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(modeLabel, 14, H - 68);
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  if (mode === 'draw') {
    ctx.fillText('Click to place vertices (H/V snap) | Click start to close | Enter = close', 14, H - 50);
    ctx.fillText('Z = undo | Esc = cancel | D = back to select', 14, H - 34);
  } else if (mode === 'interact') {
    ctx.fillText('Click + drag to draw an interaction box | Esc = cancel', 14, H - 50);
    ctx.fillText('I = back to select | Del = delete selected interact zone', 14, H - 34);
  } else {
    ctx.fillText('D = draw walk zone | I = draw interact zone | Drag to edit', 14, H - 50);
    ctx.fillText('Tab = cycle walk | Tab+Shift = cycle interact | Del = delete | Scroll = resize prop', 14, H - 34);
  }
  ctx.fillText('C = copy values | ` = close editor', 14, H - 18);

  ctx.restore();
}

// ---- Keyboard ----
export function editorKeyDown(e, zones) {
  if (!active) return;

  if (e.key === 'd' || e.key === 'D') {
    mode = mode === 'draw' ? 'select' : 'draw';
    drawVerts = []; drawMouse = null;
    if (mode === 'draw') { selectedProp = null; selectedZone = -1; selectedIZone = -1; }
    updatePanel();
    return;
  }

  if (e.key === 'i' || e.key === 'I') {
    mode = mode === 'interact' ? 'select' : 'interact';
    iDrawStart = null; iDrawCurrent = null;
    if (mode === 'interact') { selectedProp = null; selectedZone = -1; }
    updatePanel();
    return;
  }

  if (mode === 'draw') {
    if (e.key === 'Escape') { drawVerts = []; drawMouse = null; mode = 'select'; updatePanel(); return; }
    if ((e.key === 'z' || e.key === 'Z') && drawVerts.length > 0) { drawVerts.pop(); updatePanel(); return; }
    if (e.key === 'Enter' && drawVerts.length >= 3) { closePolygon(zones); return; }
    return;
  }

  if (mode === 'interact') {
    if (e.key === 'Escape') { iDrawStart = null; iDrawCurrent = null; mode = 'select'; updatePanel(); return; }
    return;
  }

  // Select mode keys
  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      // Cycle interact zones
      selectedProp = null; selectedZone = -1; selectedVert = -1;
      if (INTERACT_ZONES.length > 0) selectedIZone = (selectedIZone + 1) % INTERACT_ZONES.length;
    } else {
      // Cycle walk zones
      selectedProp = null; selectedIZone = -1; selectedVert = -1;
      if (zones.length > 0) selectedZone = (selectedZone + 1) % zones.length;
    }
    updatePanel();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedIZone >= 0 && selectedIZone < INTERACT_ZONES.length && selectedProp === null && selectedZone < 0) {
      INTERACT_ZONES.splice(selectedIZone, 1);
      selectedIZone = Math.min(selectedIZone, INTERACT_ZONES.length - 1);
      updatePanel();
    } else if (selectedZone >= 0 && selectedZone < zones.length && selectedProp === null) {
      zones.splice(selectedZone, 1);
      selectedZone = Math.min(selectedZone, zones.length - 1);
      selectedVert = -1;
      updatePanel();
    }
  }
}

function closePolygon(zones) {
  if (drawVerts.length < 3) return;
  const last = drawVerts[drawVerts.length - 1];
  const first = drawVerts[0];
  if (last.x !== first.x && last.y !== first.y) {
    drawVerts.push({ x: first.x, y: last.y });
  }
  zones.push([...drawVerts]);
  selectedZone = zones.length - 1;
  selectedProp = null;
  showToast(`Walk zone ${selectedZone} created`);
  drawVerts = []; drawMouse = null; mode = 'select';
  updatePanel();
}

// ---- Mouse handlers ----
export function editorMouseDown(e, canvas, zones) {
  if (!active) return false;
  if (e.button === 2) {
    if (mode === 'draw') { drawVerts = []; drawMouse = null; }
    if (mode === 'interact') { iDrawStart = null; iDrawCurrent = null; }
    return true;
  }

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const vp = getViewport(canvas.width, canvas.height);
  const { x: wx, y: wy } = screenToWorld(sx, sy, vp);

  // ---- Draw walk zone mode ----
  if (mode === 'draw') {
    if (drawVerts.length === 0) {
      drawVerts.push({ x: Math.round(wx), y: Math.round(wy) });
    } else {
      const last = drawVerts[drawVerts.length - 1];
      const snapped = snapPerp(last, wx, wy);
      if (drawVerts.length >= 3) {
        const startS = worldToScreen(drawVerts[0].x, drawVerts[0].y, vp);
        if (Math.hypot(sx - startS.x, sy - startS.y) < 14) {
          closePolygon(zones);
          return true;
        }
      }
      drawVerts.push(snapped);
    }
    updatePanel();
    return true;
  }

  // ---- Draw interact zone mode ----
  if (mode === 'interact') {
    iDrawStart = { x: Math.round(wx), y: Math.round(wy) };
    iDrawCurrent = { ...iDrawStart };
    return true;
  }

  // ---- Select mode ----

  // Props — hit test at visual center
  for (let i = SCENE_PROPS.length - 1; i >= 0; i--) {
    const { x: px, y: py } = propCenter(SCENE_PROPS[i], vp);
    if (Math.hypot(sx - px, sy - py) < PROP_HIT + 4) {
      selectedProp = i; selectedZone = -1; selectedVert = -1; selectedIZone = -1;
      dragging = { type: 'prop', index: i };
      updatePanel();
      return true;
    }
  }

  // Interact zone corners/edges
  for (let i = 0; i < INTERACT_ZONES.length; i++) {
    const iz = INTERACT_ZONES[i];
    const tl = worldToScreen(iz.minX, iz.minY, vp);
    const br = worldToScreen(iz.maxX, iz.maxY, vp);
    // Corner handles
    const corners = [
      { sx: tl.x, sy: tl.y, edge: 'tl' }, { sx: br.x, sy: tl.y, edge: 'tr' },
      { sx: tl.x, sy: br.y, edge: 'bl' }, { sx: br.x, sy: br.y, edge: 'br' },
    ];
    for (const c of corners) {
      if (Math.hypot(sx - c.sx, sy - c.sy) < VERT_HIT + 4) {
        selectedIZone = i; selectedZone = -1; selectedProp = null;
        dragging = { type: 'izone-corner', index: i, corner: c.edge };
        updatePanel();
        return true;
      }
    }
    // Click inside to select or drag-move
    if (sx >= tl.x && sx <= br.x && sy >= tl.y && sy <= br.y) {
      selectedIZone = i; selectedZone = -1; selectedProp = null;
      dragging = { type: 'izone-move', index: i, offX: wx - iz.minX, offY: wy - iz.minY };
      updatePanel();
      return true;
    }
  }

  // Walk zone vertices
  for (let zi = 0; zi < zones.length; zi++) {
    const poly = zones[zi];
    for (let vi = 0; vi < poly.length; vi++) {
      const sp = worldToScreen(poly[vi].x, poly[vi].y, vp);
      if (Math.hypot(sx - sp.x, sy - sp.y) < VERT_HIT + 4) {
        selectedZone = zi; selectedVert = vi; selectedProp = null; selectedIZone = -1;
        dragging = { type: 'vertex', zoneIdx: zi, vertIdx: vi };
        updatePanel();
        return true;
      }
    }
  }

  // Walk zone edges
  for (let zi = 0; zi < zones.length; zi++) {
    const poly = zones[zi];
    for (let i = 0; i < poly.length; i++) {
      const a = worldToScreen(poly[i].x, poly[i].y, vp);
      const b = worldToScreen(poly[(i + 1) % poly.length].x, poly[(i + 1) % poly.length].y, vp);
      if (distToSegment(sx, sy, a.x, a.y, b.x, b.y) < EDGE_HIT) {
        selectedZone = zi; selectedVert = -1; selectedProp = null; selectedIZone = -1;
        const va = poly[i], vb = poly[(i + 1) % poly.length];
        dragging = { type: 'edge', zoneIdx: zi, vertA: i, vertB: (i + 1) % poly.length, axis: va.y === vb.y ? 'y' : 'x' };
        updatePanel();
        return true;
      }
    }
  }

  // Click inside walk polygon
  for (let zi = 0; zi < zones.length; zi++) {
    if (pointInPoly(wx, wy, zones[zi])) {
      selectedZone = zi; selectedVert = -1; selectedProp = null; selectedIZone = -1;
      updatePanel();
      return true;
    }
  }

  selectedProp = null; selectedZone = -1; selectedVert = -1; selectedIZone = -1;
  updatePanel();
  return false;
}

export function editorMouseMove(e, canvas, zones) {
  if (!active) return false;
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const vp = getViewport(canvas.width, canvas.height);
  const { x: wx, y: wy } = screenToWorld(sx, sy, vp);

  if (mode === 'draw') {
    const last = drawVerts.length > 0 ? drawVerts[drawVerts.length - 1] : null;
    drawMouse = snapPerp(last, wx, wy);
    drawMouse.x = Math.max(0, Math.min(WORLD_W, drawMouse.x));
    drawMouse.y = Math.max(0, Math.min(WORLD_H, drawMouse.y));
    return drawVerts.length > 0;
  }

  if (mode === 'interact') {
    iDrawCurrent = { x: Math.round(Math.max(0, Math.min(WORLD_W, wx))), y: Math.round(Math.max(0, Math.min(WORLD_H, wy))) };
    return !!iDrawStart;
  }

  if (!dragging) return false;

  if (dragging.type === 'prop') {
    const prop = SCENE_PROPS[dragging.index];
    const halfH = prop.type === 'animated' ? (prop.fh * prop.scale) / 2 : 20;
    prop.wx = Math.round(wx);
    prop.wy = Math.round(wy + halfH);
    updatePanel(); return true;
  }

  if (dragging.type === 'izone-corner') {
    const iz = INTERACT_ZONES[dragging.index];
    const nx = Math.round(Math.max(0, Math.min(WORLD_W, wx)));
    const ny = Math.round(Math.max(0, Math.min(WORLD_H, wy)));
    if (dragging.corner === 'tl') { iz.minX = Math.min(nx, iz.maxX - 5); iz.minY = Math.min(ny, iz.maxY - 5); }
    if (dragging.corner === 'tr') { iz.maxX = Math.max(nx, iz.minX + 5); iz.minY = Math.min(ny, iz.maxY - 5); }
    if (dragging.corner === 'bl') { iz.minX = Math.min(nx, iz.maxX - 5); iz.maxY = Math.max(ny, iz.minY + 5); }
    if (dragging.corner === 'br') { iz.maxX = Math.max(nx, iz.minX + 5); iz.maxY = Math.max(ny, iz.minY + 5); }
    updatePanel(); return true;
  }

  if (dragging.type === 'izone-move') {
    const iz = INTERACT_ZONES[dragging.index];
    const w = iz.maxX - iz.minX, h = iz.maxY - iz.minY;
    iz.minX = Math.round(Math.max(0, Math.min(WORLD_W - w, wx - dragging.offX)));
    iz.minY = Math.round(Math.max(0, Math.min(WORLD_H - h, wy - dragging.offY)));
    iz.maxX = iz.minX + w;
    iz.maxY = iz.minY + h;
    updatePanel(); return true;
  }

  if (dragging.type === 'vertex') {
    const v = zones[dragging.zoneIdx][dragging.vertIdx];
    v.x = Math.round(Math.max(0, Math.min(WORLD_W, wx)));
    v.y = Math.round(Math.max(0, Math.min(WORLD_H, wy)));
    updatePanel(); return true;
  }

  if (dragging.type === 'edge') {
    const poly = zones[dragging.zoneIdx];
    const va = poly[dragging.vertA], vb = poly[dragging.vertB];
    if (dragging.axis === 'y') { const ny = Math.round(Math.max(0, Math.min(WORLD_H, wy))); va.y = ny; vb.y = ny; }
    else { const nx = Math.round(Math.max(0, Math.min(WORLD_W, wx))); va.x = nx; vb.x = nx; }
    updatePanel(); return true;
  }

  return false;
}

export function editorMouseUp(e, canvas, zones) {
  if (!active) return;

  // Finish drawing interact zone
  if (mode === 'interact' && iDrawStart && iDrawCurrent) {
    const x1 = Math.min(iDrawStart.x, iDrawCurrent.x);
    const y1 = Math.min(iDrawStart.y, iDrawCurrent.y);
    const x2 = Math.max(iDrawStart.x, iDrawCurrent.x);
    const y2 = Math.max(iDrawStart.y, iDrawCurrent.y);
    if (x2 - x1 >= 5 && y2 - y1 >= 5) {
      const id = `zone_${INTERACT_ZONES.length}`;
      INTERACT_ZONES.push({ id, label: id, minX: x1, minY: y1, maxX: x2, maxY: y2 });
      selectedIZone = INTERACT_ZONES.length - 1;
      showToast(`Interact zone "${id}" created`);
    }
    iDrawStart = null;
    updatePanel();
    return;
  }

  dragging = null;
}

export function editorWheel(e, canvas) {
  if (!active || selectedProp === null) return false;
  e.preventDefault();
  const prop = SCENE_PROPS[selectedProp];
  const delta = e.deltaY > 0 ? -0.02 : 0.02;
  prop.scale = Math.round(Math.max(0.05, prop.scale + delta) * 100) / 100;
  updatePanel();
  return true;
}

// ---- Helpers ----
function pointInPoly(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const yi = verts[i].y, yj = verts[j].y;
    if ((yi > py) !== (yj > py) && px < (verts[j].x - verts[i].x) * (py - yi) / (yj - yi) + verts[i].x) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ---- Copy values ----
export function editorCopyValues(zones) {
  if (!active) return;
  const lines = [];
  lines.push('// WALK_ZONES');
  lines.push('const WALK_ZONES = [');
  zones.forEach(poly => {
    lines.push('  [');
    poly.forEach(v => lines.push(`    { x: ${r(v.x)}, y: ${r(v.y)} },`));
    lines.push('  ],');
  });
  lines.push('];');
  lines.push('');
  lines.push('// INTERACT_ZONES');
  INTERACT_ZONES.forEach(iz => {
    lines.push(`// ${iz.id} "${iz.label}": minX: ${r(iz.minX)}, minY: ${r(iz.minY)}, maxX: ${r(iz.maxX)}, maxY: ${r(iz.maxY)}`);
  });
  lines.push('');
  lines.push('// SCENE_PROPS positions');
  SCENE_PROPS.forEach(prop => {
    lines.push(`// ${prop.id}: wx: ${r(prop.wx)}, wy: ${r(prop.wy)}, scale: ${prop.scale.toFixed(2)}`);
  });
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
    console.log(text);
  });
}

// ---- Info panel ----
let panel = null;
function updatePanel() {
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'editor-panel';
    panel.style.cssText = `
      position:fixed; top:10px; right:10px; z-index:9999;
      background:rgba(0,0,0,0.85); color:#0f0; font:12px monospace;
      padding:10px 14px; pointer-events:none; max-width:340px;
      border:1px solid #0f0; display:none;
    `;
    document.body.appendChild(panel);
  }
  if (!active) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  let html = '<b style="color:#ff0">EDITOR</b>';
  if (mode === 'draw') html += ' <span style="color:#00ccff">[ DRAW WALK ]</span>';
  if (mode === 'interact') html += ' <span style="color:#ffaa00">[ DRAW INTERACT ]</span>';
  html += '<br>';

  if (mode === 'draw') {
    html += `<span style="color:#00ccff">${drawVerts.length} vertices</span><br>`;
  } else if (mode === 'interact') {
    html += `<span style="color:#ffaa00">click + drag to draw box</span><br>`;
  } else if (selectedProp !== null) {
    const p = SCENE_PROPS[selectedProp];
    html += `<br><span style="color:#f88">${p.id}</span><br>`;
    html += `wx: ${r(p.wx)}  wy: ${r(p.wy)}<br>`;
    html += `scale: ${p.scale.toFixed(2)}<br>`;
    html += `<span style="color:#888">scroll = resize</span>`;
  } else if (selectedIZone >= 0 && selectedIZone < INTERACT_ZONES.length) {
    const iz = INTERACT_ZONES[selectedIZone];
    html += `<br><span style="color:#ffaa00">${iz.id}: ${iz.label}</span><br>`;
    html += `${r(iz.minX)},${r(iz.minY)} → ${r(iz.maxX)},${r(iz.maxY)}<br>`;
    html += `<span style="color:#888">drag corners or body</span>`;
  } else if (selectedZone >= 0) {
    html += `<br><span style="color:#0f0">walk ${selectedZone}</span><br>`;
    html += `<span style="color:#888">drag vertices or edges</span>`;
  } else {
    html += `<span style="color:#888">click to select</span>`;
  }
  panel.innerHTML = html;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:#0f0; color:#000; font:14px monospace; padding:8px 20px;
    z-index:9999; transition:opacity 0.5s;
  `;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 1200);
  setTimeout(() => t.remove(), 1800);
}

function r(v) { return Math.round(v); }
