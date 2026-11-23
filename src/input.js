const keys = new Set();
let enterDown = false;

const KEY_MAP = {
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
};

function onKeyDown(e) {
  if (e.code === "Enter") {
    if (!enterDown) keys.add("enter");
    enterDown = true;
    e.preventDefault();
    return;
  }
  if (e.code === "Space") {
    keys.add("shield");
    e.preventDefault();
    return;
  }
  if (KEY_MAP[e.code]) {
    keys.add(KEY_MAP[e.code]);
    e.preventDefault();
  }
}

function onKeyUp(e) {
  if (e.code === "Enter") {
    enterDown = false;
    keys.delete("enter");
    e.preventDefault();
    return;
  }
  if (e.code === "Space") {
    keys.delete("shield");
    e.preventDefault();
    return;
  }
  if (KEY_MAP[e.code]) {
    keys.delete(KEY_MAP[e.code]);
    e.preventDefault();
  }
}

function initInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    keys.clear();
    enterDown = false;
  });
}

/** True once per Enter press. A held key does not repeat. */
function consumeEnter() {
  if (!keys.has("enter")) return false;
  keys.delete("enter");
  return true;
}

function clearEnter() {
  keys.delete("enter");
}

/** @returns {{ x: number, y: number, active: boolean }} */
function getMoveAxis() {
  let x = 0;
  let y = 0;
  if (keys.has("left")) x -= 1;
  if (keys.has("right")) x += 1;
  if (keys.has("up")) y -= 1;
  if (keys.has("down")) y += 1;

  const active = x !== 0 || y !== 0;
  if (active) {
    const len = Math.hypot(x, y);
    x /= len;
    y /= len;
  }

  return { x, y, active };
}

function isShieldHeld() {
  return keys.has("shield");
}