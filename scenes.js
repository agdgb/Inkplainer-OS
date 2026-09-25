/**
 * scenes.js
 * Multi-Scene Engine & Scene Transitions
 * Doodle Studio / Inkplainer
 */

(function(window) {
  'use strict';

  let _sceneIdCounter = 1;

  function initScenes() {
    if (!window.state) return;
    if (!state.scenes || state.scenes.length === 0) {
      const defaultScene = {
        id: 'scene_1',
        name: 'Scene 1',
        layers: state.layers || [],
        groups: state.groups || [],
        canvasBg: state.canvasBg ? JSON.parse(JSON.stringify(state.canvasBg)) : { type: 'solid', val: '#ffffff' },
        transition: 'eraser',
        transitionDuration: 1.2
      };
      state.scenes = [defaultScene];
      state.activeSceneId = 'scene_1';
    }
    renderSceneStrip();
  }

  function getActiveScene() {
    if (!state.scenes || state.scenes.length === 0) initScenes();
    let s = state.scenes.find(sc => sc.id === state.activeSceneId);
    if (!s) {
      s = state.scenes[0];
      state.activeSceneId = s.id;
    }
    return s;
  }

  function syncActiveSceneState() {
    const current = getActiveScene();
    if (current) {
      current.layers = state.layers ? [...state.layers] : [];
      current.groups = state.groups ? [...state.groups] : [];
      current.canvasBg = state.canvasBg ? JSON.parse(JSON.stringify(state.canvasBg)) : { type: 'solid', val: '#ffffff' };
    }
  }

  function switchScene(sceneId, isInternalPlayback = false) {
    if (state.activeSceneId === sceneId && !isInternalPlayback) return;
    
    // 1. Sync active scene state before switching away
    syncActiveSceneState();
    
    // 2. Locate target scene
    const target = state.scenes.find(sc => sc.id === sceneId);
    if (!target) return;
    
    // 3. Switch active scene ID
    state.activeSceneId = sceneId;
    
    // 4. Load target layers and settings into global state
    state.layers = target.layers ? [...target.layers] : [];
    state.groups = target.groups ? [...target.groups] : [];
    state.selectedLayerId = null;
    if (target.canvasBg) {
      state.canvasBg = JSON.parse(JSON.stringify(target.canvasBg));
    }
    
    // 5. Update canvas & UI
    if (typeof _mainCtx !== 'undefined') window.ctx = _mainCtx;
    state.bgCanvas = null;
    if (typeof redrawLayersOnCanvas === 'function') redrawLayersOnCanvas();
    if (typeof renderLayerList === 'function') renderLayerList();
    renderSceneStrip();
  }

  function addNewScene(name = null) {
    syncActiveSceneState();
    const id = 'scene_' + (++_sceneIdCounter);
    const newSceneName = name || ('Scene ' + (state.scenes.length + 1));
    const newScene = {
      id: id,
      name: newSceneName,
      layers: [],
      groups: [],
      canvasBg: state.canvasBg ? JSON.parse(JSON.stringify(state.canvasBg)) : { type: 'solid', val: '#ffffff' },
      transition: 'eraser',
      transitionDuration: 1.2
    };
    state.scenes.push(newScene);
    switchScene(id);
    if (typeof showToast === 'function') showToast(newSceneName + ' created');
  }

  function duplicateScene(sceneId, e) {
    if (e) e.stopPropagation();
    syncActiveSceneState();
    const src = state.scenes.find(sc => sc.id === sceneId);
    if (!src) return;
    
    const id = 'scene_' + (++_sceneIdCounter);
    const clonedLayers = (src.layers || []).map(l => {
      const newId = ++window._layerIdCounter;
      return { ...l, id: newId };
    });
    
    const duplicated = {
      id: id,
      name: src.name + ' (Copy)',
      layers: clonedLayers,
      groups: JSON.parse(JSON.stringify(src.groups || [])),
      canvasBg: JSON.parse(JSON.stringify(src.canvasBg || { type: 'solid', val: '#ffffff' })),
      transition: src.transition || 'eraser',
      transitionDuration: src.transitionDuration || 1.2
    };
    
    const idx = state.scenes.findIndex(sc => sc.id === sceneId);
    state.scenes.splice(idx + 1, 0, duplicated);
    switchScene(id);
    if (typeof showToast === 'function') showToast('Scene duplicated');
  }

  function deleteScene(sceneId, e) {
    if (e) e.stopPropagation();
    if (state.scenes.length <= 1) {
      if (typeof showToast === 'function') showToast('Cannot delete the only scene');
      return;
    }
    const idx = state.scenes.findIndex(sc => sc.id === sceneId);
    if (idx === -1) return;
    
    state.scenes.splice(idx, 1);
    const nextTarget = state.scenes[Math.max(0, idx - 1)];
    state.activeSceneId = null;
    switchScene(nextTarget.id);
    if (typeof showToast === 'function') showToast('Scene deleted');
  }

  function changeSceneTransition(sceneId, transitionType, e) {
    if (e) e.stopPropagation();
    const sc = state.scenes.find(s => s.id === sceneId);
    if (sc) {
      sc.transition = transitionType;
      renderSceneStrip();
    }
  }

  function renameScene(sceneId, e) {
    if (e) e.stopPropagation();
    const sc = state.scenes.find(s => s.id === sceneId);
    if (!sc) return;
    const newName = prompt('Enter new scene name:', sc.name);
    if (newName && newName.trim()) {
      sc.name = newName.trim();
      renderSceneStrip();
    }
  }

  function renderSceneStrip() {
    const container = document.getElementById('scene-tabs-container');
    const countBadge = document.getElementById('scene-count-badge');
    if (!container) return;
    
    if (!state.scenes || state.scenes.length === 0) initScenes();
    
    if (countBadge) {
      countBadge.textContent = state.scenes.length === 1 ? '1 Scene' : `${state.scenes.length} Scenes`;
    }
    
    container.innerHTML = '';
    state.scenes.forEach((sc, idx) => {
      const isActive = sc.id === state.activeSceneId;
      const isPlaying = state._multiScenePlaying && state._multiSceneIdx === idx;
      const layerCount = (sc.id === state.activeSceneId ? (state.layers?.length || 0) : (sc.layers?.length || 0));
      
      const pill = document.createElement('div');
      pill.className = `scene-pill ${isActive ? 'active' : ''} ${isPlaying ? 'playing-scene' : ''}`;
      pill.onclick = () => { if (!state.playing) switchScene(sc.id); };
      
      const info = document.createElement('div');
      info.style.cssText = 'display:flex;align-items:center;gap:6px;';
      info.innerHTML = `
        <span class="scene-pill-name" title="Double click to rename" ondblclick="renameScene('${sc.id}', event)">${sc.name || ('Scene ' + (idx + 1))}</span>
        <span class="scene-pill-layers">${layerCount} layer${layerCount === 1 ? '' : 's'}</span>
      `;
      pill.appendChild(info);
      
      if (idx < state.scenes.length - 1) {
        const transSelect = document.createElement('select');
        transSelect.className = 'scene-transition-select';
        transSelect.title = 'Transition to next scene';
        transSelect.onclick = (e) => e.stopPropagation();
        transSelect.onchange = (e) => changeSceneTransition(sc.id, e.target.value, e);
        transSelect.innerHTML = `
          <option value="eraser" ${sc.transition === 'eraser' ? 'selected' : ''}>🧽 Eraser Wipe</option>
          <option value="swipe"  ${sc.transition === 'swipe' ? 'selected' : ''}>✋ Hand Swipe</option>
          <option value="fade"   ${sc.transition === 'fade' ? 'selected' : ''}>🌫️ Fade Out</option>
          <option value="cut"    ${sc.transition === 'cut' ? 'selected' : ''}>✂️ Direct Cut</option>
        `;
        pill.appendChild(transSelect);
      }
      
      const actions = document.createElement('div');
      actions.className = 'scene-pill-actions';
      
      const dupBtn = document.createElement('button');
      dupBtn.className = 'scene-mini-btn';
      dupBtn.title = 'Duplicate Scene';
      dupBtn.innerHTML = '⧉';
      dupBtn.onclick = (e) => duplicateScene(sc.id, e);
      actions.appendChild(dupBtn);
      
      if (state.scenes.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.className = 'scene-mini-btn';
        delBtn.title = 'Delete Scene';
        delBtn.innerHTML = '✕';
        delBtn.onclick = (e) => deleteScene(sc.id, e);
        actions.appendChild(delBtn);
      }
      
      pill.appendChild(actions);
      container.appendChild(pill);
    });
  }

  // ─────────────────────────────────────────────
  // ── SCENE TRANSITION RUNNER
  // ─────────────────────────────────────────────
  function runSceneTransition(transitionType, nextScene, onComplete) {
    const W = state.canvasW;
    const H = state.canvasH;
    const mainCanvas = document.getElementById('main-canvas');
    
    const frozen = document.createElement('canvas');
    frozen.width = W;
    frozen.height = H;
    const fctx = frozen.getContext('2d');
    fctx.drawImage(mainCanvas, 0, 0);
    
    if (transitionType === 'cut') {
      hctx.clearRect(0, 0, W, H);
      fillBg(_mainCtx);
      onComplete();
      return;
    }
    
    if (transitionType === 'fade') {
      const DURATION = 650;
      const startTime = performance.now();
      function stepFade(now) {
        const p = Math.min(1, (now - startTime) / DURATION);
        _mainCtx.save();
        fillBg(_mainCtx);
        _mainCtx.globalAlpha = 1 - p;
        _mainCtx.drawImage(frozen, 0, 0);
        _mainCtx.restore();
        if (p < 1) {
          requestAnimationFrame(stepFade);
        } else {
          hctx.clearRect(0, 0, W, H);
          onComplete();
        }
      }
      requestAnimationFrame(stepFade);
      return;
    }
    
    if (transitionType === 'swipe') {
      const DURATION = 850;
      const startTime = performance.now();
      function stepSwipe(now) {
        const p = Math.min(1, (now - startTime) / DURATION);
        const ease = t => t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
        const ep = ease(p);
        const shiftX = -ep * W;
        
        _mainCtx.save();
        fillBg(_mainCtx);
        _mainCtx.drawImage(frozen, shiftX, 0);
        _mainCtx.restore();
        
        hctx.clearRect(0, 0, W, H);
        const handX = Math.round(W + shiftX);
        const handY = Math.round(H * 0.45);
        drawHand(hctx, handX, handY, 1, state.hand || 'custom1');
        
        if (p < 1) {
          requestAnimationFrame(stepSwipe);
        } else {
          hctx.clearRect(0, 0, W, H);
          fillBg(_mainCtx);
          onComplete();
        }
      }
      requestAnimationFrame(stepSwipe);
      return;
    }
    
    // Default: Whiteboard Eraser Wipe
    const DURATION = 1350;
    const startTime = performance.now();
    const dustParticles = [];
    for (let i = 0; i < 40; i++) {
      dustParticles.push({
        x: 0, y: 0,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        size: Math.random() * 3 + 1.5,
        alpha: 0,
        active: false
      });
    }
    
    function stepEraser(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / DURATION);
      
      const progressX = -60 + p * (W + 140);
      const zigzagFreq = 6;
      const zigzagY = (H * 0.5) + (H * 0.40) * Math.sin(p * Math.PI * 2 * zigzagFreq);
      
      _mainCtx.save();
      _mainCtx.beginPath();
      const wipeW = Math.max(0, progressX + 30);
      _mainCtx.rect(0, 0, wipeW, H);
      _mainCtx.arc(progressX + 10, zigzagY, 65, 0, Math.PI * 2);
      _mainCtx.clip();
      fillBg(_mainCtx);
      _mainCtx.restore();
      
      hctx.clearRect(0, 0, W, H);
      
      if (Math.random() < 0.6) {
        const pIndex = Math.floor(Math.random() * dustParticles.length);
        const dp = dustParticles[pIndex];
        dp.x = progressX + (Math.random() - 0.5) * 40;
        dp.y = zigzagY + 25 + Math.random() * 10;
        dp.alpha = 0.8;
        dp.active = true;
      }
      
      hctx.save();
      dustParticles.forEach(dp => {
        if (!dp.active) return;
        dp.x += dp.vx;
        dp.y += dp.vy;
        dp.alpha *= 0.94;
        if (dp.alpha < 0.05) dp.active = false;
        else {
          hctx.fillStyle = `rgba(180, 180, 180, ${dp.alpha})`;
          hctx.beginPath();
          hctx.arc(dp.x, dp.y, dp.size, 0, Math.PI * 2);
          hctx.fill();
        }
      });
      hctx.restore();
      
      // Draw Whiteboard Eraser Block on handCanvas
      hctx.save();
      const ew = 94;
      const eh = 48;
      const tilt = Math.cos(p * Math.PI * 2 * zigzagFreq) * 0.12;
      hctx.translate(progressX, zigzagY);
      hctx.rotate(tilt);
      
      hctx.shadowColor = 'rgba(0,0,0,0.22)';
      hctx.shadowBlur = 12;
      hctx.shadowOffsetX = 3;
      hctx.shadowOffsetY = 6;
      
      const rad = 8;
      hctx.fillStyle = '#1e293b';
      hctx.beginPath();
      hctx.roundRect(-ew/2, -eh/2, ew, eh * 0.68, [rad, rad, 2, 2]);
      hctx.fill();
      
      hctx.strokeStyle = 'rgba(255,255,255,0.12)';
      hctx.lineWidth = 1.5;
      for (let gx = -ew/2 + 16; gx < ew/2 - 10; gx += 12) {
        hctx.beginPath();
        hctx.moveTo(gx, -eh/2 + 6);
        hctx.lineTo(gx, -eh/2 + eh*0.68 - 6);
        hctx.stroke();
      }
      
      hctx.shadowColor = 'transparent';
      hctx.fillStyle = '#0f172a';
      hctx.beginPath();
      hctx.roundRect(-ew/2 - 1, -eh/2 + eh*0.68, ew + 2, eh * 0.34, [0, 0, rad, rad]);
      hctx.fill();
      
      hctx.fillStyle = '#cbd5e1';
      hctx.fillRect(-ew/2 + 4, -eh/2 + eh*0.68, ew - 8, 2);
      hctx.restore();
      
      const handHoldX = progressX + 12;
      const handHoldY = zigzagY - 14;
      drawHand(hctx, handHoldX, handHoldY, 1, state.hand || 'custom1');
      
      if (p < 1) {
        requestAnimationFrame(stepEraser);
      } else {
        hctx.clearRect(0, 0, W, H);
        fillBg(_mainCtx);
        onComplete();
      }
    }
    
    requestAnimationFrame(stepEraser);
  }

  function _playMultiSceneAt(sceneIdx) {
    if (!state.scenes || sceneIdx >= state.scenes.length) {
      _finishAllScenes();
      return;
    }
    
    state._multiSceneIdx = sceneIdx;
    const currentScene = state.scenes[sceneIdx];
    switchScene(currentScene.id, true);
    
    const styleLabel = document.getElementById('anim-style-label');
    if (styleLabel) {
      styleLabel.textContent = `${currentScene.name || ('Scene ' + (sceneIdx + 1))} (${sceneIdx + 1}/${state.scenes.length})`;
    }
    renderSceneStrip();
    
    if (!state.layers || state.layers.length === 0) {
      setTimeout(() => {
        _checkNextSceneOrFinish();
      }, 450);
      return;
    }
    
    if (typeof _isDrawingGeneration === 'function' && _isDrawingGeneration()) {
      if (typeof showTopbarBuffer === 'function') showTopbarBuffer();
      requestAnimationFrame(() => requestAnimationFrame(_generateNow));
    } else {
      _generateNow();
    }
  }

  function _checkNextSceneOrFinish() {
    if (state._multiScenePlaying && state.scenes && state.scenes.length > 1) {
      const nextIdx = state._multiSceneIdx + 1;
      if (nextIdx < state.scenes.length) {
        const currentScene = state.scenes[state._multiSceneIdx];
        const nextScene = state.scenes[nextIdx];
        const transType = currentScene.transition || 'eraser';
        
        const styleLabel = document.getElementById('anim-style-label');
        if (styleLabel) {
          styleLabel.textContent = `Transition: ${transType.toUpperCase()}…`;
        }
        
        runSceneTransition(transType, nextScene, () => {
          _playMultiSceneAt(nextIdx);
        });
        return;
      }
    }
    
    _finishAllScenes();
  }

  function _finishAllScenes() {
    state._multiScenePlaying = false;
    const btn = document.getElementById('play-pause-btn');
    if (btn) btn.disabled = true;
    const badge = document.getElementById('done-badge');
    if (badge) badge.classList.add('show');
    const label = document.getElementById('anim-style-label');
    if (label) label.textContent = '';
    state.done = true;
    if (typeof hideTopbarBuffer === 'function') hideTopbarBuffer();
    renderSceneStrip();
  }

  // Export functions to window
  window.initScenes = initScenes;
  window.getActiveScene = getActiveScene;
  window.syncActiveSceneState = syncActiveSceneState;
  window.switchScene = switchScene;
  window.addNewScene = addNewScene;
  window.duplicateScene = duplicateScene;
  window.deleteScene = deleteScene;
  window.renameScene = renameScene;
  window.changeSceneTransition = changeSceneTransition;
  window.renderSceneStrip = renderSceneStrip;
  window.runSceneTransition = runSceneTransition;
  window._playMultiSceneAt = _playMultiSceneAt;
  window._checkNextSceneOrFinish = _checkNextSceneOrFinish;
  window._finishAllScenes = _finishAllScenes;

  // Auto-initialize scenes on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initScenes, 60));
  } else {
    setTimeout(initScenes, 60);
  }

})(window);
