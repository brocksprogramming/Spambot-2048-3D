// ══════════════════════════════════════════════════════════════
//  SPAMBOT 2048 3D — Chrome Extension 3D Cyber-Runner
// ══════════════════════════════════════════════════════════════

const DONATE_URL = "https://www.paypal.com/ncp/payment/UTN7RXFFSM2Z6";

// ── ASCII Art ─────────────────────────────────────────────────
document.getElementById('title-art').textContent =
` ___  ___  ___  __  __ ___  ___  ___ 
/ __|| _ \\|   \\|  \\/  || _ )/ _ \\|_ _|
\\__ \\|  _/| |) | |\\/| || _ \\ (_) || | 
|___/|_|  |___/|_|  |_||___/\\___/|___|
      2 0 4 8   [ 3 D   M A T R I X ]`;

document.getElementById('go-art').textContent =
`  ╔══════════════════════════════╗
  ║   MESSAGE UNDELIVERABLE      ║
  ║   550 MAILBOX NOT FOUND      ║
  ╚══════════════════════════════╝`;

// ── Screen Manager ────────────────────────────────────────────
const screens = {
  start:    document.getElementById('start-screen'),
  game:     document.getElementById('game-screen'),
  gameover: document.getElementById('gameover-screen'),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── High Score & Support ──────────────────────────────────────
let highScore = parseInt(localStorage.getItem('spambot_hs') || '0', 10);

document.getElementById('support-btn').addEventListener('click', () => window.open(DONATE_URL, "_blank"));
document.getElementById('gameover-support-btn').addEventListener('click', () => window.open(DONATE_URL, "_blank"));

// ── Web Audio Synthesizer ─────────────────────────────────────
const Audio = (() => {
  let ctx = null;
  let bgGain = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bgGain = ctx.createGain();
      bgGain.gain.value = 0.15;
      bgGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function beep(freq, dur, type = 'square', vol = 0.16, delay = 0) {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + dur + 0.01);
    } catch (e) {}
  }

  const sounds = {
    airmail:    () => { beep(780, 0.07, 'square', 0.14); beep(1040, 0.09, 'square', 0.12, 0.06); },
    land:       () => { beep(180, 0.1, 'sawtooth', 0.1); },
    lane:       () => { beep(520, 0.04, 'triangle', 0.12); },
    deadletter: () => { beep(440, 0.06, 'square', 0.18); beep(660, 0.07, 'square', 0.15, 0.05); beep(990, 0.1, 'square', 0.12, 0.1); },
    gameover:   () => { [400, 300, 220, 140].forEach((f, i) => beep(f, 0.2, 'sawtooth', 0.2, i * 0.14)); },
    dodge:      () => { beep(700, 0.05, 'square', 0.08); },
  };

  let bgInterval = null;
  const bgNotes = [110, 130.8, 146.8, 164.8, 196, 164.8, 146.8, 130.8];
  let bgIdx = 0;

  function tickBg() {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g);
      g.connect(bgGain);
      osc.type = 'sawtooth';
      osc.frequency.value = bgNotes[bgIdx % bgNotes.length];
      bgIdx++;
      g.gain.setValueAtTime(0.1, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
      osc.start();
      osc.stop(c.currentTime + 0.18);
    } catch (e) {}
  }

  return {
    play: (name) => { if (sounds[name]) sounds[name](); },
    startMusic: () => { getCtx(); clearInterval(bgInterval); bgInterval = setInterval(tickBg, 200); },
    stopMusic:  () => { clearInterval(bgInterval); bgInterval = null; },
  };
})();

// ── Canvas & 3D Projection Constants ──────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const LANE_WIDTH = 210;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
const SPAWN_Z = 2400;
const PLAYER_Z = 140;

