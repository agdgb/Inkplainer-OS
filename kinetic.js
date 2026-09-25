/**
 * kinetic.js
 * Asset Kinetic Movement & Dynamic Staging Engine
 * Doodle Studio / Inkplainer
 * 
 * Features:
 *  - Entrance Styles: Draw, Hand Push-In (Left, Right, Top, Bottom), Pop / Bounce
 *  - After-Draw Actions: Glide & Shrink to Corner (Top-Left, Top-Right, Bottom-Left, Bottom-Right), Hand Push-Out, Fade-Out
 *  - Live Canvas Kinetic Preview
 */

(function(window) {
  'use strict';

  // ── Corner Presets & Geometric Math ──────────────────────────────────────
  function calculateTargetCorner(layer, cornerPreset, moveScale) {
    const W = (window.state && window.state.canvasW) || 1280;
    const H = (window.state && window.state.canvasH) || 720;
    const margin = 36;
    const scale = Math.max(0.15, Math.min(0.9, moveScale || 0.40));
    
    const targetW = Math.round(layer.w * scale);
    const targetH = Math.round(layer.h * scale);
    let targetX = margin;
    let targetY = margin;

    switch (cornerPreset) {
      case 'top-right':
        targetX = W - targetW - margin;
        targetY = margin;
        break;
      case 'bottom-left':
        targetX = margin;
        targetY = H - targetH - margin;
        break;
      case 'bottom-right':
        targetX = W - targetW - margin;
        targetY = H - targetH - margin;
        break;
      case 'top-left':
      default:
        targetX = margin;
        targetY = margin;
        break;
    }

    return { targetX, targetY, targetW, targetH, scale };
  }

  // ── Easing Helpers ────────────────────────────────────────────────────────
  function cubicEaseInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function backEaseOut(t, overshoot = 1.4) {
    const p = t - 1;
    return 1 + (overshoot + 1) * Math.pow(p, 3) + overshoot * Math.pow(p, 2);
  }

  // ── Layer Property Setters ───────────────────────────────────────────────
  function setLayerEntrance(layerId, style) {
    if (!window.state || !window.state.layers) return;
    const layer = window.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.entranceStyle = style;
    if (typeof window.renderLayerList === 'function') window.renderLayerList();
    if (typeof window.scheduleAutoSave === 'function') window.scheduleAutoSave();
  }

  function setLayerPushDir(layerId, dir) {
    if (!window.state || !window.state.layers) return;
    const layer = window.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.pushDir = dir;
    if (typeof window.scheduleAutoSave === 'function') window.scheduleAutoSave();
  }

  function setLayerAfterAction(layerId, action) {
    if (!window.state || !window.state.layers) return;
    const layer = window.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.afterAction = action;
    if (typeof window.renderLayerList === 'function') window.renderLayerList();
    if (typeof window.scheduleAutoSave === 'function') window.scheduleAutoSave();
  }

  function setLayerCornerPreset(layerId, preset) {
    if (!window.state || !window.state.layers) return;
    const layer = window.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.cornerPreset = preset;
    if (typeof window.scheduleAutoSave === 'function') window.scheduleAutoSave();
  }

  function setLayerMoveScale(layerId, scale) {
    if (!window.state || !window.state.layers) return;
    const layer = window.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.moveScale = scale;
    if (typeof window.scheduleAutoSave === 'function') window.scheduleAutoSave();
  }

  // ── Entrance Animation Dispatcher (Tick per Frame) ───────────────────────
  function tickKineticEntrance(slot) {
    if (!slot || !slot.layer) return false;
    const style = slot.layer.entranceStyle;
    if (!style || style === 'draw') return false;

    if (style === 'hand_push') {
      _tickHandPush(slot);
      return true;
    }
    if (style === 'pop') {
      _tickPop(slot);
      return true;
    }
    return false;
  }

  function _tickHandPush(slot) {
    const layer = slot.layer;
    const sp = layer.speed ?? 40;
    const step = 0.018 * (sp / 25);
    slot._kineticProgress = (slot._kineticProgress || 0) + step;
    const p = Math.min(1, slot._kineticProgress);

    // Ease with subtle overshoot for cartoon punch
    const ease = p === 1 ? 1 : backEaseOut(p, 1.2);

    const dir = layer.pushDir || 'left';
    const W = window.state.canvasW || 1280;
    const H = window.state.canvasH || 720;

    let startX = layer.x;
    let startY = layer.y;

    if (dir === 'left') {
      startX = -layer.w - 60;
    } else if (dir === 'right') {
      startX = W + 60;
    } else if (dir === 'top') {
      startY = -layer.h - 60;
    } else if (dir === 'bottom') {
      startY = H + 60;
    }

    const curX = startX + (layer.x - startX) * ease;
    const curY = startY + (layer.y - startY) * ease;

    // Render layer onto slot canvas
    slot.ctx.clearRect(0, 0, W, H);
    slot.ctx.save();
    slot.ctx.globalAlpha = layer.opacity ?? 1;
    slot.ctx.drawImage(layer.img, curX, curY, layer.w, layer.h);
    slot.ctx.restore();

    // Render pushing hand onto hand canvas (hctx)
    if (window.hctx && typeof window.drawHand === 'function') {
      let hx = curX;
      let hy = curY + layer.h * 0.5;
      let handFlip = 1;

      if (dir === 'left') {
        hx = curX;
        hy = curY + layer.h * 0.5;
        handFlip = 1;
      } else if (dir === 'right') {
        hx = curX + layer.w;
        hy = curY + layer.h * 0.5;
        handFlip = -1;
      } else if (dir === 'top') {
        hx = curX + layer.w * 0.5;
        hy = curY;
        handFlip = 1;
      } else if (dir === 'bottom') {
        hx = curX + layer.w * 0.5;
        hy = curY + layer.h;
        handFlip = 1;
      }

      window.drawHand(window.hctx, hx, hy, handFlip, layer.hand || window.state.hand || 'custom1');
    }

    if (p >= 1) {
      if (window.hctx) window.hctx.clearRect(0, 0, W, H);
      slot._kineticProgress = 1;
      if (typeof window.finishAnim === 'function') {
        window.finishAnim();
      }
    }
  }

  function _tickPop(slot) {
    const layer = slot.layer;
    const sp = layer.speed ?? 40;
    const step = 0.024 * (sp / 25);
    slot._kineticProgress = (slot._kineticProgress || 0) + step;
    const p = Math.min(1, slot._kineticProgress);

    // Canva bounce pop curve: 0 -> 1.18 -> 0.96 -> 1.0
    let scale;
    if (p < 0.65) {
      scale = (p / 0.65) * 1.18;
    } else if (p < 0.85) {
      scale = 1.18 - ((p - 0.65) / 0.20) * 0.22;
    } else {
      scale = 0.96 + ((p - 0.85) / 0.15) * 0.04;
    }

    const W = window.state.canvasW || 1280;
    const H = window.state.canvasH || 720;
    const curW = layer.w * scale;
    const curH = layer.h * scale;
    const cx = layer.x + layer.w * 0.5;
    const cy = layer.y + layer.h * 0.5;

    slot.ctx.clearRect(0, 0, W, H);
    slot.ctx.save();
    slot.ctx.globalAlpha = Math.min(1, p * 2.5) * (layer.opacity ?? 1);
    slot.ctx.drawImage(layer.img, cx - curW * 0.5, cy - curH * 0.5, curW, curH);
    slot.ctx.restore();

    if (p >= 1) {
      slot._kineticProgress = 1;
      if (typeof window.finishAnim === 'function') {
        window.finishAnim();
      }
    }
  }

  // ── After-Draw Action Execution ──────────────────────────────────────────
  function executeLayerAfterAction(slot, onComplete) {
    if (!slot || !slot.layer) {
      if (onComplete) onComplete();
      return;
    }

    const layer = slot.layer;
    const action = layer.afterAction;

    if (!action || action === 'none') {
      if (onComplete) onComplete();
      return;
    }

    if (action === 'glide_corner') {
      _executeGlideCorner(slot, onComplete);
    } else if (action === 'push_out') {
      _executePushOut(slot, onComplete);
    } else if (action === 'fade_out') {
      _executeFadeOut(slot, onComplete);
    } else {
      if (onComplete) onComplete();
    }
  }

  function _executeGlideCorner(slot, onComplete) {
    const layer = slot.layer;
    if (!layer._origGeom) {
      layer._origGeom = { x: layer.x, y: layer.y, w: layer.w, h: layer.h, resizePct: layer.resizePct };
    }
    const W = window.state.canvasW || 1280;
    const H = window.state.canvasH || 720;
    const startX = layer.x;
    const startY = layer.y;
    const startW = layer.w;
    const startH = layer.h;

    const { targetX, targetY, targetW, targetH } = calculateTargetCorner(
      layer,
      layer.cornerPreset || 'top-left',
      layer.moveScale || 0.40
    );

    const duration = (layer.moveDuration || 0.85) * 1000;
    const startTime = performance.now();

    function stepGlide(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = cubicEaseInOut(p);

      const cx = startX + (targetX - startX) * ease;
      const cy = startY + (targetY - startY) * ease;
      const cw = startW + (targetW - startW) * ease;
      const ch = startH + (targetH - startH) * ease;

      // Render on slot canvas
      slot.ctx.clearRect(0, 0, W, H);
      slot.ctx.save();
      slot.ctx.globalAlpha = layer.opacity ?? 1;
      slot.ctx.drawImage(layer.img, cx, cy, cw, ch);
      slot.ctx.restore();

      // Live composite to main canvas for crisp view and video export recording
      if (window._mainCtx) {
        window._mainCtx.save();
        if (typeof window.fillBg === 'function') window.fillBg(window._mainCtx);
        if (window.state.bgCanvas) window._mainCtx.drawImage(window.state.bgCanvas, 0, 0);
        window._mainCtx.drawImage(slot.canvas, 0, 0);
        window._mainCtx.restore();
      }

      if (p < 1) {
        requestAnimationFrame(stepGlide);
      } else {
        // Update layer's actual geometry to the corner
        layer.x = targetX;
        layer.y = targetY;
        layer.w = targetW;
        layer.h = targetH;
        if (layer.baseW && layer.baseH) {
          layer.resizePct = Math.round((targetW / layer.baseW) * 100);
        }

        if (window.state.selectedLayerId === layer.id && typeof window.renderLayerList === 'function') {
          window.renderLayerList();
        }
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(stepGlide);
  }

  function _executePushOut(slot, onComplete) {
    const layer = slot.layer;
    const W = window.state.canvasW || 1280;
    const H = window.state.canvasH || 720;
    const startX = layer.x;
    const startY = layer.y;
    const targetX = W + 80;
    const duration = 750;
    const startTime = performance.now();

    function stepPushOut(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = p * p; // Accelerate out

      const cx = startX + (targetX - startX) * ease;
      const cy = startY;

      slot.ctx.clearRect(0, 0, W, H);
      slot.ctx.save();
      slot.ctx.globalAlpha = layer.opacity ?? 1;
      slot.ctx.drawImage(layer.img, cx, cy, layer.w, layer.h);
      slot.ctx.restore();

      if (window.hctx && typeof window.drawHand === 'function') {
        window.hctx.clearRect(0, 0, W, H);
        window.drawHand(window.hctx, cx, cy + layer.h * 0.5, 1, layer.hand || window.state.hand || 'custom1');
      }

      if (window._mainCtx) {
        window._mainCtx.save();
        if (typeof window.fillBg === 'function') window.fillBg(window._mainCtx);
        if (window.state.bgCanvas) window._mainCtx.drawImage(window.state.bgCanvas, 0, 0);
        window._mainCtx.drawImage(slot.canvas, 0, 0);
        window._mainCtx.restore();
      }

      if (p < 1) {
        requestAnimationFrame(stepPushOut);
      } else {
        if (window.hctx) window.hctx.clearRect(0, 0, W, H);
        slot.ctx.clearRect(0, 0, W, H);
        layer._clearedFromCanvas = true;
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(stepPushOut);
  }

  function _executeFadeOut(slot, onComplete) {
    const layer = slot.layer;
    const W = window.state.canvasW || 1280;
    const H = window.state.canvasH || 720;
    const duration = 550;
    const startTime = performance.now();
    const baseAlpha = layer.opacity ?? 1;

    function stepFade(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const alpha = (1 - p) * baseAlpha;

      slot.ctx.clearRect(0, 0, W, H);
      slot.ctx.save();
      slot.ctx.globalAlpha = alpha;
      slot.ctx.drawImage(layer.img, layer.x, layer.y, layer.w, layer.h);
      slot.ctx.restore();

      if (window._mainCtx) {
        window._mainCtx.save();
        if (typeof window.fillBg === 'function') window.fillBg(window._mainCtx);
        if (window.state.bgCanvas) window._mainCtx.drawImage(window.state.bgCanvas, 0, 0);
        window._mainCtx.drawImage(slot.canvas, 0, 0);
        window._mainCtx.restore();
      }

      if (p < 1) {
        requestAnimationFrame(stepFade);
      } else {
        slot.ctx.clearRect(0, 0, W, H);
        layer._clearedFromCanvas = true;
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(stepFade);
  }

  // ── Live Canvas Kinetic Motion Preview (In-Editor Test) ──────────────────
  function previewLayerKineticMotion(layerId) {
    if (!window.state || !window.state.layers) return;
    if (window.state.playing) return; // Don't interrupt full playback

    const layer = window.state.layers.find(l => l.id === layerId);
    if (!layer || !layer.img) return;

    const W = window.state.canvasW || 1280;
    const H = window.state.canvasH || 720;
    const origX = layer.x;
    const origY = layer.y;
    const origW = layer.w;
    const origH = layer.h;

    const { targetX, targetY, targetW, targetH } = calculateTargetCorner(
      layer,
      layer.cornerPreset || 'top-left',
      layer.moveScale || 0.40
    );

    const duration = 700;
    const startTime = performance.now();

    function stepPreview(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = cubicEaseInOut(p);

      const cx = origX + (targetX - origX) * ease;
      const cy = origY + (targetY - origY) * ease;
      const cw = origW + (targetW - origW) * ease;
      const ch = origH + (targetH - origH) * ease;

      // Redraw canvas with layer moving
      if (typeof window.redrawLayersOnCanvas === 'function') {
        layer.x = cx; layer.y = cy; layer.w = cw; layer.h = ch;
        window.redrawLayersOnCanvas();
      }

      // Draw subtle motion trail / highlight
      if (window.sctx) {
        window.sctx.clearRect(0, 0, W, H);
        window.sctx.save();
        window.sctx.strokeStyle = '#4f46e5';
        window.sctx.lineWidth = 2;
        window.sctx.setLineDash([4, 4]);
        window.sctx.strokeRect(cx, cy, cw, ch);
        window.sctx.restore();
      }

      if (p < 1) {
        requestAnimationFrame(stepPreview);
      } else {
        // Hold for 400ms then smoothly restore
        setTimeout(() => {
          const retStart = performance.now();
          const retDur = 450;
          function stepRestore(retNow) {
            const rel = Math.min(1, (retNow - retStart) / retDur);
            const rease = cubicEaseInOut(rel);
            const rx = targetX + (origX - targetX) * rease;
            const ry = targetY + (origY - targetY) * rease;
            const rw = targetW + (origW - targetW) * rease;
            const rh = targetH + (origH - targetH) * rease;

            layer.x = rx; layer.y = ry; layer.w = rw; layer.h = rh;
            if (typeof window.redrawLayersOnCanvas === 'function') window.redrawLayersOnCanvas();

            if (window.sctx) {
              window.sctx.clearRect(0, 0, W, H);
              window.sctx.save();
              window.sctx.strokeStyle = '#4f46e5';
              window.sctx.lineWidth = 1.5;
              window.sctx.setLineDash([4, 4]);
              window.sctx.strokeRect(rx, ry, rw, rh);
              window.sctx.restore();
            }

            if (rel < 1) {
              requestAnimationFrame(stepRestore);
            } else {
              layer.x = origX; layer.y = origY; layer.w = origW; layer.h = origH;
              if (window.sctx) window.sctx.clearRect(0, 0, W, H);
              if (typeof window.redrawLayersOnCanvas === 'function') window.redrawLayersOnCanvas();
              if (typeof window.drawSelectionHandles === 'function') window.drawSelectionHandles();
            }
          }
          requestAnimationFrame(stepRestore);
        }, 400);
      }
    }

    requestAnimationFrame(stepPreview);
  }

  function restoreLayersOrigGeom() {
    if (!window.state || !window.state.layers) return;
    window.state.layers.forEach(l => {
      if (!l) return;
      if (l._origGeom) {
        l.x = l._origGeom.x;
        l.y = l._origGeom.y;
        l.w = l._origGeom.w;
        l.h = l._origGeom.h;
        if (l._origGeom.resizePct !== undefined) l.resizePct = l._origGeom.resizePct;
      }
      l._clearedFromCanvas = false;
    });
  }

  // ── Export to window ──────────────────────────────────────────────────────
  window.calculateTargetCorner = calculateTargetCorner;
  window.setLayerEntrance = setLayerEntrance;
  window.setLayerPushDir = setLayerPushDir;
  window.setLayerAfterAction = setLayerAfterAction;
  window.setLayerCornerPreset = setLayerCornerPreset;
  window.setLayerMoveScale = setLayerMoveScale;
  window.tickKineticEntrance = tickKineticEntrance;
  window.executeLayerAfterAction = executeLayerAfterAction;
  window.previewLayerKineticMotion = previewLayerKineticMotion;
  window.restoreLayersOrigGeom = restoreLayersOrigGeom;

})(window);
