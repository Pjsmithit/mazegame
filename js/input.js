// input.js — keyboard, on-screen d-pad, and swipe input, unified into
// a single "desired direction" the game loop reads each frame.

class InputManager {
  constructor(canvas) {
    this.desired = DIRS.NONE;
    this.pauseRequested = false;
    this._bindKeyboard();
    this._bindTouchButtons();
    this._bindSwipe(canvas);
  }

  consumePause() {
    const p = this.pauseRequested;
    this.pauseRequested = false;
    return p;
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.desired = DIRS.UP;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.desired = DIRS.DOWN;
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.desired = DIRS.LEFT;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.desired = DIRS.RIGHT;
          e.preventDefault();
          break;
        case ' ':
        case 'p':
        case 'P':
        case 'Escape':
          this.pauseRequested = true;
          e.preventDefault();
          break;
        default:
          break;
      }
    }, { passive: false });
  }

  _bindTouchButtons() {
    const map = { 'btn-up': DIRS.UP, 'btn-down': DIRS.DOWN, 'btn-left': DIRS.LEFT, 'btn-right': DIRS.RIGHT };
    for (const [id, dir] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      const set = (e) => {
        e.preventDefault();
        this.desired = dir;
      };
      el.addEventListener('touchstart', set, { passive: false });
      el.addEventListener('mousedown', set);
    }
  }

  _bindSwipe(canvas) {
    let sx = 0, sy = 0, tracking = false;
    const threshold = 20;

    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX;
      sy = t.clientY;
      tracking = true;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.desired = dx > 0 ? DIRS.RIGHT : DIRS.LEFT;
      } else {
        this.desired = dy > 0 ? DIRS.DOWN : DIRS.UP;
      }
    }, { passive: true });
  }
}