class Camera3D {
  constructor(w, h) {
    this.resize(w, h);
    this.x = 0;
    this.y = 145;
    this.z = -240;
  }
  resize(w, h) {
    this.w = w;
    this.h = h;
    this.fov = Math.min(w, h) * 0.75;
    this.cx = w * 0.5;
    this.cy = h * 0.36; // Horizon line height
  }
  project(wx, wy, wz) {
    const dz = wz - this.z;
    if (dz <= 10) return null;
    const scale = this.fov / dz;
    return {
      x: this.cx + (wx - this.x) * scale,
      y: this.cy - (wy - this.y) * scale,
      scale: scale,
      dz: dz
    };
  }
}

// ── 3D Cuboid Helper ──────────────────────────────────────────
function drawCuboid(ctx, cam, cx, yBottom, cz, w, h, d, fillStyle, strokeStyle, glow = false) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const zFront = Math.max(cam.z + 15, cz - hd);
  const zBack  = cz + hd;
  if (zBack <= cam.z + 15) return null;

  const fBL = cam.project(cx - hw, yBottom, zFront);
  const fBR = cam.project(cx + hw, yBottom, zFront);
  const fTL = cam.project(cx - hw, yBottom + h, zFront);
  const fTR = cam.project(cx + hw, yBottom + h, zFront);

  const bBL = cam.project(cx - hw, yBottom, zBack);
  const bBR = cam.project(cx + hw, yBottom, zBack);
  const bTL = cam.project(cx - hw, yBottom + h, zBack);
  const bTR = cam.project(cx + hw, yBottom + h, zBack);

  if (!fBL || !bBL) return null;

  ctx.save();
  ctx.lineWidth = Math.max(1, Math.min(3, fBL.scale * 2.2));
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle;

  if (glow) {
    ctx.shadowColor = strokeStyle;
    ctx.shadowBlur = 12;
  }

  // Left Side Face (visible when object is to the right of camera)
  if (cx - hw > cam.x) {
    ctx.beginPath();
    ctx.moveTo(fBL.x, fBL.y);
    ctx.lineTo(bBL.x, bBL.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.lineTo(fTL.x, fTL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Right Side Face (visible when object is to the left of camera)
  if (cx + hw < cam.x) {
    ctx.beginPath();
    ctx.moveTo(fBR.x, fBR.y);
    ctx.lineTo(bBR.x, bBR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Top Face (visible when top is below camera eye level)
  if (yBottom + h < cam.y) {
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Bottom Face (visible when bottom is above camera eye level — e.g. high banners)
  if (yBottom > cam.y * 0.45) {
    ctx.beginPath();
    ctx.moveTo(fBL.x, fBL.y);
    ctx.lineTo(fBR.x, fBR.y);
    ctx.lineTo(bBR.x, bBR.y);
    ctx.lineTo(bBL.x, bBL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Front Face
  ctx.beginPath();
  ctx.moveTo(fBL.x, fBL.y);
  ctx.lineTo(fBR.x, fBR.y);
  ctx.lineTo(fTR.x, fTR.y);
  ctx.lineTo(fTL.x, fTL.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
  return { fBL, fBR, fTL, fTR, bTL, bTR };
}

// ── Input Manager (3-Lane + Actions) ──────────────────────────
const Input = (() => {
  const SWIPE_THRESHOLD = 45;
  const TAP_MAX_MOVE = 22;
  const TAP_MAX_MS = 250;

  let state = { up: false, down: false, left: false, right: false, action: false };
  let touchStartX = 0, touchStartY = 0, touchStartMs = 0, touchActive = false, swiped = false;

  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!game.running) return;
    if (e.repeat) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') state.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') state.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') state.right = true;
    if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Enter') {
      state.action = true;
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'KeyS' || e.code === 'ArrowDown') state.down = false;
  });

  // Touch Gestures
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartMs = Date.now();
    touchActive = true;
    swiped = false;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!touchActive) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (!swiped) {
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) state.left = true;
        else state.right = true;
        swiped = true;
      } else if (dy < -SWIPE_THRESHOLD) {
        state.up = true;
        swiped = true;
      } else if (dy > SWIPE_THRESHOLD) {
        state.down = true;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!touchActive) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const move = Math.max(Math.abs(dx), Math.abs(dy));
    const dur = Date.now() - touchStartMs;

    state.down = false;
    if (!swiped && move < TAP_MAX_MOVE && dur < TAP_MAX_MS) {
      state.action = true;
    }
    touchActive = false;
  }, { passive: false });

  // Mobile On-Screen Buttons
  const bindBtn = (id, key, hold = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); state[key] = true; }, { passive: false });
    if (hold) {
      el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); state[key] = false; }, { passive: false });
    }
  };
  bindBtn('ctrl-left', 'left');
  bindBtn('ctrl-right', 'right');
  bindBtn('ctrl-air', 'up');
  bindBtn('ctrl-dead', 'action');
  bindBtn('ctrl-snail', 'down', true);

  return {
    get: () => state,
    tick: () => {
      state.up = false;
      state.left = false;
      state.right = false;
      state.action = false;
    },
    reset: () => {
      state = { up: false, down: false, left: false, right: false, action: false };
    }
  };
})();

