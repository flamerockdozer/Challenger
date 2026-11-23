const BULLET_COUNT = 36;
const BULLET_SPEED = 170;
const BULLET_RADIUS = 4;
const INITIAL_FIRE_DELAYS = [1.5, 2.25, 3.5];
const FIRE_INTERVALS = [5, 8, 8];
const DOT_RATE_BAND = 8;
const DOT_RATE_STEP = 0.1;
const EMITTER_SPEED = 110;
const EMITTER_RADIUS = 16;
const CHARGE_TIME = 0.75;
const EMITTER_MARGIN = 32;
const SHIELD_PUSH = 1000;
const SHIELD_BULLET_PUSH = 450;
const STEER = 2.2;
const MAX_PLAYER_FIX = EMITTER_SPEED * 0.45;
const MAX_SEPARATION = EMITTER_SPEED * 0.85;
const EMITTER_LOOKS = {
  fast: {
    body: "#3a1212",
    ring: "#ff4a32",
    glow: "rgba(255, 74, 50, 0.85)",
    core: ["#fff1ec", "#ff5840", "#b42822"],
  },
  mid: {
    body: "#3a1014",
    ring: "#ff3b3b",
    glow: "rgba(255, 40, 40, 0.85)",
    core: ["#fff4f4", "#ff3b3b", "#9a1018"],
  },
  slow: {
    body: "#3a1014",
    ring: "#ff3b3b",
    glow: "rgba(255, 40, 40, 0.85)",
    core: ["#fff4f4", "#ff3b3b", "#9a1018"],
  },
};

function lookForInterval(interval) {
  const fastest = Math.min(...FIRE_INTERVALS);
  const slowest = Math.max(...FIRE_INTERVALS);
  if (interval <= fastest) return EMITTER_LOOKS.fast;
  if (interval >= slowest) return EMITTER_LOOKS.slow;
  return EMITTER_LOOKS.mid;
}

function createEmitter(x, y, playerX, playerY, interval, orbit, initialDelay) {
  const dx = x - playerX;
  const dy = y - playerY;
  const dist = Math.hypot(dx, dy) || 1;
  const tx = (-dy / dist) * orbit;
  const ty = (dx / dist) * orbit;

  return {
    x,
    y,
    vx: tx * EMITTER_SPEED,
    vy: ty * EMITTER_SPEED,
    interval,
    timer: initialDelay,
    radius: EMITTER_RADIUS,
    orbitRadius: dist,
    orbit,
    look: lookForInterval(interval),
  };
}

function createEmitters(width, height) {
  const px = width * 0.5;
  const py = height * 0.5;
  const radius = Math.min(width, height) * 0.32;
  const spots = FIRE_INTERVALS.map((interval, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return [
      px + Math.cos(angle) * radius,
      py + Math.sin(angle) * radius,
      interval,
      i % 2 === 0 ? 1 : -1,
      INITIAL_FIRE_DELAYS[i],
    ];
  });

  return spots.map(([x, y, interval, orbit, initialDelay]) =>
    createEmitter(x, y, px, py, interval, orbit, initialDelay)
  );
}

function fireEmitter(emitter, bullets, player) {
  const toward = Math.atan2(player.y - emitter.y, player.x - emitter.x);
  const count = BULLET_COUNT / 2;
  const step = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = toward + step * i;
    bullets.push({
      x: emitter.x,
      y: emitter.y,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      radius: BULLET_RADIUS,
    });
  }
}

function clampLength(x, y, max) {
  const len = Math.hypot(x, y);
  if (len <= max || len === 0) return { x, y };
  const scale = max / len;
  return { x: x * scale, y: y * scale };
}

function tangentPointsOut(emitter, tx, ty, width, height) {
  const band = EMITTER_MARGIN + 56;
  return (
    (emitter.x < band && tx < 0) ||
    (emitter.x > width - band && tx > 0) ||
    (emitter.y < band && ty < 0) ||
    (emitter.y > height - band && ty > 0)
  );
}

function separationSteer(emitter, emitters, separateDistance) {
  let sx = 0;
  let sy = 0;

  for (const other of emitters) {
    if (other === emitter) continue;
    let dx = emitter.x - other.x;
    let dy = emitter.y - other.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1) {
      dx = 1;
      dy = 0;
      dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    if (dist < separateDistance) {
      const push = (separateDistance - dist) * 1.4;
      sx += nx * push;
      sy += ny * push;
    } else if (dist < separateDistance * 1.8) {
      const pull = (dist - separateDistance) * 0.22;
      sx -= nx * pull;
      sy -= ny * pull;
    }
  }

  return clampLength(sx, sy, MAX_SEPARATION);
}

