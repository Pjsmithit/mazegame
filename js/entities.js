// entities.js — Player and Ghost movement + AI.
//
// Positions are tracked in tile units (row, col) as floats so movement
// is smooth; direction changes are only evaluated when an entity is
// centered on a tile (i.e. at an intersection), which is how classic
// maze-chase games keep motion tile-aligned while still animating fluidly.

const DIRS = {
  UP: { dr: -1, dc: 0 },
  DOWN: { dr: 1, dc: 0 },
  LEFT: { dr: 0, dc: -1 },
  RIGHT: { dr: 0, dc: 1 },
  NONE: { dr: 0, dc: 0 },
};

function sameDir(a, b) {
  return a.dr === b.dr && a.dc === b.dc;
}

function isReverse(a, b) {
  return a.dr === -b.dr && a.dc === -b.dc && !(a.dr === 0 && a.dc === 0);
}

function isCentered(entity, eps) {
  const fr = entity.row - Math.round(entity.row);
  const fc = entity.col - Math.round(entity.col);
  return Math.abs(fr) < eps && Math.abs(fc) < eps;
}

class Player {
  constructor(maze) {
    this.reset(maze);
  }

  reset(maze) {
    this.row = maze.playerStart.row;
    this.col = maze.playerStart.col;
    this.dir = DIRS.NONE;
    this.nextDir = DIRS.NONE;
    this.speed = 5.6; // tiles per second
    this.mouthPhase = 0;
    this.alive = true;
  }

  setDesiredDirection(dir) {
    this.nextDir = dir;
  }

  update(dt, maze) {
    const eps = this.speed * dt * 0.9;
    if (isCentered(this, eps)) {
      this.row = Math.round(this.row);
      this.col = Math.round(this.col);
      if (this.nextDir !== DIRS.NONE) {
        const c = maze.wrapCol(this.col + this.nextDir.dc);
        if (maze.isPassable(this.row + this.nextDir.dr, c)) {
          this.dir = this.nextDir;
        }
      }
      const c = maze.wrapCol(this.col + this.dir.dc);
      if (!maze.isPassable(this.row + this.dir.dr, c)) {
        this.dir = DIRS.NONE;
      }
    }
    this.row += this.dir.dr * this.speed * dt;
    this.col += this.dir.dc * this.speed * dt;
    this.col = wrapFloatCol(this.col, maze.cols);
    this.mouthPhase += dt * 10;
  }

  draw(ctx, tile) {
    const x = this.col * tile + tile / 2;
    const y = this.row * tile + tile / 2;
    const r = tile * 0.42;
    const openness = (Math.sin(this.mouthPhase) + 1) / 2; // 0..1
    const mouthAngle = 0.12 + openness * 0.32; // radians half-angle

    let facing = 0; // radians, 0 = right
    if (sameDir(this.dir, DIRS.LEFT)) facing = Math.PI;
    else if (sameDir(this.dir, DIRS.UP)) facing = -Math.PI / 2;
    else if (sameDir(this.dir, DIRS.DOWN)) facing = Math.PI / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.fillStyle = '#4fe9da';
    ctx.shadowColor = 'rgba(79, 233, 218, 0.85)';
    ctx.shadowBlur = tile * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, r, mouthAngle, Math.PI * 2 - mouthAngle);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function wrapFloatCol(col, cols) {
  if (col < -0.5) return cols - 0.5;
  if (col > cols - 0.5) return -0.5;
  return col;
}

// Personality determines how a ghost picks its chase target.
// 'chaser'  — beelines for the player's current tile.
// 'flanker' — aims a few tiles ahead of the player's facing direction.
// 'pincer'  — mirrors the chaser's target through the player for a pincer move.
// 'wanderer'— chases when far away, otherwise peels off toward its home corner.
class Ghost {
  constructor(maze, personality, color, scatterCorner, spawnOffset) {
    this.maze = maze;
    this.personality = personality;
    this.color = color;
    this.scatterCorner = scatterCorner;
    this.spawnOffset = spawnOffset;
    this.reset(maze);
  }

  reset(maze) {
    this.row = maze.ghostStart.row + this.spawnOffset.dr;
    this.col = maze.ghostStart.col + this.spawnOffset.dc;
    this.dir = DIRS.UP;
    this.baseSpeed = 4.6;
    this.speed = this.baseSpeed;
    this.mode = 'pen'; // pen -> scatter/chase -> frightened -> eaten
    this.penTimer = this.spawnOffset.delay || 0;
    this.frightenedTimer = 0;
  }

  applyLevelSpeed(level) {
    this.baseSpeed = 4.6 + Math.min(level - 1, 6) * 0.18;
  }

  enterFrightened(duration) {
    if (this.mode === 'eaten' || this.mode === 'pen') return;
    this.mode = 'frightened';
    this.frightenedTimer = duration;
    this.dir = { dr: -this.dir.dr, dc: -this.dir.dc } || DIRS.UP;
  }

  getEaten() {
    this.mode = 'eaten';
  }

