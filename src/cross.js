const CROSS_RADIUS = 96;
const CROSS_ARM_HALF = 8;
const FAR_SPEED = 160;
const NEAR_SPEED = 32;
const SPIN = 0.75;
const SWEEP_STEP = 4;

function furthestWall(player, width, height, reach) {
  const dLeft = player.x;
  const dRight = width - player.x;
  const dTop = player.y;
  const dBottom = height - player.y;

  if (dLeft >= dRight && dLeft >= dTop && dLeft >= dBottom) {
    return { x: -reach, y: player.y };
  }
  if (dRight >= dTop && dRight >= dBottom) {
    return { x: width + reach, y: player.y };
  }
  if (dTop >= dBottom) {
    return { x: player.x, y: -reach };
  }
  return { x: player.x, y: height + reach };
}

function createCross(player, width, height) {
  const radius = CROSS_RADIUS;
  const armHalf = CROSS_ARM_HALF;
  const reach = Math.hypot(radius, armHalf);
  const spot = furthestWall(player, width, height, reach);

  return {
    x: spot.x,
    y: spot.y,
    radius,
    armHalf,
    angle: Math.random() * Math.PI,
    spin: Math.random() < 0.5 ? -SPIN : SPIN,
  };
}

// Medium across the open arena, easing into a crawl as it closes in.
function approachSpeed(dist, width, height) {
  const far = Math.min(width, height) * 0.5;
  if (far <= 1) return FAR_SPEED;
  const t = Math.min(1, dist / far);
  const blend = t * t * (3 - 2 * t);
  return NEAR_SPEED + (FAR_SPEED - NEAR_SPEED) * blend;
}

function circleHitsRect(px, py, pr, ox, oy, angle, halfLen, halfThick) {
  const dx = px - ox;
  const dy = py - oy;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const cx = Math.max(-halfLen, Math.min(halfLen, lx));
  const cy = Math.max(-halfThick, Math.min(halfThick, ly));
  const ex = lx - cx;
  const ey = ly - cy;
  return ex * ex + ey * ey <= pr * pr;
}

function armsHit(x, y, angle, armRadius, armHalf, px, py, pr) {
  return (
    circleHitsRect(px, py, pr, x, y, angle, armRadius, armHalf) ||
    circleHitsRect(px, py, pr, x, y, angle + Math.PI / 2, armRadius, armHalf)
  );
}

/**
 * @returns {boolean} true when an arm touches the player body
 */
function updateCross(cross, player, fromX, fromY, width, height, dt) {
  if (!cross) return false;

  const dx = player.x - cross.x;
  const dy = player.y - cross.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = approachSpeed(dist, width, height);
  const destX = cross.x + (dx / dist) * speed * dt;
  const destY = cross.y + (dy / dist) * speed * dt;
  const destAngle = cross.angle + cross.spin * dt;
  const travel =
    Math.hypot(player.x - fromX, player.y - fromY) +
    Math.hypot(destX - cross.x, destY - cross.y);
  const steps = Math.max(1, Math.ceil(travel / SWEEP_STEP));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cross.x + (destX - cross.x) * t;
    const y = cross.y + (destY - cross.y) * t;
    const angle = cross.angle + (destAngle - cross.angle) * t;
    const px = fromX + (player.x - fromX) * t;
    const py = fromY + (player.y - fromY) * t;
    if (armsHit(x, y, angle, cross.radius, cross.armHalf, px, py, player.radius)) {
      cross.x = x;
      cross.y = y;
      cross.angle = angle;
      player.x = px;
      player.y = py;
      return true;
    }
  }

  cross.x = destX;
  cross.y = destY;
  cross.angle = destAngle;
  return false;
}

function tracePlus(ctx, radius, armHalf) {
  const r = radius;
  const t = armHalf;
  ctx.beginPath();
  ctx.moveTo(-r, -t);
  ctx.lineTo(-t, -t);
  ctx.lineTo(-t, -r);
  ctx.lineTo(t, -r);
  ctx.lineTo(t, -t);
  ctx.lineTo(r, -t);
  ctx.lineTo(r, t);
  ctx.lineTo(t, t);
  ctx.lineTo(t, r);
  ctx.lineTo(-t, r);
  ctx.lineTo(-t, t);
  ctx.lineTo(-r, t);
  ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawCross(ctx, cross) {
  if (!cross) return;

  const { x, y, angle, radius, armHalf } = cross;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  tracePlus(ctx, radius, armHalf);

  ctx.shadowColor = "rgba(154, 16, 24, 0.9)";
  ctx.shadowBlur = 16;

  const grad = ctx.createRadialGradient(-radius * 0.14, -radius * 0.14, 2, 0, 0, radius);
  grad.addColorStop(0, "#9a1018");
  grad.addColorStop(0.55, "#5a1014");
  grad.addColorStop(1, "#3a1014");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#9a1018";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