// ── 3D Cyber-Corridor World ───────────────────────────────────
class World3D {
  constructor() {
    this.scrollZ = 0;
    this.props = [];
    const labels = ['[SERVER]', '|SMTP|', '<<DATACENTER>>', '[INBOX/]', '[SPAM/]', '[TRASH/]', '[FIREWALL]'];
    for (let z = 150; z <= SPAWN_Z; z += 250) {
      this.props.push({
        z: z,
        side: -1,
        h: 160 + (z % 190),
        label: labels[(z / 250 | 0) % labels.length]
      });
      this.props.push({
        z: z,
        side: 1,
        h: 160 + ((z + 90) % 190),
        label: labels[((z / 250 | 0) + 3) % labels.length]
      });
    }
  }

  update(speed) {
    this.scrollZ = (this.scrollZ + speed) % 150;
    for (const p of this.props) {
      p.z -= speed;
      if (p.z < 20) {
        p.z += SPAWN_Z;
      }
    }
  }

  draw(ctx, cam) {
    // Background Sky & Floor Gradients
    ctx.fillStyle = '#000301';
    ctx.fillRect(0, 0, cam.w, cam.h);

    const floorGrad = ctx.createLinearGradient(0, cam.cy, 0, cam.h);
    floorGrad.addColorStop(0, 'rgba(0, 50, 20, 0.35)');
    floorGrad.addColorStop(1, 'rgba(0, 10, 4, 0.95)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, cam.cy, cam.w, cam.h - cam.cy);

    // Horizon Glow Line
    ctx.save();
    ctx.strokeStyle = '#00e664';
    ctx.shadowColor = '#00e664';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cam.cy);
    ctx.lineTo(cam.w, cam.cy);
    ctx.stroke();
    ctx.restore();

    // Longitudinal Lane & Track Lines
    const railX = [-LANE_WIDTH * 1.5, -LANE_WIDTH * 0.5, LANE_WIDTH * 0.5, LANE_WIDTH * 1.5];
    railX.forEach((x, idx) => {
      const pNear = cam.project(x, 0, 10);
      const pFar  = cam.project(x, 0, SPAWN_Z);
      if (pNear && pFar) {
        ctx.strokeStyle = (idx === 0 || idx === 3) ? '#00e664' : 'rgba(0, 230, 100, 0.38)';
        ctx.lineWidth   = (idx === 0 || idx === 3) ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.moveTo(pNear.x, pNear.y);
        ctx.lineTo(pFar.x, pFar.y);
        ctx.stroke();
      }
    });

    // Transverse Scrolling Grid Lines
    for (let z = 150 - this.scrollZ; z < SPAWN_Z; z += 150) {
      if (z < 15) continue;
      const pL = cam.project(-LANE_WIDTH * 1.5, 0, z);
      const pR = cam.project(LANE_WIDTH * 1.5, 0, z);
      if (pL && pR) {
        const alpha = Math.max(0.05, 1 - z / SPAWN_Z) * 0.45;
        ctx.strokeStyle = `rgba(0, 230, 100, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(pR.x, pR.y);
        ctx.stroke();
      }
    }

    // Side Server Monoliths (Sorted back-to-front)
    const sortedProps = [...this.props].sort((a, b) => b.z - a.z);
    for (const p of sortedProps) {
      if (p.z < 30) continue;
      const wx = p.side * (LANE_WIDTH * 1.95);
      const fade = Math.max(0.08, 1 - p.z / SPAWN_Z);
      const stroke = `rgba(0, 190, 90, ${fade * 0.55})`;
      const fill   = `rgba(0, 20, 8, ${fade * 0.75})`;

      const faces = drawCuboid(ctx, cam, wx, 0, p.z, 90, p.h, 90, fill, stroke, false);
      if (faces && p.z < 1500) {
        const fontSize = Math.max(8, Math.round(16 * faces.fTL.scale));
        ctx.font = `${fontSize}px "Courier New", monospace`;
        ctx.fillStyle = `rgba(0, 230, 100, ${fade * 0.75})`;
        ctx.textAlign = 'center';
        ctx.fillText(p.label, (faces.fTL.x + faces.fTR.x) * 0.5, faces.fTL.y - 6);
      }
    }
  }
}

// ── 3D Player Avatar ──────────────────────────────────────────
class Player3D {
  constructor() {
    this.emailLabel = 'you@domain.com';
    this.reset();
  }

  reset() {
    this.lane = 1; // 0: Left, 1: Center, 2: Right
    this.x = LANES[1];
    this.y = 0;
    this.z = PLAYER_Z;
    this.velY = 0;
    this.jumpForce = 16.5;
    this.gravity = 0.82;
    this.onGround = true;
    this.isPhasing = false;
    this.phaseTimer = 0;
    this.phaseDur = 1000;
    this.deadLetterReady = true;
    this.mode = 'NORMAL';
    this.tilt = 0;
  }

  update(input, deltaMs) {
    // Lane Switching
    if (input.left && this.lane > 0) {
      this.lane--;
      this.tilt = -0.25;
      Audio.play('lane');
    }
    if (input.right && this.lane < 2) {
      this.lane++;
      this.tilt = 0.25;
      Audio.play('lane');
    }

    // Smooth Horizontal Interpolation
    const targetX = LANES[this.lane];
    this.x += (targetX - this.x) * 0.24;
    this.tilt *= 0.85;

    // Jump (Air Mail)
    if (input.up && this.onGround) {
      this.velY = this.jumpForce;
      this.onGround = false;
      Audio.play('airmail');
    }

    // Phase (Dead Letter)
    if (input.action && this.deadLetterReady && !this.isPhasing) {
      this.isPhasing = true;
      this.phaseTimer = this.phaseDur;
      this.deadLetterReady = false;
      Audio.play('deadletter');
    }

    // Vertical Physics
    if (!this.onGround) {
      this.y += this.velY;
      this.velY -= this.gravity;
      if (this.y <= 0) {
        this.y = 0;
        this.velY = 0;
        this.onGround = true;
        this.deadLetterReady = true; // Recharges on landing or cooldown
        Audio.play('land');
      }
    }

    // Phase Timer & Cooldown Recharge
    if (this.isPhasing) {
      this.phaseTimer -= deltaMs;
      if (this.phaseTimer <= 0) {
        this.isPhasing = false;
        this.phaseTimer = 0;
        // Recharge Dead Letter after 2.8 seconds even if you don't jump
        setTimeout(() => { this.deadLetterReady = true; }, 2800);
      }
    }

    // State Mode
    if      (this.isPhasing) this.mode = 'DEADLETTER';
    else if (!this.onGround) this.mode = 'AIRMAIL';
    else if (input.down)     this.mode = 'SNAILMAIL';
    else                     this.mode = 'NORMAL';
  }

  getDims() {
    const isCrawl = this.mode === 'SNAILMAIL';
    return {
      w: 115,
      h: isCrawl ? 32 : 68,
      d: 55
    };
  }

  draw(ctx, cam) {
    const dims = this.getDims();

    // Ground Shadow under Player
    const shL = cam.project(this.x - dims.w * 0.45, 0, this.z - 20);
    const shR = cam.project(this.x + dims.w * 0.45, 0, this.z + 20);
    if (shL && shR) {
      ctx.fillStyle = 'rgba(0, 230, 100, 0.22)';
      ctx.fillRect(shL.x, shL.y - 4, shR.x - shL.x, 8);
    }

    let stroke = '#00e664';
    let fill   = 'rgba(0, 45, 20, 0.88)';
    if (this.mode === 'DEADLETTER') {
      const pulse = 0.45 + 0.45 * Math.sin(Date.now() / 60);
      stroke = '#00ffff';
      fill   = `rgba(0, 255, 255, ${pulse * 0.35})`;
    } else if (this.mode === 'SNAILMAIL') {
      stroke = '#ffff00';
      fill   = 'rgba(60, 60, 0, 0.88)';
    }

    const faces = drawCuboid(ctx, cam, this.x, this.y, this.z, dims.w, dims.h, dims.d, fill, stroke, true);
    if (!faces) return;

    // Draw Envelope Flap Lines on Front Face
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    const midX = (faces.fTL.x + faces.fTR.x) * 0.5;
    const midY = (faces.fTL.y + faces.fBL.y) * 0.54;
    ctx.beginPath();
    ctx.moveTo(faces.fTL.x, faces.fTL.y);
    ctx.lineTo(midX, midY);
    ctx.lineTo(faces.fTR.x, faces.fTR.y);
    ctx.stroke();

    // Render Player's Email Address Label
    const fontSize = Math.max(11, Math.round(16 * faces.fBL.scale));
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 8;
    const shortEmail = this.emailLabel.length > 20 ? this.emailLabel.slice(0, 18) + '..' : this.emailLabel;
    ctx.fillText(shortEmail, midX, (faces.fBL.y + faces.fTL.y) * 0.5 + 5);

    // Floating Mode Tag above Player
    if (this.mode !== 'NORMAL') {
      const modeTag = {
        AIRMAIL: '^ AIR MAIL ^',
        SNAILMAIL: '~ SNAIL MAIL ~',
        DEADLETTER: '* DEAD LETTER *'
      }[this.mode];
      ctx.font = `bold ${Math.round(fontSize * 0.9)}px "Courier New", monospace`;
      ctx.fillStyle = stroke;
      ctx.fillText(modeTag, midX, faces.fTL.y - 14);
    }
    ctx.restore();
  }
}

// ── 3D Obstacles & Particle System ────────────────────────────
const OBSTACLE_TYPES = [
  { id: 'NIGERIAN',   label: ['|_!!!_|', '|SPAM!|', '|_____|'], hint: 'JUMP / DODGE', yBottom: 0,  h: 88, w: 155, d: 70 },
  { id: 'PHISHING',   label: ['~PHISH~', '<a href>'],           hint: 'JUMP / DODGE', yBottom: 0,  h: 72, w: 155, d: 70 },
  { id: 'NEWSLETTER', label: ['=====', 'UNSUB?', '====='],      hint: 'JUMP / DODGE', yBottom: 0,  h: 75, w: 155, d: 70 },
  { id: 'LOWHEADER',  label: ['--[MAILER-DAEMON]--'],           hint: 'CRAWL UNDER',  yBottom: 46, h: 75, w: 170, d: 70 },
  { id: 'LOWBANNER',  label: ['~~YOU HAVE WON~~'],              hint: 'CRAWL UNDER',  yBottom: 46, h: 75, w: 170, d: 70 },
];

class ObstacleManager3D {
  constructor() {
    this.reset();
  }

  reset() {
    this.obstacles = [];
    this.particles = [];
    this.frame = 0;
    this.speed = 15;
    this.lastSpawn = 0;
    this.nextSpawn = 950;
  }

  spawnWave() {
    // Spawn 1 or 2 obstacles across the 3 lanes so there's always a tactical route
    const count = Math.random() < 0.42 ? 2 : 1;
    const availableLanes = [0, 1, 2].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const lane = availableLanes[i];
      const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      this.obstacles.push({
        type,
        lane,
        x: LANES[lane],
        y: type.yBottom,
        z: SPAWN_Z,
        w: type.w,
        h: type.h,
        d: type.d,
        dissolving: false,
        alpha: 1,
        passed: false
      });
    }
  }

  explode(obs) {
    obs.dissolving = true;
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x: obs.x + (Math.random() - 0.5) * obs.w,
        y: obs.y + Math.random() * obs.h,
        z: obs.z,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.2) * 10,
        vz: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }
  }

  update(elapsed, speedMult = 1) {
    this.frame++;
    this.speed = (15 + this.frame * 0.004) * speedMult;

    if (elapsed - this.lastSpawn >= this.nextSpawn) {
      this.spawnWave();
      this.lastSpawn = elapsed;
      this.nextSpawn = Math.max(480, 1050 - this.frame * 0.08) + Math.random() * 450;
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.z -= this.speed;
      if (o.dissolving) {
        o.alpha -= 0.12;
        if (o.alpha <= 0) {
          this.obstacles.splice(i, 1);
          continue;
        }
      }
      if (o.z < -120) {
        this.obstacles.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz - this.speed * 0.5;
      p.alpha -= 0.04;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
  }

  drawSingleObstacle(ctx, cam, o) {
    const distFade = Math.min(1, Math.max(0.15, 1 - (o.z / SPAWN_Z) * 0.75)) * o.alpha;
    const isBanner = o.y > 0;

    const stroke = o.dissolving
      ? `rgba(0, 255, 255, ${distFade})`
      : (isBanner ? `rgba(255, 180, 0, ${distFade})` : `rgba(255, 50, 50, ${distFade})`);

    const fill = o.dissolving
      ? `rgba(0, 120, 120, ${distFade * 0.5})`
      : (isBanner ? `rgba(55, 30, 0, ${distFade * 0.88})` : `rgba(55, 5, 5, ${distFade * 0.88})`);

    // Ground shadow for elevated banners
    if (isBanner) {
      const sL = cam.project(o.x - o.w * 0.5, 0, o.z);
      const sR = cam.project(o.x + o.w * 0.5, 0, o.z);
      if (sL && sR) {
        ctx.strokeStyle = `rgba(255, 180, 0, ${distFade * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sL.x, sL.y);
        ctx.lineTo(sR.x, sR.y);
        ctx.stroke();
      }
    }

    const faces = drawCuboid(ctx, cam, o.x, o.y, o.z, o.w, o.h, o.d, fill, stroke, o.z < 900);
    if (!faces) return;

    // ASCII Label & Action Hint on Front Face
    const scale = faces.fBL.scale;
    const centerX = (faces.fBL.x + faces.fBR.x) * 0.5;
    const centerY = (faces.fTL.y + faces.fBL.y) * 0.5;
    const fontSize = Math.max(7, Math.round(22 * scale));

    if (fontSize >= 8) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.fillStyle = o.dissolving ? '#00ffff' : (isBanner ? '#ffcc00' : '#ff4444');

      const lines = o.type.label;
      const lineH = fontSize * 1.15;
      const startY = centerY - ((lines.length - 1) * lineH) * 0.5 + fontSize * 0.3;

      lines.forEach((line, idx) => {
        ctx.fillText(line, centerX, startY + idx * lineH);
      });

      // Hint above box
      const hintSize = Math.max(7, Math.round(14 * scale));
      ctx.font = `${hintSize}px "Courier New", monospace`;
      ctx.fillStyle = `rgba(255, 255, 0, ${distFade * 0.85})`;
      ctx.fillText(o.type.hint, centerX, faces.fTL.y - Math.max(4, 8 * scale));
      ctx.restore();
    }
  }

