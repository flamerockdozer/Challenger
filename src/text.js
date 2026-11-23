const ARCADE_FONT = '"Press Start 2P", monospace';

document.fonts.load(`16px ${ARCADE_FONT}`).catch(() => {});

function rasterizeArcade(text, size, color) {
  const font = `${size}px ${ARCADE_FONT}`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const measured = probe.measureText(text);
  const pad = 2;
  const ascent = measured.actualBoundingBoxAscent || size;
  const descent = measured.actualBoundingBoxDescent || Math.ceil(size * 0.3);
  const width = Math.max(1, Math.ceil(measured.width) + pad * 2);
  const height = Math.max(1, Math.ceil(ascent + descent) + pad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const sctx = canvas.getContext("2d", { willReadFrequently: true });
  sctx.font = font;
  sctx.textBaseline = "top";
  sctx.fillStyle = color;
  sctx.fillText(text, pad, pad);

  const image = sctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] >= 128 ? 255 : 0;
  }
  sctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Draw chunky arcade text. Anti-aliased edges are snapped on or off,
 * then blitted with nearest-neighbor so the pixels stay square.
 * @param {CanvasRenderingContext2D} ctx
 */
function drawArcadeText(ctx, text, x, y, size, color, align = "left", baseline = "top") {
  const label = rasterizeArcade(text, size, color);
  const shadow = rasterizeArcade(text, size, "#000000");
  let dx = x;
  let dy = y;
  if (align === "center") dx -= label.width / 2;
  else if (align === "right") dx -= label.width;
  if (baseline === "middle") dy -= label.height / 2;
  else if (baseline === "bottom") dy -= label.height;

  const px = Math.round(dx);
  const py = Math.round(dy);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shadow, px + 2, py + 2);
  ctx.drawImage(label, px, py);
  ctx.restore();
}
