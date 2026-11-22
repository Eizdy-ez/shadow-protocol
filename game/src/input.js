// SHADOW PROTOCOL — keyboard and mouse input.
// Keys are tracked as a Set of event.code values; mouse clicks are queued
// (one entry per click) so a single click is never read twice.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // Every keydown is queued here, so a quick tap can never fall between
    // two frames and be lost: pressed() consumes the queue, not the live set.
    pressedQueue: new Set(),
    clicks: [], // {x, y} in canvas pixels (1280x800 space)
    mouse: { x: 0, y: 0 },
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    input.keys.add(e.code);
    input.pressedQueue.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressedQueue.clear();
  });

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1280,
      y: ((e.clientY - rect.top) / rect.height) * 800,
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    input.mouse = toCanvas(e);
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toCanvas(e);
    input.mouse = p;
    input.clicks.push(p);
  });

  return input;
}

// True once when the key was pressed since the last check.
export function pressed(input, code) {
  if (input.pressedQueue.has(code)) {
    input.pressedQueue.delete(code);
    return true;
  }
  return false;
}