function edgeSteer(emitter, width, height) {
  const band = 90;
  let x = 0;
  let y = 0;
  const left = emitter.x - EMITTER_MARGIN;
  const right = width - EMITTER_MARGIN - emitter.x;
  const top = emitter.y - EMITTER_MARGIN;
  const bottom = height - EMITTER_MARGIN - emitter.y;

  if (left < band) x += ((band - left) / band) * EMITTER_SPEED;
  if (right < band) x -= ((band - right) / band) * EMITTER_SPEED;
  if (top < band) y += ((band - top) / band) * EMITTER_SPEED;
  if (bottom < band) y -= ((band - bottom) / band) * EMITTER_SPEED;

  return { x, y };
}

function moveEmitter(emitter, emitters, player, width, height, separateDistance, dt) {
  let dx = emitter.x - player.x;
  let dy = emitter.y - player.y;
  let dist = Math.hypot(dx, dy);
  if (dist < 1) {
    dx = 1;
    dy = 0;
    dist = 1;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  let tx = -ny * emitter.orbit;
  let ty = nx * emitter.orbit;

  if (tangentPointsOut(emitter, tx, ty, width, height)) {
    emitter.orbit *= -1;
    tx = -tx;
    ty = -ty;
  }

  const playerFix = Math.max(
    -MAX_PLAYER_FIX,
    Math.min(MAX_PLAYER_FIX, (emitter.orbitRadius - dist) * 0.7)
  );
  const separation = separationSteer(emitter, emitters, separateDistance);
  const edge = edgeSteer(emitter, width, height);

  const desiredVx = tx * EMITTER_SPEED + nx * playerFix + separation.x + edge.x;
  const desiredVy = ty * EMITTER_SPEED + ny * playerFix + separation.y + edge.y;
  const blend = 1 - Math.exp(-STEER * dt);

  emitter.vx += (desiredVx - emitter.vx) * blend;
  emitter.vy += (desiredVy - emitter.vy) * blend;
  emitter.x += emitter.vx * dt;
  emitter.y += emitter.vy * dt;

  if (emitter.x < EMITTER_MARGIN) {
    emitter.x = EMITTER_MARGIN;
    if (emitter.vx < 0) emitter.vx = 0;
  } else if (emitter.x > width - EMITTER_MARGIN) {
    emitter.x = width - EMITTER_MARGIN;
    if (emitter.vx > 0) emitter.vx = 0;
  }

  if (emitter.y < EMITTER_MARGIN) {
    emitter.y = EMITTER_MARGIN;
    if (emitter.vy < 0) emitter.vy = 0;
  } else if (emitter.y > height - EMITTER_MARGIN) {
    emitter.y = height - EMITTER_MARGIN;
    if (emitter.vy > 0) emitter.vy = 0;
  }

  if (player.shieldActive) pushEmitter(emitter, player);
}

function pushEmitter(emitter, player) {
  let dx = emitter.x - player.x;
  let dy = emitter.y - player.y;
  let dist = Math.hypot(dx, dy);
  const reach = shieldHitRadius() + emitter.radius;
  if (dist >= reach) return;

  if (dist < 1e-4) {
    dx = 1;
    dy = 0;
    dist = 1e-4;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  emitter.x = player.x + nx * (reach + 0.5);
  emitter.y = player.y + ny * (reach + 0.5);

  const relOut = (emitter.vx - player.vx) * nx + (emitter.vy - player.vy) * ny;
  if (relOut < SHIELD_PUSH) {
    const add = SHIELD_PUSH - relOut;
    emitter.vx += nx * add;
    emitter.vy += ny * add;
  }
}

function emitterHitsPlayer(emitter, player) {
  return Math.hypot(emitter.x - player.x, emitter.y - player.y) <= player.radius + emitter.radius;
}

function rateScaleForDot(index) {
  const band = Math.floor(index / DOT_RATE_BAND);
  return 1 + DOT_RATE_STEP / 2 ** band;
}

function hastenEmitters(emitters, dotsBefore, dotsCollected) {
  if (dotsCollected <= 0) return;
  let factor = 1;
  for (let i = 0; i < dotsCollected; i++) {
    factor *= rateScaleForDot(dotsBefore + i);
  }
  for (const emitter of emitters) {
    emitter.interval /= factor;
    emitter.timer /= factor;
  }
}

/**
 * @returns {boolean} true when an emitter touches the player body
 */
function updateEmitters(emitters, bullets, player, width, height, dt) {
  const separateDistance = Math.min(width, height) * 0.22;
  let hitPlayer = false;

  for (const emitter of emitters) {
    moveEmitter(emitter, emitters, player, width, height, separateDistance, dt);
    if (emitterHitsPlayer(emitter, player)) hitPlayer = true;
    emitter.timer -= dt;
    while (emitter.timer <= 0) {
      fireEmitter(emitter, bullets, player);
      emitter.timer += emitter.interval;
    }
  }

  return hitPlayer;
}

/**
 * Bounce a bullet off the shield circle, then launch it outward.
 * Normal is the radius at the contact point, so incidence matches reflection,
 * and the shield adds enough outward speed to throw the shot off the player.
 */
function reflectBullet(bullet, player, shieldR, dt) {
  const hitR = shieldR + bullet.radius;
  const x0 = bullet.x - bullet.vx * dt;
  const y0 = bullet.y - bullet.vy * dt;
  const dx = bullet.vx * dt;
  const dy = bullet.vy * dt;
  const fx = x0 - player.x;
  const fy = y0 - player.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - hitR * hitR;

  let tHit = null;
  if (c > 0 && a > 1e-8) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= 1) tHit = t;
    }
  }

  let nx;
  let ny;
  if (tHit === null) {
    nx = bullet.x - player.x;
    ny = bullet.y - player.y;
  } else {
    nx = x0 + dx * tHit - player.x;
    ny = y0 + dy * tHit - player.y;
  }

  const len = Math.hypot(nx, ny);
  if (len < 1e-6) {
    const speed = Math.hypot(bullet.vx, bullet.vy);
    if (speed < 1e-6) {
      nx = 1;
      ny = 0;
    } else {
      nx = -bullet.vx / speed;
      ny = -bullet.vy / speed;
    }
  } else {
    nx /= len;
    ny /= len;
  }

  const dot = bullet.vx * nx + bullet.vy * ny;
  let deflected = false;
  if (dot < 0) {
    bullet.vx -= 2 * dot * nx;
    bullet.vy -= 2 * dot * ny;
    deflected = true;
  }

  const out = bullet.vx * nx + bullet.vy * ny;
  if (out < SHIELD_BULLET_PUSH) {
    const add = SHIELD_BULLET_PUSH - out;
    bullet.vx += nx * add;
    bullet.vy += ny * add;
  }

  const skin = 0.25;
  if (tHit === null) {
    bullet.x = player.x + nx * (hitR + skin);
    bullet.y = player.y + ny * (hitR + skin);
  } else {
    const remain = (1 - tHit) * dt;
    bullet.x = player.x + nx * (hitR + skin) + bullet.vx * remain;
    bullet.y = player.y + ny * (hitR + skin) + bullet.vy * remain;
  }

  return deflected && tHit !== null;
}

