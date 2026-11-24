/** Mario 3–ish: quick acceleration, capped speed, coast when idle. */
const PLAYER_RADIUS = 10;
const ACCEL = 1000;
const MAX_SPEED = 5720;
const COAST_FRICTION = 5;
const DRAG = 2;

const SHIELD_DRAIN = 1;
const SHIELD_RECHARGE = 0.13;
const SHIELD_RADIUS = 26;
const SHIELD_MIN_USE = 0.1;
const SHIELD_MIN_DURATION = 0.2;

function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    shieldEnergy: 1,
    shieldActive: false,
    shieldMinLeft: 0,
  };
}

function updateShield(player, shieldHeld, dt) {
  const canUse = player.shieldEnergy >= SHIELD_MIN_USE;

  if (player.shieldActive) {
    player.shieldMinLeft = Math.max(0, player.shieldMinLeft - dt);
    player.shieldEnergy -= SHIELD_DRAIN * dt;
    if (player.shieldEnergy <= 0) {
      player.shieldEnergy = 0;
      player.shieldActive = false;
      player.shieldMinLeft = 0;
    } else if (!shieldHeld && player.shieldMinLeft <= 0) {
      player.shieldActive = false;
    }
    return;
  }

  if (shieldHeld && canUse) {
    player.shieldActive = true;
    player.shieldMinLeft = SHIELD_MIN_DURATION;
    return;
  }

  if (player.shieldEnergy < 1) {
    player.shieldEnergy += SHIELD_RECHARGE * dt;
    if (player.shieldEnergy > 1) player.shieldEnergy = 1;
  }
}

/**
 * @param {ReturnType<typeof createPlayer>} player
 * @param {{ x: number, y: number, active: boolean }} input
 * @param {number} dt seconds
 */
function updatePlayer(player, input, dt) {
  if (input.active) {
    player.vx += input.x * ACCEL * dt;
    player.vy += input.y * ACCEL * dt;
  } else {
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 0) {
      const friction = Math.min(COAST_FRICTION * dt, speed);
      const scale = (speed - friction) / speed;
      player.vx *= scale;
      player.vy *= scale;
    }

    // Only while coasting. During thrust this cancels ACCEL at
    // speed = ACCEL / DRAG and the MAX_SPEED clamp never matters.
    const drag = Math.max(0, 1 - DRAG * dt);
    player.vx *= drag;
    player.vy *= drag;
  }

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > MAX_SPEED) {
    const s = MAX_SPEED / speed;
    player.vx *= s;
    player.vy *= s;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
}