  drawParticles(ctx, cam) {
    for (const p of this.particles) {
      const proj = cam.project(p.x, p.y, p.z);
      if (!proj) continue;
      const sz = Math.max(2, 10 * proj.scale);
      ctx.fillStyle = `rgba(0, 255, 255, ${p.alpha})`;
      ctx.fillRect(proj.x - sz * 0.5, proj.y - sz * 0.5, sz, sz);
    }
  }
}

// ── Flash Effect ──────────────────────────────────────────────
const flashEl = document.getElementById('flash-overlay');
let flashAlpha = 0, flashColor = 'rgba(0,255,255,';

function triggerFlash(type) {
  flashColor = type === 'PHASE' ? 'rgba(0,255,255,' : 'rgba(255,40,40,';
  flashAlpha = 0.5;
  flashEl.style.background = flashColor + flashAlpha + ')';
  flashEl.style.opacity = '1';
  decayFlash();
}

function decayFlash() {
  if (flashAlpha <= 0) {
    flashEl.style.opacity = '0';
    return;
  }
  flashAlpha = Math.max(0, flashAlpha - 0.04);
  flashEl.style.background = flashColor + flashAlpha + ')';
  requestAnimationFrame(decayFlash);
}

// ── Main 3D Game Controller ───────────────────────────────────
const game = (() => {
  let cam, world, player, obsMgr;
  let rafId = null;
  let lastTime = 0, elapsed = 0;
  let score = 0, frameCount = 0;
  let milestoneText = '', milestoneAlpha = 0;
  let running = false;

  const MILESTONES = {
    500:  'Entering Deep Inbox Sector...',
    1200: 'UNSUBSCRIBE Protocol Failed.',
    2500: 'Firewall Integrity Critical!',
    5000: 'Approaching the Core Spambot!'
  };
  const firedMs = new Set();

  function checkMilestones(s) {
    for (const [m, msg] of Object.entries(MILESTONES)) {
      if (s >= Number(m) && !firedMs.has(m)) {
        firedMs.add(m);
        milestoneText = msg;
        milestoneAlpha = 255;
      }
    }
  }

  function start(email) {
    cam    = new Camera3D(canvas.width, canvas.height);
    world  = new World3D();
    player = new Player3D();
    obsMgr = new ObstacleManager3D();

    player.emailLabel = email;
    score = 0;
    frameCount = 0;
    firedMs.clear();
    milestoneText = '';
    milestoneAlpha = 0;
    lastTime = 0;
    elapsed = 0;
    running = true;

    Input.reset();
    Audio.startMusic();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function checkCollisions() {
    const pDims = player.getDims();
    const pMinX = player.x - pDims.w * 0.42;
    const pMaxX = player.x + pDims.w * 0.42;
    const pMinY = player.y;
    const pMaxY = player.y + pDims.h;
    const pMinZ = player.z - pDims.d * 0.45;
    const pMaxZ = player.z + pDims.d * 0.45;

    for (const o of obsMgr.obstacles) {
      if (o.dissolving) continue;

      const oMinX = o.x - o.w * 0.45;
      const oMaxX = o.x + o.w * 0.45;
      const oMinY = o.y;
      const oMaxY = o.y + o.h;
      const oMinZ = o.z - o.d * 0.5;
      const oMaxZ = o.z + o.d * 0.5;

      const overlapX = pMinX < oMaxX && pMaxX > oMinX;
      const overlapY = pMinY < oMaxY && pMaxY > oMinY;
      const overlapZ = pMinZ < oMaxZ && pMaxZ > oMinZ;

      if (overlapX && overlapY && overlapZ) {
        if (player.isPhasing) {
          obsMgr.explode(o);
          score += 100;
          checkMilestones(score);
          triggerFlash('PHASE');
        } else {
          // Collision — Game Over
          running = false;
          triggerFlash('HIT');
          Audio.play('gameover');
          Audio.stopMusic();

          if (score > highScore) {
            highScore = score;
            localStorage.setItem('spambot_hs', highScore);
          }

          setTimeout(() => {
            document.getElementById('final-score-display').textContent = 'Score: ' + score;
            document.getElementById('high-score-note').textContent =
              score >= highScore ? '★ NEW HIGH SCORE!' : 'Best: ' + highScore;
            showScreen('gameover');
          }, 650);
          return;
        }
      } else if (!o.passed && oMaxZ < pMinZ) {
        o.passed = true;
        score += 50;
        checkMilestones(score);
        Audio.play('dodge');
      }
    }
  }

  function loop(ts) {
    if (!running) return;
    const delta = lastTime ? Math.min(ts - lastTime, 48) : 16;
    lastTime = ts;
    elapsed += delta;
    frameCount++;

    if (frameCount % 6 === 0) {
      score += 1;
      checkMilestones(score);
    }

    const input = Input.get();
    player.update(input, delta);
    Input.tick();

    // Subtle Camera Follow
    cam.x += (player.x * 0.38 - cam.x) * 0.14;
    cam.y += ((145 + player.y * 0.25) - cam.y) * 0.14;

    const speedMult = player.mode === 'AIRMAIL' ? 1.35 : 1;
    obsMgr.update(elapsed, speedMult);
    world.update(obsMgr.speed);

    checkCollisions();

    // ── Render Scene (Painter's Algorithm Back-to-Front) ──────
    world.draw(ctx, cam);

    const sortedObs = [...obsMgr.obstacles].sort((a, b) => b.z - a.z);
    let playerDrawn = false;

    for (const o of sortedObs) {
      if (!playerDrawn && o.z < player.z) {
        player.draw(ctx, cam);
        playerDrawn = true;
      }
      obsMgr.drawSingleObstacle(ctx, cam, o);
    }
    if (!playerDrawn) {
      player.draw(ctx, cam);
    }

    obsMgr.drawParticles(ctx, cam);
    drawHUD(ctx);

    if (milestoneAlpha > 0) {
      drawMilestone(ctx);
      milestoneAlpha = Math.max(0, milestoneAlpha - 2.5);
    }

    rafId = requestAnimationFrame(loop);
  }

  function drawHUD(ctx) {
    ctx.save();
    // Score & High Score
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = '#00e664';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, 24, 44);

    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0, 230, 100, 0.55)';
    ctx.fillText('BEST:  ' + highScore, 24, 68);

    // Active Mode Indicator (Top Center)
    const modeLabel = {
      AIRMAIL: '^ AIR MAIL (JUMP) ^',
      SNAILMAIL: '~ SNAIL MAIL (CRAWL) ~',
      DEADLETTER: '* DEAD LETTER (PHASE) *',
      NORMAL: 'LANE ' + (player.lane + 1) + ' // ONLINE'
    }[player.mode];

    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = player.mode === 'NORMAL' ? 'rgba(0, 230, 100, 0.6)' : '#ffff00';
    ctx.textAlign = 'center';
    ctx.fillText(modeLabel, canvas.width * 0.5, 44);

    // Dead Letter Phase Status (Top Right)
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'right';
    const dlText = player.isPhasing
      ? '[PHASING...]'
      : (player.deadLetterReady ? '[SHIFT / E] PHASE READY' : '[PHASE RECHARGING...]');
    ctx.fillStyle = player.deadLetterReady ? '#00ffff' : 'rgba(0, 230, 100, 0.4)';
    ctx.fillText(dlText, canvas.width - 24, 44);
    ctx.restore();
  }

  function drawMilestone(ctx) {
    ctx.save();
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = `rgba(0, 255, 255, ${milestoneAlpha / 255})`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillText(milestoneText, canvas.width * 0.5, canvas.height * 0.24);
    ctx.restore();
  }

  function onResize() {
    if (cam) cam.resize(canvas.width, canvas.height);
  }

  return {
    start,
    onResize,
    get running() { return running; }
  };
})();

// ── Window Resize & Button Wiring ─────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  if (game.running) game.onResize();
}
window.addEventListener('resize', resize);
resize();

function startGame() {
  const raw = document.getElementById('email-input').value.trim();
  const email = raw || 'you@domain.com';
  showScreen('game');
  resize();
  game.start(email);
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('email-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') startGame();
});
document.getElementById('retry-btn').addEventListener('click', () => {
  showScreen('start');
});