/**
 * @returns {boolean} true when a bullet hits the player body
 */
function updateBullets(bullets, player, width, height, dt) {
  let hitPlayer = false;
  const shieldR = player.shieldActive ? shieldHitRadius() : 0;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    if (
      bullet.x + bullet.radius < 0 ||
      bullet.y + bullet.radius < 0 ||
      bullet.x - bullet.radius > width ||
      bullet.y - bullet.radius > height
    ) {
      bullets.splice(i, 1);
      continue;
    }

    const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);

    if (player.shieldActive && dist <= shieldR + bullet.radius) {
      reflectBullet(bullet, player, shieldR, dt);
      continue;
    }

    if (dist <= player.radius + bullet.radius) hitPlayer = true;
  }

  return hitPlayer;
}

function emitterCharge(emitter) {
  if (emitter.timer >= CHARGE_TIME) return 0;
  return Math.max(0, Math.min(1, 1 - emitter.timer / CHARGE_TIME));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawEmitters(ctx, emitters) {
  for (const emitter of emitters) {
    const { x, y, radius } = emitter;
    const charge = emitterCharge(emitter);
    const core = Math.max(0, radius - 1.5);

    ctx.save();
    const look = emitter.look;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = look.body;
    ctx.fill();

    if (charge > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, core, 0, Math.PI * 2);
      ctx.clip();

      const fillR = core * charge;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(fillR, 0.01));
      grad.addColorStop(0, look.core[0]);
      grad.addColorStop(0.55, look.core[1]);
      grad.addColorStop(1, look.core[2]);
      ctx.beginPath();
      ctx.arc(x, y, fillR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = look.glow;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = look.ring;
    ctx.lineWidth = 2;
    ctx.shadowColor = look.glow;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.fillStyle = "#ff3b3b";
  ctx.shadowColor = "rgba(255, 40, 40, 0.85)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (const bullet of bullets) {
    ctx.moveTo(bullet.x + bullet.radius, bullet.y);
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}