function bouncePlayer(player, width, height, border) {
  const minX = border + player.radius;
  const maxX = width - border - player.radius;
  const minY = border + player.radius;
  const maxY = height - border - player.radius;
  let hit = false;

  if (player.x < minX) {
    player.x = minX;
    player.vx = -player.vx;
    hit = true;
  } else if (player.x > maxX) {
    player.x = maxX;
    player.vx = -player.vx;
    hit = true;
  }

  if (player.y < minY) {
    player.y = minY;
    player.vy = -player.vy;
    hit = true;
  } else if (player.y > maxY) {
    player.y = maxY;
    player.vy = -player.vy;
    hit = true;
  }

  if (hit) {
    player.vx *= 0.5;
    player.vy *= 0.5;
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof createPlayer>} player
 */
function drawShield(ctx, player) {
  if (!player.shieldActive) return;

  const { x, y, shieldEnergy } = player;
  const r = SHIELD_RADIUS;
  const alpha = 0.25 + shieldEnergy * 0.35;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(140, 220, 255, ${alpha * 0.35})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(180, 240, 255, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(100, 200, 255, 0.6)";
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx, player) {
  const { x, y, radius } = player;

  drawShield(ctx, player);

  ctx.save();
  ctx.shadowColor = "rgba(120, 200, 255, 0.55)";
  ctx.shadowBlur = 16;

  const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, radius);
  grad.addColorStop(0, "#b8f0ff");
  grad.addColorStop(0.45, "#3aa8e8");
  grad.addColorStop(1, "#1a4a7a");

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function shieldHitRadius() {
  return SHIELD_RADIUS;
}

function centerPlayer(player, width, height) {
  player.x = width * 0.5;
  player.y = height * 0.5;
  player.vx = 0;
  player.vy = 0;
}

const DEATH_BURST_DURATION = 1.45;

let deathBurst = null;
let deathSmokeSprite = null;

function deathSmokeSpriteCanvas() {
  if (deathSmokeSprite) return deathSmokeSprite;
  const r = 32;
  const bake = document.createElement("canvas");
  bake.width = r * 2;
  bake.height = r * 2;
  const bctx = bake.getContext("2d");
  const grad = bctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(72, 70, 78, 0.92)");
  grad.addColorStop(0.42, "rgba(48, 46, 54, 0.5)");
  grad.addColorStop(1, "rgba(28, 28, 36, 0)");
  bctx.fillStyle = grad;
  bctx.beginPath();
  bctx.arc(r, r, r, 0, Math.PI * 2);
  bctx.fill();
  deathSmokeSprite = bake;
  return deathSmokeSprite;
}

function spawnPlayerDeathBurst(player) {
  const biasVx = player.vx * 0.35;
  const biasVy = player.vy * 0.35;
  const bits = [];

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 90 + Math.random() * 180;
    bits.push({
      kind: "chunk",
      ox: 0,
      oy: 0,
      vx: Math.cos(angle) * speed + biasVx,
      vy: Math.sin(angle) * speed + biasVy,
      size: 2 + Math.random() * 5,
      spin: (Math.random() - 0.5) * 14,
      rot: Math.random() * Math.PI * 2,
    });
  }

  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 220 + Math.random() * 420;
    bits.push({
      kind: "spark",
      ox: 0,
      oy: 0,
      vx: Math.cos(angle) * speed + biasVx * 1.2,
      vy: Math.sin(angle) * speed + biasVy * 1.2,
      size: 0.8 + Math.random() * 1.6,
      life: 0.22 + Math.random() * 0.28,
      age: 0,
    });
  }

  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 95;
    bits.push({
      kind: "ember",
      ox: 0,
      oy: 0,
      vx: Math.cos(angle) * speed + biasVx * 0.5,
      vy: Math.sin(angle) * speed + biasVy * 0.5 - 40,
      size: 1.2 + Math.random() * 2.4,
    });
  }

  const smoke = [];
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * player.radius * 1.2;
    smoke.push({
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
      age: i * 0.018,
      life: 0.85 + Math.random() * 0.75,
      radius0: 6 + Math.random() * 10,
      radius1: 34 + Math.random() * 38,
      vx: (Math.random() - 0.5) * 55 + biasVx * 0.25,
      vy: -28 - Math.random() * 42 + biasVy * 0.2,
      peak: 0.45 + Math.random() * 0.35,
    });
  }

  deathBurst = { x: player.x, y: player.y, radius: player.radius, age: 0, bits, smoke };
}

function clearPlayerDeathBurst() {
  deathBurst = null;
}

function updatePlayerDeathBurst(dt) {
  if (!deathBurst) return;
  deathBurst.age += dt;

  const chunkDrag = Math.max(0, 1 - dt * 3.2);
  const emberDrag = Math.max(0, 1 - dt * 2.4);
  const sparkDrag = Math.max(0, 1 - dt * 7.5);
  const smokeDrag = Math.max(0, 1 - dt * 1.1);

  const mainDone = deathBurst.age >= DEATH_BURST_DURATION;

  for (const bit of deathBurst.bits) {
    if (mainDone) continue;
    bit.ox += bit.vx * dt;
    bit.oy += bit.vy * dt;
    if (bit.kind === "spark") {
      bit.age += dt;
      bit.vx *= sparkDrag;
      bit.vy *= sparkDrag;
      bit.vy += 420 * dt;
    } else if (bit.kind === "ember") {
      bit.vx *= emberDrag;
      bit.vy *= emberDrag;
      bit.vy -= 55 * dt;
    } else {
      bit.rot += bit.spin * dt;
      bit.vx *= chunkDrag;
      bit.vy *= chunkDrag;
      bit.vy += 180 * dt;
    }
  }

  let smokeWrite = 0;
  const smoke = deathBurst.smoke;
  for (let i = 0; i < smoke.length; i++) {
    const puff = smoke[i];
    puff.age += dt;
    if (puff.age >= puff.life) continue;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vx *= smokeDrag;
    puff.vy *= smokeDrag;
    puff.vy -= 18 * dt;
    smoke[smokeWrite++] = puff;
  }
  smoke.length = smokeWrite;

  if (deathBurst.age >= DEATH_BURST_DURATION && smoke.length === 0) deathBurst = null;
}