  currentTarget(player, chaserGhost, globalMode) {
    if (this.mode === 'eaten') {
      return { row: this.maze.ghostStart.row, col: this.maze.ghostStart.col };
    }
    if (this.mode === 'frightened') {
      return null; // random movement, handled separately
    }
    if (globalMode === 'scatter') {
      return this.scatterCorner;
    }
    // chase mode — personality-driven targeting
    switch (this.personality) {
      case 'chaser':
        return { row: Math.round(player.row), col: Math.round(player.col) };
      case 'flanker': {
        const lead = 4;
        return {
          row: Math.round(player.row) + player.dir.dr * lead,
          col: Math.round(player.col) + player.dir.dc * lead,
        };
      }
      case 'pincer': {
        const anchor = chaserGhost || this;
        const px = Math.round(player.row) + player.dir.dr * 2;
        const py = Math.round(player.col) + player.dir.dc * 2;
        return {
          row: px + (px - anchor.row),
          col: py + (py - anchor.col),
        };
      }
      case 'wanderer': {
        const dist = Math.hypot(this.row - player.row, this.col - player.col);
        return dist > 8
          ? { row: Math.round(player.row), col: Math.round(player.col) }
          : this.scatterCorner;
      }
      default:
        return { row: Math.round(player.row), col: Math.round(player.col) };
    }
  }

  update(dt, maze, player, chaserGhost, globalMode) {
    if (this.mode === 'pen') {
      this.penTimer -= dt;
      // gentle bob while waiting
      this.row += Math.sin(performance.now() / 200 + this.spawnOffset.dc) * 0.002;
      if (this.penTimer <= 0) {
        this.mode = globalMode;
        this.row = this.maze.ghostStart.row;
        this.col = this.maze.ghostStart.col;
        this.dir = DIRS.UP;
      }
      return;
    }

    if (this.mode === 'frightened') {
      this.frightenedTimer -= dt;
      this.speed = this.baseSpeed * 0.55;
      if (this.frightenedTimer <= 0) {
        this.mode = globalMode;
      }
    } else if (this.mode === 'eaten') {
      this.speed = this.baseSpeed * 2.1;
    } else {
      this.mode = globalMode;
      this.speed = this.baseSpeed;
    }

    const eps = this.speed * dt * 0.9;
    const allowDoor = this.mode === 'eaten';
    if (isCentered(this, eps)) {
      this.row = Math.round(this.row);
      this.col = Math.round(this.col);

      // Ghost reached the pen while "eaten" — revive it.
      if (this.mode === 'eaten' && this.row === this.maze.ghostStart.row && this.col === this.maze.ghostStart.col) {
        this.mode = globalMode;
        this.speed = this.baseSpeed;
      }

      const options = maze.neighbors(this.row, this.col, { allowDoor: allowDoor || this.mode !== 'eaten' });
      const valid = options.filter((o) => !isReverse({ dr: o.dr, dc: o.dc }, this.dir));
      const pool = valid.length > 0 ? valid : options;

      if (pool.length > 0) {
        let choice;
        if (this.mode === 'frightened') {
          choice = pool[Math.floor(Math.random() * pool.length)];
        } else {
          const target = this.currentTarget(player, chaserGhost, globalMode);
          choice = pool.reduce((best, o) => {
            const d = Math.hypot(o.row - target.row, o.col - target.col);
            return d < best.d ? { ...o, d } : best;
          }, { ...pool[0], d: Infinity });
        }
        this.dir = { dr: choice.dr, dc: choice.dc };
      }
    }

    this.row += this.dir.dr * this.speed * dt;
    this.col += this.dir.dc * this.speed * dt;
    this.col = wrapFloatCol(this.col, maze.cols);
  }

  draw(ctx, tile) {
    const x = this.col * tile + tile / 2;
    const y = this.row * tile + tile / 2;
    const r = tile * 0.42;

    let bodyColor = this.color;
    let glow = this.color;
    if (this.mode === 'frightened') {
      const flashing = this.frightenedTimer < 1.5 && Math.floor(this.frightenedTimer * 8) % 2 === 0;
      bodyColor = flashing ? '#f4f4f4' : '#2b3fd6';
      glow = 'rgba(43, 63, 214, 0.8)';
    } else if (this.mode === 'eaten') {
      bodyColor = null; // just eyes
    }

    ctx.save();
    if (bodyColor) {
      ctx.fillStyle = bodyColor;
      ctx.shadowColor = glow;
      ctx.shadowBlur = tile * 0.4;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, r, Math.PI, 0);
      const skirtY = y + r * 0.55;
      const waves = 4;
      ctx.lineTo(x + r, skirtY);
      for (let i = 0; i < waves; i++) {
        const wx = x + r - (r * 2 * (i + 1)) / waves;
        const wy = i % 2 === 0 ? skirtY - r * 0.28 : skirtY;
        ctx.lineTo(wx, wy);
      }
      ctx.closePath();
      ctx.fill();
    }

    // eyes (always visible, look toward direction of travel)
    const eyeOffsetX = tile * 0.14;
    const eyeY = y - r * 0.12;
    const pupilShift = 0.16 * tile;
    ctx.shadowBlur = 0;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#eef2ff';
      ctx.beginPath();
      ctx.ellipse(x + side * eyeOffsetX, eyeY, tile * 0.11, tile * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1f3d';
      ctx.beginPath();
      ctx.ellipse(
        x + side * eyeOffsetX + this.dir.dc * pupilShift * 0.5,
        eyeY + this.dir.dr * pupilShift * 0.5,
        tile * 0.05,
        tile * 0.06,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }
}
