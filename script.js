// script.js — Goku Pixel Battle (mobile-first, production-ready)
// Author: ChatGPT for Zeyad
// Minimal comments, clear structure.

(() => {
  // ---------- config ----------
  const CONFIG = {
    gokuSpeed: 220,         // px / sec
    kameBaseSpeed: 700,     // px / sec (will be multiplied by attackSpeed)
    kameLife: 1200,         // ms visible lifetime / travel window
    attackCooldown: 600,    // ms base cooldown
    hitDamage: 20,
    enemyRespawnDelay: 800, // ms after hit to return to neutral
    spriteSizeCSSVar: '--pixel-size'
  };

  // ---------- DOM ----------
  const app = document.getElementById('app');
  const wrapper = document.getElementById('game-wrapper');
  const gokuEl = document.getElementById('goku');
  const enemyEl = document.getElementById('enemy');
  const kameEl = document.getElementById('kame');
  const canvas = document.getElementById('game-canvas');
  const leftBtn = document.getElementById('left');
  const rightBtn = document.getElementById('right');
  const attackBtn = document.getElementById('attack');
  const preloader = document.getElementById('preloader');
  const scoreEl = document.querySelector('#score .value') || document.querySelector('#score');
  const hpEl = document.querySelector('#hp .value') || document.querySelector('#hp');
  const levelEl = document.querySelector('#level .value') || document.querySelector('#level');
  const messageBox = document.getElementById('message');
  const sfxKame = document.getElementById('sfx-kame');

  // modal & settings
  const settingsModal = document.getElementById('modal-settings');
  const btnSettings = document.getElementById('btn-settings');
  const closeSettings = document.getElementById('close-settings');
  const toggleSound = document.getElementById('toggle-sound');
  const toggleVibrate = document.getElementById('toggle-vibrate');
  const attackSpeedInput = document.getElementById('attack-speed');
  const gfxQuality = document.getElementById('gfx-quality');
  const saveSettingsBtn = document.getElementById('save-settings');

  // ---------- state ----------
  let state = {
    width: 360,
    height: 640,
    spriteSize: 64,
    goku: { x: 0, y: 0, dir: 'right', state: 'neutral' },
    enemy: { x: 0, y: 0, dir: 'left', state: 'neutral', alive: true },
    shots: [], // {id, x, y, dir, speed, el, createdAt}
    moveLeft: false,
    moveRight: false,
    lastAttackAt: 0,
    cooldown: CONFIG.attackCooldown,
    score: 0,
    hp: 100,
    level: 1,
    settings: {
      sound: true,
      vibrate: false,
      attackSpeed: 1,
      gfx: 'medium'
    }
  };

  // ---------- utilities ----------
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const setAttr = (el, k, v) => el && el.setAttribute(k, v);
  const removeAttr = (el, k) => el && el.removeAttribute(k);

  // read & write settings
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('goku_settings') || '{}');
      state.settings = Object.assign(state.settings, s);
    } catch (e) { /* ignore */ }
    // apply to UI if present
    if (toggleSound) toggleSound.checked = !!state.settings.sound;
    if (toggleVibrate) toggleVibrate.checked = !!state.settings.vibrate;
    if (attackSpeedInput) attackSpeedInput.value = state.settings.attackSpeed;
    if (gfxQuality) gfxQuality.value = state.settings.gfx;
  }
  function saveSettings() {
    localStorage.setItem('goku_settings', JSON.stringify(state.settings));
  }

  // get computed sprite size from CSS var
  function computeSpriteSize() {
    const root = getComputedStyle(document.documentElement);
    const val = root.getPropertyValue(CONFIG.spriteSizeCSSVar).trim();
    if (!val) return 64;
    if (val.endsWith('px')) return parseInt(val);
    return parseInt(val) || 64;
  }

  // ---------- preload assets ----------
  function preloadImages(list) {
    return Promise.all(list.map(src => new Promise((res) => {
      const img = new Image();
      img.src = src;
      img.onload = () => res({src, ok:true});
      img.onerror = () => res({src, ok:false});
    })));
  }

  function preloadAll() {
    const images = [
      'goku_neutral.png',
      'goku_walk_right.png',
      'goku_walk_left.png',
      'goku_attack_right.png',
      'goku_attack_left.png',
      'kamehameha_right.png',
      'kamehameha_left.png',
      'character2_neutral.png',
      'character2_walk_right.png',
      'character2_walk_left.png',
      'character2_hit_right.png',
      'character2_hit_left.png',
      'sky.png',
      'ground.png'
    ];
    return preloadImages(images).then(() => {
      // ensure audio loaded, best-effort
      if (sfxKame && state.settings.sound) {
        sfxKame.load();
      }
      return true;
    });
  }

  // ---------- positioning helpers ----------
  function layoutReset() {
    const rect = wrapper.getBoundingClientRect();
    state.width = Math.max(280, Math.floor(rect.width));
    state.height = Math.max(320, Math.floor(rect.height));
    state.spriteSize = computeSpriteSize();

    // spawn positions
    state.goku.x = Math.floor(state.width * 0.12);
    state.goku.y = Math.floor(state.height - state.spriteSize - (state.height * 0.04));
    state.enemy.x = Math.floor(state.width * 0.72);
    state.enemy.y = Math.floor(state.height - state.spriteSize - (state.height * 0.04));

    // position DOM
    applyPositions();
  }

  function applyPositions() {
    if (gokuEl) {
      gokuEl.style.left = (state.goku.x) + 'px';
      gokuEl.style.top = (state.goku.y) + 'px';
      gokuEl.style.width = state.spriteSize + 'px';
      gokuEl.style.height = state.spriteSize + 'px';
      setSpriteOrientation(gokuEl, state.goku.dir);
      setSpriteState(gokuEl, state.goku.state);
    }
    if (enemyEl) {
      enemyEl.style.left = state.enemy.x + 'px';
      enemyEl.style.top = state.enemy.y + 'px';
      enemyEl.style.width = state.spriteSize + 'px';
      enemyEl.style.height = state.spriteSize + 'px';
      setSpriteOrientation(enemyEl, state.enemy.dir);
      setSpriteState(enemyEl, state.enemy.state);
    }
    // set kame default size
    if (kameEl) {
      kameEl.style.height = Math.round(state.spriteSize * 0.5) + 'px';
      kameEl.style.width = Math.round(state.spriteSize * 1.3) + 'px';
    }
  }

  // set sprite orientation (flip)
  function setSpriteOrientation(el, dir) {
    if (!el) return;
    if (dir === 'left') el.classList.add('flipX');
    else el.classList.remove('flipX');
    el.dataset.direction = dir;
  }

  // set sprite visual state (neutral, walk, attack, hit)
  function setSpriteState(el, st) {
    if (!el) return;
    el.dataset.state = st;
    // compute src patterns (fallback-safe)
    const id = el.id;
    const dir = el.dataset.direction || 'right';
    let src = '';
    if (id === 'goku') {
      if (st === 'neutral') src = 'goku_neutral.png';
      else if (st === 'walk') src = `goku_walk_${dir}.png`;
      else if (st === 'attack') src = `goku_attack_${dir}.png`;
    } else if (id === 'enemy') {
      if (st === 'neutral') src = 'character2_neutral.png';
      else if (st === 'walk') src = `character2_walk_${dir}.png`;
      else if (st === 'hit') src = `character2_hit_${dir}.png`;
    }
    // safe set: if file missing browser will show broken image; prefer flip fallback
    if (src) el.src = src;
  }

  // ---------- input handling ----------
  function bindControls() {
    // pointer / touch support - use pointer events for broad support
    const bindHold = (btn, startFn, endFn) => {
      let active = false;
      const onDown = (e) => {
        e.preventDefault();
        active = true;
        startFn(e);
      };
      const onUp = (e) => {
        if (!active) return;
        active = false;
        endFn(e);
      };
      btn.addEventListener('pointerdown', onDown, {passive:false});
      window.addEventListener('pointerup', onUp);
      btn.addEventListener('pointercancel', onUp);
      btn.addEventListener('pointerleave', onUp);
      // also prevent contextmenu long-press
      btn.addEventListener('contextmenu', e => e.preventDefault());
    };

    bindHold(leftBtn,
      () => { state.moveLeft = true; state.moveRight = false; state.goku.dir='left'; setSpriteState(gokuEl,'walk'); },
      () => { state.moveLeft = false; setSpriteState(gokuEl,'neutral'); }
    );

    bindHold(rightBtn,
      () => { state.moveRight = true; state.moveLeft = false; state.goku.dir='right'; setSpriteState(gokuEl,'walk'); },
      () => { state.moveRight = false; setSpriteState(gokuEl,'neutral'); }
    );

    // attack press (single tap - no hold)
    attackBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      triggerAttack();
    });

    // keyboard fallback
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        state.moveLeft = true; state.goku.dir='left'; setSpriteState(gokuEl,'walk');
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        state.moveRight = true; state.goku.dir='right'; setSpriteState(gokuEl,'walk');
      } else if (e.key === ' ' || e.key === 'Enter') {
        triggerAttack();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        state.moveLeft = false; setSpriteState(gokuEl,'neutral');
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        state.moveRight = false; setSpriteState(gokuEl,'neutral');
      }
    });

    // settings modal buttons
    if (btnSettings) btnSettings.addEventListener('click', () => openSettings());
    if (closeSettings) closeSettings.addEventListener('click', () => closeSettingsModal());
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => {
      state.settings.sound = !!toggleSound.checked;
      state.settings.vibrate = !!toggleVibrate.checked;
      state.settings.attackSpeed = parseFloat(attackSpeedInput.value) || 1;
      state.settings.gfx = gfxQuality.value || 'medium';
      saveSettings();
      closeSettingsModal();
    });

    // modal open/close on backdrop or ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !settingsModal.hidden) closeSettingsModal();
    });
  }

  // ---------- settings modal helpers ----------
  function openSettings() {
    if (!settingsModal) return;
    settingsModal.hidden = false;
    settingsModal.querySelector('.modal-inner').focus?.();
  }
  function closeSettingsModal() {
    if (!settingsModal) return;
    settingsModal.hidden = true;
  }

  // ---------- attack / shots ----------
  let shotId = 0;
  function triggerAttack() {
    const nowT = Date.now();
    const cooldown = CONFIG.attackCooldown / (state.settings.attackSpeed || 1);
    if (nowT - state.lastAttackAt < cooldown) {
      // speed-up audio if spam pressed
      if (sfxKame && state.settings.sound) {
        sfxKame.playbackRate = clamp(1 + (0.8 * ((nowT - state.lastAttackAt) / cooldown)), 0.6, 3);
        sfxKame.currentTime = 0;
        sfxKame.play().catch(()=>{});
      }
      return;
    }
    state.lastAttackAt = nowT;

    // visual attack
    state.goku.state = 'attack';
    setSpriteState(gokuEl, 'attack');
    // schedule return to neutral after short time
    setTimeout(() => {
      if (!state.moveLeft && !state.moveRight) {
        state.goku.state = 'neutral';
        setSpriteState(gokuEl, 'neutral');
      } else {
        state.goku.state = 'walk';
        setSpriteState(gokuEl, 'walk');
      }
    }, 300);

    // audio
    if (sfxKame && state.settings.sound) {
      sfxKame.playbackRate = 1 + Math.max(0, Math.min(1.8, (Date.now() - (state.lastAttackAt-1000))/1000));
      sfxKame.currentTime = 0;
      sfxKame.play().catch(()=>{});
    }

    // spawn shot
    const dir = state.goku.dir === 'left' ? -1 : 1;
    const startX = state.goku.x + (dir === 1 ? state.spriteSize : -Math.round(state.spriteSize * 1.1));
    const startY = state.goku.y + Math.round(state.spriteSize*0.35);
    const shot = {
      id: ++shotId,
      x: startX,
      y: startY,
      dir,
      speed: CONFIG.kameBaseSpeed * (state.settings.attackSpeed || 1),
      createdAt: Date.now(),
      el: null
    };
    // clone kame element for independent movement
    const el = kameEl.cloneNode(true);
    el.style.display = 'block';
    el.id = `kame_${shot.id}`;
    el.dataset.direction = dir === -1 ? 'left' : 'right';
    // set left/top absolute within wrapper
    el.style.position = 'absolute';
    el.style.left = shot.x + 'px';
    el.style.top = shot.y + 'px';
    // flip if left
    if (dir === -1) el.classList.add('flipX');
    wrapper.appendChild(el);
    shot.el = el;
    state.shots.push(shot);

    // throttle vibrate
    if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(30);
  }

  // ---------- collision / hit ----------
  function checkShotCollision(shot) {
    // simple AABB collision between shot and enemy
    const ex = state.enemy.x;
    const ey = state.enemy.y;
    const sW = parseFloat(shot.el.style.width) || state.spriteSize * 1.2;
    const sH = parseFloat(shot.el.style.height) || state.spriteSize * 0.6;
    const sx = shot.x;
    const sy = shot.y;
    const ew = state.spriteSize;
    const eh = state.spriteSize;

    if (sx + sW/2 > ex && sx < ex + ew && sy + sH/2 > ey && sy < ey + eh) {
      return true;
    }
    return false;
  }

  function enemyHit(dirFromShot) {
    if (!state.enemy.alive) return;
    state.enemy.alive = false;
    state.enemy.state = 'hit';
    // set correct dir so hit image orientation matches
    state.enemy.dir = dirFromShot === 1 ? 'right' : 'left';
    setSpriteOrientation(enemyEl, state.enemy.dir);
    setSpriteState(enemyEl, 'hit');
    state.hp = Math.max(0, state.hp - CONFIG.hitDamage);
    state.score += 10;
    updateHUD();

    if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([50,20,50]);

    // respawn / return to neutral after delay
    setTimeout(() => {
      state.enemy.alive = true;
      state.enemy.state = 'neutral';
      // random move direction for enemy next time
      state.enemy.dir = Math.random() > 0.5 ? 'right' : 'left';
      setSpriteOrientation(enemyEl, state.enemy.dir);
      setSpriteState(enemyEl, 'neutral');
      // reposition enemy a bit (simple)
      const margin = 20;
      const minX = Math.floor(state.width * 0.45);
      const maxX = Math.floor(state.width * 0.88 - state.spriteSize);
      state.enemy.x = clamp(minX + Math.round(Math.random() * (maxX - minX)), margin, state.width - state.spriteSize - margin);
      applyPositions();
    }, CONFIG.enemyRespawnDelay);
  }

  // ---------- HUD ----------
  function updateHUD() {
    if (scoreEl) {
      if (scoreEl.tagName === 'SPAN' || scoreEl.tagName === 'DIV') {
        scoreEl.textContent = String(state.score);
      } else scoreEl.innerText = String(state.score);
    }
    if (hpEl) {
      hpEl.textContent = String(state.hp);
    }
    if (levelEl) {
      levelEl.textContent = String(state.level);
    }

    if (state.hp <= 0) {
      showMessage('Game Over', 1500);
      // simple reset after short time
      setTimeout(() => {
        state.hp = 100; state.score = 0; state.level = 1;
        updateHUD();
      }, 1800);
    }
  }

  // ---------- messages ----------
  let msgTimer = null;
  function showMessage(txt, ms = 1000) {
    if (!messageBox) return;
    messageBox.textContent = txt;
    messageBox.style.display = 'block';
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { messageBox.style.display = 'none'; }, ms);
  }

  // ---------- main loop ----------
  let lastFrame = performance.now();
  function loop(t) {
    const dt = Math.min(40, t - lastFrame) / 1000; // seconds (cap dt)
    lastFrame = t;
    // movement
    if (state.moveLeft) {
      state.goku.x -= CONFIG.gokuSpeed * dt;
      state.goku.dir = 'left';
    } else if (state.moveRight) {
      state.goku.x += CONFIG.gokuSpeed * dt;
      state.goku.dir = 'right';
    }
    // clamp
    state.goku.x = clamp(state.goku.x, 4, state.width - state.spriteSize - 4);

    // update player DOM
    if (gokuEl) {
      gokuEl.style.left = Math.round(state.goku.x) + 'px';
      gokuEl.style.top = state.goku.y + 'px';
      setSpriteOrientation(gokuEl, state.goku.dir);
    }

    // basic enemy idle (small AI)
    if (state.enemy.alive) {
      // enemy patrol small area
      const patrolSpeed = 40;
      // simple wandering
      if (!state.enemy._dirTimer || Date.now() - state.enemy._dirTimer > 1200) {
        state.enemy._dir = Math.random() > 0.5 ? 'left' : 'right';
        state.enemy._dirTimer = Date.now();
      }
      if (state.enemy._dir === 'left') state.enemy.x -= patrolSpeed * dt;
      else state.enemy.x += patrolSpeed * dt;
      if (state.enemy.x < Math.floor(state.width*0.5)) state.enemy.x = Math.floor(state.width*0.5);
      if (state.enemy.x > state.width - state.spriteSize - 8) state.enemy.x = state.width - state.spriteSize - 8;
      enemyEl.style.left = Math.round(state.enemy.x) + 'px';
      enemyEl.style.top = state.enemy.y + 'px';
      setSpriteOrientation(enemyEl, state.enemy._dir);
      setSpriteState(enemyEl, 'walk');
    }

    // shots update
    const nowT = Date.now();
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      const elapsed = (nowT - s.createdAt) / 1000;
      const travel = s.speed * dt * s.dir;
      s.x += travel;
      // move DOM
      if (s.el) s.el.style.left = Math.round(s.x) + 'px';

      // check collision
      if (checkShotCollision(s) && state.enemy.alive) {
        // handle hit
        enemyHit(s.dir === 1 ? 1 : -1);
        // remove shot
        if (s.el && s.el.parentNode) s.el.parentNode.removeChild(s.el);
        state.shots.splice(i,1);
        continue;
      }

      // lifetime / out of bounds
      if (elapsed*1000 > CONFIG.kameLife || s.x < -200 || s.x > state.width + 300) {
        if (s.el && s.el.parentNode) s.el.parentNode.removeChild(s.el);
        state.shots.splice(i,1);
      }
    }

    // update HUD occasionally
    // (score/hp updated on events)
    // schedule next
    requestAnimationFrame(loop);
  }

  // ---------- bootstrap ----------
  function startGame() {
    loadSettings();
    layoutReset();
    bindControls();
    updateHUD();
    // hide preloader if still visible
    if (preloader) preloader.style.display = 'none';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  // safe resize handling
  let resizeTimer = null;
  function handleResize() {
    layoutReset();
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyPositions();
    }, 120);
  }
  window.addEventListener('resize', handleResize);
  new ResizeObserver(handleResize).observe(wrapper);

  // load assets then start
  preloadAll().then(() => {
    // small delay to let preloader show a bit
    setTimeout(startGame, 220);
  }).catch(()=> {
    setTimeout(startGame, 120);
  });

  // helpful expose for debugging (console)
  window.__goku = { state, CONFIG, startGame };

})();