function drawPlayerDeathBurst(ctx) {
  if (!deathBurst) return;

  const { x, y, radius, age, bits, smoke } = deathBurst;
  const t = Math.min(1, age / DEATH_BURST_DURATION);
  const expand = 1 - Math.pow(1 - Math.min(1, age / 0.42), 3.2);
  const coreFade = Math.max(0, 1 - age / 0.55);
  const tailFade = Math.max(0, 1 - t * t * 0.85);

  ctx.save();

  const smokeSprite = deathSmokeSpriteCanvas();
  for (const puff of smoke) {
    const st = puff.age / puff.life;
    const fade = (1 - st) * (1 - st * 0.12);
    const alpha = puff.peak * fade;
    if (alpha < 0.02) continue;
    const r = puff.radius0 + (puff.radius1 - puff.radius0) * Math.sqrt(st);
    ctx.globalAlpha = alpha;
    ctx.drawImage(smokeSprite, puff.x - r, puff.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = "lighter";

  const flashAge = age / 0.07;
  if (flashAge < 1) {
    const flashA = 1 - flashAge;
    const flashR = radius * (2.2 + flashAge * 3.5);
    const flash = ctx.createRadialGradient(x, y, 0, x, y, flashR);
    flash.addColorStop(0, `rgba(255, 255, 255, ${flashA})`);
    flash.addColorStop(0.35, `rgba(255, 240, 180, ${flashA * 0.75})`);
    flash.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.beginPath();
    ctx.arc(x, y, flashR, 0, Math.PI * 2);
    ctx.fillStyle = flash;
    ctx.fill();
  }

  if (coreFade > 0.02) {
    const fireR = radius * (1.4 + expand * 7.2);
    const fire = ctx.createRadialGradient(x, y, 0, x, y, fireR);
    fire.addColorStop(0, `rgba(255, 248, 220, ${coreFade * 0.95})`);
    fire.addColorStop(0.18, `rgba(255, 175, 55, ${coreFade * 0.88})`);
    fire.addColorStop(0.42, `rgba(255, 85, 35, ${coreFade * 0.62})`);
    fire.addColorStop(0.75, `rgba(255, 50, 25, ${coreFade * 0.18})`);
    fire.addColorStop(1, "rgba(120, 40, 20, 0)");
    ctx.beginPath();
    ctx.arc(x, y, fireR, 0, Math.PI * 2);
    ctx.fillStyle = fire;
    ctx.fill();
  }

  const shockT = age / 0.38;
  if (shockT < 1) {
    const shockExpand = 1 - Math.pow(1 - shockT, 2.8);
    const shockR = radius * (1.5 + shockExpand * 9.5);
    const shockA = (1 - shockT) * 0.85;
    ctx.beginPath();
    ctx.arc(x, y, shockR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 230, 200, ${shockA})`;
    ctx.lineWidth = Math.max(0.5, 4.5 * (1 - shockT));
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";

  for (const bit of bits) {
    const px = x + bit.ox;
    const py = y + bit.oy;

    if (bit.kind === "spark") {
      if (bit.age >= bit.life) continue;
      const sf = 1 - bit.age / bit.life;
      const s = bit.size * sf;
      ctx.fillStyle = `rgba(255, 245, 200, ${sf * 0.95})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.35, s), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (bit.kind === "ember") {
      const s = bit.size * tailFade;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, s);
      grad.addColorStop(0, `rgba(255, 200, 90, ${tailFade * 0.9})`);
      grad.addColorStop(0.55, `rgba(255, 90, 40, ${tailFade * 0.5})`);
      grad.addColorStop(1, "rgba(80, 40, 30, 0)");
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, s), 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      continue;
    }

    const s = bit.size * (0.35 + tailFade * 0.65);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(bit.rot);
    const grad = ctx.createLinearGradient(-s, -s, s, s);
    grad.addColorStop(0, `rgba(255, 214, 160, ${tailFade})`);
    grad.addColorStop(1, `rgba(90, 32, 18, ${tailFade * 0.7})`);
    ctx.fillStyle = grad;
    ctx.fillRect(-s * 0.55, -s * 0.35, s * 1.1, s * 0.7);
    ctx.restore();
  }

  ctx.restore();
}