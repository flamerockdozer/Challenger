const DOT_COUNT = 3;
const DOT_RADIUS = 48;
const DOT_PAD = 72;
const MIN_SCREEN_FRACTION = 0.25;
const SPAWN_TRIES = 80;
const POP_DURATION = 0.32;
const POP_BITS = 7;
const DOT_FADE_IN = 0.45;

let pops = [];

function screenDistance(ax, ay, bx, by, width, height) {
  const dx = (ax - bx) / width;
  const dy = (ay - by) / height;
  return Math.hypot(dx, dy);
}

function farFrom(x, y, points, width, height) {
  for (const point of points) {
    if (screenDistance(x, y, point.x, point.y, width, height) < MIN_SCREEN_FRACTION) {
      return false;
    }
  }
  return true;
}

function randomDotPoint(width, height) {
  const padX = Math.min(DOT_PAD, width * 0.5);
  const padY = Math.min(DOT_PAD, height * 0.5);
  const spanX = Math.max(1, width - padX * 2);
  const spanY = Math.max(1, height - padY * 2);
  return {
    x: padX + Math.random() * spanX,
    y: padY + Math.random() * spanY,
  };
}

function freshDot(x, y) {
  return { x, y, radius: DOT_RADIUS, spawnAge: 0 };
}

function dotFadeAlpha(spawnAge) {
  const t = Math.min(1, spawnAge / DOT_FADE_IN);
  return t * t * (3 - 2 * t);
}

function spawnDot(width, height, player, dots) {
  const avoid = [player, ...dots];

  for (let i = 0; i < SPAWN_TRIES; i++) {
    const point = randomDotPoint(width, height);
    if (farFrom(point.x, point.y, avoid, width, height)) {
      return freshDot(point.x, point.y);
    }
  }

  let best = randomDotPoint(width, height);
  let bestDist = -1;
  for (let i = 0; i < SPAWN_TRIES; i++) {
    const point = randomDotPoint(width, height);
    let nearest = Infinity;
    for (const other of avoid) {
      nearest = Math.min(
        nearest,
        screenDistance(point.x, point.y, other.x, other.y, width, height)
      );
    }
    if (nearest > bestDist) {
      bestDist = nearest;
      best = point;
    }
  }

  return freshDot(best.x, best.y);
}

function createDots(emitters) {
  return emitters.map((emitter) => freshDot(emitter.x, emitter.y));
}

function containDots(dots, width, height) {
  const padX = Math.min(DOT_PAD, width * 0.5);
  const padY = Math.min(DOT_PAD, height * 0.5);
  for (const dot of dots) {
    dot.x = Math.min(Math.max(dot.x, padX), Math.max(padX, width - padX));
    dot.y = Math.min(Math.max(dot.y, padY), Math.max(padY, height - padY));
  }
}

/**
 * Eat overlapping dots and replace each one. Returns how many were eaten.
 */
function collectDots(dots, player, width, height) {
  let eaten = 0;

  for (let i = dots.length - 1; i >= 0; i--) {
    const dot = dots[i];
    const dist = Math.hypot(dot.x - player.x, dot.y - player.y);
    if (dist <= player.radius + dot.radius) {
      spawnPop(dot.x, dot.y, dot.radius);
      dots.splice(i, 1);
      eaten++;
    }
  }

  while (dots.length < DOT_COUNT) {
    dots.push(spawnDot(width, height, player, dots));
  }

  return eaten;
}

function spawnPop(x, y, radius) {
  const bits = [];
  for (let i = 0; i < POP_BITS; i++) {
    const angle = (i / POP_BITS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    bits.push({
      angle,
      dist: 64 + Math.random() * 48,
      size: 2 + Math.random() * 2.2,
    });
  }
  pops.push({ x, y, radius, age: 0, bits });
}

function clearPops() {
  pops = [];
}

function updatePops(dt, dots) {
  for (const dot of dots) {
    dot.spawnAge += dt;
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].age += dt;
    if (pops[i].age >= POP_DURATION) pops.splice(i, 1);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawPops(ctx) {
  for (const pop of pops) {
    const t = pop.age / POP_DURATION;
    const expand = 1 - Math.pow(1 - t, 3);
    const fade = 1 - t;
    const discAlpha = Math.max(0, 1 - t / 0.62);

    ctx.save();

    if (discAlpha > 0) {
      const r = pop.radius * (1 + expand * 0.8);
      const grad = ctx.createRadialGradient(pop.x, pop.y, r * 0.12, pop.x, pop.y, r);
      grad.addColorStop(0, `rgba(60, 110, 82, ${discAlpha})`);
      grad.addColorStop(0.62, `rgba(36, 66, 52, ${discAlpha * 0.9})`);
      grad.addColorStop(1, `rgba(10, 10, 18, ${discAlpha * 0.15})`);
      ctx.beginPath();
      ctx.arc(pop.x, pop.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(pop.x, pop.y, pop.radius * (1 + expand * 1.45), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(64, 118, 88, ${fade * 0.7})`;
    ctx.lineWidth = 2.5 * (1 - expand * 0.55);
    ctx.stroke();

    ctx.fillStyle = `rgba(60, 110, 82, ${fade})`;
    for (const bit of pop.bits) {
      const d = pop.radius * 0.3 + bit.dist * expand;
      ctx.beginPath();
      ctx.arc(
        pop.x + Math.cos(bit.angle) * d,
        pop.y + Math.sin(bit.angle) * d,
        bit.size * (1 - t * 0.7),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawDots(ctx, dots) {
  for (const dot of dots) {
    const { x, y, radius } = dot;
    const alpha = dotFadeAlpha(dot.spawnAge);
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    const grad = ctx.createRadialGradient(x, y, radius * 0.12, x, y, radius);
    grad.addColorStop(0, "#3c6e52");
    grad.addColorStop(0.62, "#244234");
    grad.addColorStop(1, "#0a0a12");

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawScore(ctx, score) {
  drawArcadeText(ctx, String(score), 16, 14, 40, "#d8ffe4");
}
