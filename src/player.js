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