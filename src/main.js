const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const BORDER = 4;
const CROSS_SCORE = 8;

let player = createPlayer(0, 0);
let emitters = [];
let bullets = [];
let missiles = [];
let dots = [];
let cross = null;
let score = 0;
let playerPlaced = false;
let lost = false;
let lastTime = performance.now();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!playerPlaced) {
    centerPlayer(player, w, h);
    emitters = createEmitters(w, h);
    dots = createDots(emitters);
    playerPlaced = true;
  } else {
    containDots(dots, w, h);
  }
}

function drawBackground(w, h) {
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const step = 48;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawBorder(w, h) {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = BORDER;
  ctx.strokeRect(BORDER / 2, BORDER / 2, w - BORDER, h - BORDER);
  ctx.restore();
}

const SCORE_LINES = [
  [1, "TRY HARDER"],
  [3, "NOT BAD"],
  [6, "GETTING THERE"],
  [10, "DECENT"],
  [14, "NICE PLAY"],
  [19, "IMPRESSIVE"],
  [24, "BRILLIANT"],
  [29, "GODLIKE"],
  [Infinity, "IMPOSSIBLE"],
];

function scoreLine(value) {
  for (const [max, line] of SCORE_LINES) {
    if (value <= max) return line;
  }
}

function drawLose(w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, w, h);
  drawArcadeText(ctx, scoreLine(score), w * 0.5, h * 0.5 - 144, 40, "#d8ffe4", "center", "middle");
  drawArcadeText(ctx, String(score), w * 0.5, h * 0.5 + 8, 96, "#f4fff6", "center", "middle");
  drawArcadeText(ctx, "PRESS ENTER TO RESTART", w * 0.5, h * 0.5 + 128, 20, "#d8ffe4", "center", "middle");
  ctx.restore();
}

function restart() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  player = createPlayer(w * 0.5, h * 0.5);
  emitters = createEmitters(w, h);
  bullets = [];
  missiles = [];
  dots = createDots(emitters);
  clearPops();
  clearMissileSmoke();
  score = 0;
  cross = null;
  lost = false;
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const w = window.innerWidth;
  const h = window.innerHeight;

  if (lost) {
    if (consumeEnter()) restart();
  } else {
    const input = getMoveAxis();
    const fromX = player.x;
    const fromY = player.y;
    updatePlayer(player, input, dt);
    bouncePlayer(player, w, h, BORDER);
    updateShield(player, isShieldHeld(), dt);
    const crossHit = updateCross(cross, player, fromX, fromY, w, h, dt);
    const emitterHit = updateEmitters(emitters, bullets, player, w, h, dt);
    const eaten = collectDots(dots, player, w, h);
    hastenEmitters(emitters, score, eaten);
    const dotsBefore = score;
    score += eaten;
    spawnMissilesForDots(missiles, player, w, h, dotsBefore, score);
    if (!cross && score >= CROSS_SCORE) {
      cross = createCross(player, w, h);
    }
    const missileHit = updateMissiles(missiles, player, fromX, fromY, w, h, dt);
    if (crossHit || emitterHit || missileHit || updateBullets(bullets, player, w, h, dt)) {
      lost = true;
      clearEnter();
    }
  }

  updatePops(dt, dots);

  drawBackground(w, h);
  drawDots(ctx, dots);
  drawEmitters(ctx, emitters);
  drawCross(ctx, cross);
  drawBullets(ctx, bullets);
  drawMissiles(ctx, missiles);
  drawPlayer(ctx, player);
  drawPops(ctx);
  drawBorder(w, h);
  if (lost) drawLose(w, h);
  drawScore(ctx, score);

  requestAnimationFrame(frame);
}

initInput();
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(frame);