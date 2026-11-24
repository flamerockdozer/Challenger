const MISSILE_LENGTH = 60;
const MISSILE_WIDTH = 20;
const MISSILE_SPEED = 520;
const MISSILE_TURN_RADIUS = 460;
const MISSILE_SWEEP = 8;
const MISSILE_SPAWN_PAD = 8;
const FLAME_LENGTH = 22;
const FLAME_BASE = 7;
const MISSILE_SPIN = 16;

const SMOKE_SPAWN_GAP = 0.012;
const SMOKE_LIFE = 3.6;
const SMOKE_RADIUS_START = 5;
const SMOKE_RADIUS_END = 28;
const SMOKE_TAIL_OFFSET = 6;
const SMOKE_RGB_CORE = "185, 185, 190";
const SMOKE_RGB_MID = "148, 148, 155";
const SMOKE_RGB_EDGE = "112, 112, 118";

const missileSmoke = [];
let smokePuffSprite = null;

function smokePuffSpriteCanvas() {
  if (smokePuffSprite) return smokePuffSprite;

  const r = SMOKE_RADIUS_END;
  const size = r * 2;
  const bake = document.createElement("canvas");
  bake.width = size;
  bake.height = size;
  const bctx = bake.getContext("2d");
  const grad = bctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${SMOKE_RGB_CORE}, 0.95)`);
  grad.addColorStop(0.45, `rgba(${SMOKE_RGB_MID}, 0.55)`);
  grad.addColorStop(1, `rgba(${SMOKE_RGB_EDGE}, 0)`);
  bctx.fillStyle = grad;
  bctx.beginPath();
  bctx.arc(r, r, r, 0, Math.PI * 2);
  bctx.fill();

  smokePuffSprite = bake;
  return smokePuffSprite;
}

/** These dot counts spawn a missile. After the last one, every second dot does too. */
const MISSILE_DOTS = [ 5, 10, 14, 17];

/** Local space: +x forward, origin at body center. Shared by draw and collision. */
function buildMissileParts(halfLen, halfThick) {
  const finSpan = halfThick * 1.7;
  const finReach = halfLen * 1.093;
  const lowerRoot = [-halfLen * 0.827, -halfThick * 0.95];
  const upperRoot = [-halfLen * 0.827, halfThick * 0.95];
  const lowerTail = [-halfLen, -halfThick];
  const upperTail = [-halfLen, halfThick];
  const body = [
    [halfLen, 0],
    [halfLen * 0.587, -halfThick * 0.75],
    [-halfLen * 0.747, -halfThick],
    lowerTail,
    lowerRoot,
    [-halfLen, -halfThick * 0.3],
    upperRoot,
    upperTail,
    [-halfLen * 0.747, halfThick],
    [halfLen * 0.587, halfThick * 0.75],
  ];
  const fins = [
    [lowerTail, [-finReach, -finSpan], lowerRoot],
    [upperRoot, [-finReach, finSpan], upperTail],
  ];
  return { body, fins };
}

const { body: BODY_VERTICES, fins: FIN_POLYS } = buildMissileParts(
  MISSILE_LENGTH / 2,
  MISSILE_WIDTH / 2,
);

const MISSILE_REACH = Math.max(
  ...BODY_VERTICES.map(([x, y]) => Math.hypot(x, y)),
  ...FIN_POLYS.flat().map(([x, y]) => Math.hypot(x, y)),
);

function wrapToPi(angle) {
  const tau = Math.PI * 2;
  let wrapped = (angle + Math.PI) % tau;
  if (wrapped < 0) wrapped += tau;
  return wrapped - Math.PI;
}

function missileLocalPoint(px, py, ox, oy, angle) {
  const dx = px - ox;
  const dy = py - oy;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

function pointInPolygon(x, y, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    const cross = (yi > y) !== (yj > y);
    if (cross && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distPointSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + dx * t;
  const qy = y1 + dy * t;
  return Math.hypot(px - qx, py - qy);
}

function circleHitsPolygon(px, py, pr, ox, oy, angle, verts) {
  const { x: lx, y: ly } = missileLocalPoint(px, py, ox, oy, angle);
  if (pointInPolygon(lx, ly, verts)) return true;

  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    if (distPointSegment(lx, ly, x1, y1, x2, y2) <= pr) return true;
  }
  return false;
}

function rolledFins(roll) {
  const scale = Math.cos(roll);
  return FIN_POLYS.map((fin) => fin.map(([x, y]) => [x, y * scale]));
}

function missileWorldExtents(missile) {
  const cos = Math.cos(missile.angle);
  const sin = Math.sin(missile.angle);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const include = (lx, ly) => {
    const wx = missile.x + lx * cos - ly * sin;
    const wy = missile.y + lx * sin + ly * cos;
    minX = Math.min(minX, wx);
    maxX = Math.max(maxX, wx);
    minY = Math.min(minY, wy);
    maxY = Math.max(maxY, wy);
  };

  for (const [lx, ly] of BODY_VERTICES) include(lx, ly);
  for (const fin of rolledFins(missile.roll)) {
    for (const [lx, ly] of fin) include(lx, ly);
  }

  return { minX, maxX, minY, maxY };
}

function circleHitsMissile(px, py, pr, ox, oy, angle, roll) {
  if (circleHitsPolygon(px, py, pr, ox, oy, angle, BODY_VERTICES)) return true;
  for (const fin of rolledFins(roll)) {
    if (circleHitsPolygon(px, py, pr, ox, oy, angle, fin)) return true;
  }
  return false;
}

function createMissile(player, width, height) {
  const reach = MISSILE_REACH + MISSILE_SPAWN_PAD;
  const spot = furthestWall(player, width, height, reach);
  return {
    x: spot.x,
    y: spot.y,
    angle: Math.atan2(player.y - spot.y, player.x - spot.x),
    roll: Math.random() * Math.PI * 2,
    spin: Math.random() < 0.5 ? -MISSILE_SPIN : MISSILE_SPIN,
    age: 0,
    entered: false,
    smokeAcc: 0,
  };
}

function clearMissileSmoke() {
  missileSmoke.length = 0;
}

function missileTailWorld(missile) {
  const tailLocalX = BODY_VERTICES[5][0] - SMOKE_TAIL_OFFSET;
  const cos = Math.cos(missile.angle);
  const sin = Math.sin(missile.angle);
  const spread = (Math.random() - 0.5) * MISSILE_WIDTH * 0.35;
  return {
    x: missile.x + tailLocalX * cos - spread * sin,
    y: missile.y + tailLocalX * sin + spread * cos,
  };
}

function spawnMissileSmokePuff(missile) {
  const { x, y } = missileTailWorld(missile);
  const backX = -Math.cos(missile.angle);
  const backY = -Math.sin(missile.angle);
  const drift = 22 + Math.random() * 28;
  missileSmoke.push({
    x,
    y,
    age: 0,
    life: SMOKE_LIFE * (0.82 + Math.random() * 0.36),
    radius0: SMOKE_RADIUS_START * (0.75 + Math.random() * 0.5),
    radius1: SMOKE_RADIUS_END * (0.85 + Math.random() * 0.3),
    vx: backX * drift + (Math.random() - 0.5) * 14,
    vy: backY * drift + (Math.random() - 0.5) * 14,
    peak: 0.52 + Math.random() * 0.26,
  });
}

function updateMissileSmoke(dt) {
  const decay = 1 - Math.min(1, dt * 1.35);
  let write = 0;
  for (let i = 0; i < missileSmoke.length; i++) {
    const puff = missileSmoke[i];
    puff.age += dt;
    if (puff.age >= puff.life) continue;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vx *= decay;
    puff.vy *= decay;
    missileSmoke[write++] = puff;
  }
  missileSmoke.length = write;
}

function drawMissileSmoke(ctx) {
  if (!missileSmoke.length) return;

  const sprite = smokePuffSpriteCanvas();

  for (const puff of missileSmoke) {
    const t = puff.age / puff.life;
    const fade = (1 - t) * (1 - t * 0.18);
    const alpha = puff.peak * fade;
    if (alpha < 0.02) continue;

    const radius = puff.radius0 + (puff.radius1 - puff.radius0) * Math.sqrt(t);
    const size = radius * 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, puff.x - radius, puff.y - radius, size, size);
  }
  ctx.globalAlpha = 1;
}

function dotSpawnsMissile(count) {
  const last = MISSILE_DOTS[MISSILE_DOTS.length - 1];
  if (count < last) return MISSILE_DOTS.includes(count);
  return (count - last) % 2 === 0;
}

function spawnMissilesForDots(missiles, player, width, height, before, after) {
  for (let count = before + 1; count <= after; count++) {
    if (dotSpawnsMissile(count)) missiles.push(createMissile(player, width, height));
  }
}

function missileFullyOffscreen(missile, width, height) {
  const { minX, maxX, minY, maxY } = missileWorldExtents(missile);
  return maxX < 0 || maxY < 0 || minX > width || minY > height;
}

/**
 * Turn rate is speed / radius, so they arc wide instead of snapping onto the player.
 * @returns {boolean} true when a missile touches the player body
 */
function updateMissiles(missiles, player, fromX, fromY, width, height, dt) {
  let hitPlayer = false;
  const turnRate = MISSILE_SPEED / MISSILE_TURN_RADIUS;

  for (let i = missiles.length - 1; i >= 0; i--) {
    const missile = missiles[i];
    missile.age += dt;

    const desired = Math.atan2(player.y - missile.y, player.x - missile.x);
    let delta = wrapToPi(desired - missile.angle);
    const maxTurn = turnRate * dt;
    if (delta > maxTurn) delta = maxTurn;
    else if (delta < -maxTurn) delta = -maxTurn;

    const destAngle = missile.angle + delta;
    const destRoll = missile.roll + missile.spin * dt;
    const midAngle = missile.angle + delta * 0.5;
    const destX = missile.x + Math.cos(midAngle) * MISSILE_SPEED * dt;
    const destY = missile.y + Math.sin(midAngle) * MISSILE_SPEED * dt;
    const travel =
      Math.hypot(player.x - fromX, player.y - fromY) +
      Math.hypot(destX - missile.x, destY - missile.y);
    const steps = Math.max(1, Math.ceil(travel / MISSILE_SWEEP));
    let struck = false;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = missile.x + (destX - missile.x) * t;
      const y = missile.y + (destY - missile.y) * t;
      const angle = missile.angle + (destAngle - missile.angle) * t;
      const roll = missile.roll + (destRoll - missile.roll) * t;
      const px = fromX + (player.x - fromX) * t;
      const py = fromY + (player.y - fromY) * t;
      if (circleHitsMissile(px, py, player.radius, x, y, angle, roll)) {
        missile.x = x;
        missile.y = y;
        missile.angle = angle;
        missile.roll = roll;
        player.x = px;
        player.y = py;
        struck = true;
        hitPlayer = true;
        break;
      }
    }

    if (!struck) {
      missile.x = destX;
      missile.y = destY;
      missile.angle = destAngle;
      missile.roll = destRoll;
    }

    missile.smokeAcc += dt;
    while (missile.smokeAcc >= SMOKE_SPAWN_GAP) {
      missile.smokeAcc -= SMOKE_SPAWN_GAP;
      spawnMissileSmokePuff(missile);
      spawnMissileSmokePuff(missile);
    }

    if (!missile.entered) {
      if (!missileFullyOffscreen(missile, width, height)) missile.entered = true;
    } else if (missileFullyOffscreen(missile, width, height)) {
      missiles.splice(i, 1);
    }
  }

  updateMissileSmoke(dt);
  return hitPlayer;
}

function drawFlameExhaust(ctx, tailX, age) {
  const baseX = tailX + 2;
  const flicker = 0.85 + Math.sin(age * 38) * 0.12 + Math.sin(age * 61) * 0.08;
  const len = FLAME_LENGTH * flicker;
  const halfW = FLAME_BASE * (0.9 + Math.sin(age * 47) * 0.1);
  const sway = Math.sin(age * 52) * 1.2;

  const drawFlameLobe = (x0, y0, length, width, phase, alpha) => {
    const tipX = x0 - length;
    const midX = x0 - length * 0.45;
    const wobble = Math.sin(age * 44 + phase) * width * 0.25;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - width * 0.35);
    ctx.quadraticCurveTo(midX, y0 - width - wobble, tipX, y0 + sway * 0.3);
    ctx.quadraticCurveTo(midX, y0 + width + wobble, x0, y0 + width * 0.35);
    ctx.closePath();
    const grad = ctx.createLinearGradient(x0, y0, tipX, y0);
    grad.addColorStop(0, `rgba(255, 248, 200, ${alpha})`);
    grad.addColorStop(0.35, `rgba(255, 180, 60, ${alpha * 0.95})`);
    grad.addColorStop(0.7, `rgba(255, 90, 20, ${alpha * 0.55})`);
    grad.addColorStop(1, "rgba(180, 40, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fill();
  };

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  drawFlameLobe(baseX, sway * 0.4, len * 1.05, halfW * 1.1, 0, 0.75);
  drawFlameLobe(baseX, -sway * 0.3, len * 0.88, halfW * 0.75, 1.7, 0.55);
  drawFlameLobe(baseX, sway * 0.2, len * 0.82, halfW * 0.65, 3.1, 0.45);

  const coreR = 3.5 + Math.sin(age * 55) * 0.5;
  const core = ctx.createRadialGradient(baseX - 1, sway * 0.15, 0, baseX - 1, sway * 0.15, coreR);
  core.addColorStop(0, "#fffef0");
  core.addColorStop(0.4, "#ffcc50");
  core.addColorStop(1, "rgba(255, 100, 20, 0)");
  ctx.beginPath();
  ctx.arc(baseX - 1, sway * 0.15, coreR, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();

  ctx.restore();
}

function tracePolygon(ctx, verts) {
  const [first, ...rest] = verts;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) ctx.lineTo(x, y);
  ctx.closePath();
}

function traceFins(ctx) {
  ctx.beginPath();
  for (const fin of FIN_POLYS) {
    const [first, ...rest] = fin;
    ctx.moveTo(first[0], first[1]);
    for (const [x, y] of rest) ctx.lineTo(x, y);
    ctx.closePath();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawMissiles(ctx, missiles) {
  const tailX = BODY_VERTICES[5][0];
  const noseX = BODY_VERTICES[0][0];
  const tailGradX = BODY_VERTICES[6][0];

  drawMissileSmoke(ctx);

  for (const missile of missiles) {
    ctx.save();
    ctx.translate(missile.x, missile.y);
    ctx.rotate(missile.angle);

    const grad = ctx.createLinearGradient(tailGradX, 0, noseX, 0);
    grad.addColorStop(0, "#3a1208");
    grad.addColorStop(0.35, "#7a1e0c");
    grad.addColorStop(0.72, "#e23a12");
    grad.addColorStop(1, "#ffd0a8");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#ff6a32";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255, 90, 24, 0.9)";
    ctx.shadowBlur = 16;

    ctx.save();
    ctx.scale(1, Math.cos(missile.roll));
    traceFins(ctx);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    tracePolygon(ctx, BODY_VERTICES);
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 200, 140, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-30, 0);
    ctx.stroke();
    ctx.restore();

    drawFlameExhaust(ctx, tailX, missile.age);

    ctx.restore();
  }
}