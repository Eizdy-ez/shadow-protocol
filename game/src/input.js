// Input: keyboard + mouse with a queue, so a fast tap is never lost between
// two frames. Every keydown is pushed onto pressedQueue; pressed() consumes
// one entry. The live key set answers "is this held right now".
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedQueue = [];
    this.clickQueue = [];
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressedQueue.push(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.clickQueue.push({
        x: (e.clientX - rect.left) * (canvas.width / rect.width) / 2,
        y: (e.clientY - rect.top) * (canvas.height / rect.height) / 2,
      });
    });
    // Touch: tap to throw a coin at that spot.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      this.clickQueue.push({
        x: (t.clientX - rect.left) * (canvas.width / rect.width) / 2,
        y: (t.clientY - rect.top) * (canvas.height / rect.height) / 2,
      });
    }, { passive: false });
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once per physical press, even if the press fell between two frames.
  pressed(...codes) {
    for (let i = 0; i < this.pressedQueue.length; i++) {
      if (codes.includes(this.pressedQueue[i])) {
        this.pressedQueue.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  // Movement vector from held keys: {x, y} each -1, 0 or 1, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  consumeClick() {
    return this.clickQueue.shift() || null;
  }

  // Drop queued presses (for example when the screen changes) so a stale
  // Enter does not skip the next screen.
  clearQueue() {
    this.pressedQueue.length = 0;
    this.clickQueue.length = 0;
  }
}
