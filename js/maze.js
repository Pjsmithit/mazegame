// maze.js — wraps a maze grid definition with collision queries,
// pellet bookkeeping, and canvas rendering.

const TILE_WALL = '#';
const TILE_PELLET = '.';
const TILE_POWER = 'o';
const TILE_DOOR = '-';
const TILE_EMPTY = ' ';

class Maze {
  constructor(levelKey) {
    const def = MAZE_DATA[levelKey];
    if (!def) throw new Error(`Unknown maze level: ${levelKey}`);
    // Deep copy the grid as a mutable 2D char array so eating pellets
    // doesn't mutate the shared level definition.
    this.rows = def.grid.length;
    this.cols = def.grid[0].length;
    this.grid = def.grid.map((row) => row.split(''));
    this.playerStart = { ...def.playerStart };
    this.ghostStart = { ...def.ghostStart };
    this.pelletsRemaining = 0;
    this.totalPellets = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.grid[r][c];
        if (ch === TILE_PELLET || ch === TILE_POWER) {
          this.pelletsRemaining++;
          this.totalPellets++;
        }
      }
    }
  }

  inBounds(row, col) {
    return row >= 0 && row < this.rows;
  }

  // Horizontal wraparound tunnel; vertical stays clamped.
  wrapCol(col) {
    if (col < 0) return this.cols - 1;
    if (col >= this.cols) return 0;
    return col;
  }

  tileAt(row, col) {
    if (!this.inBounds(row, col)) return TILE_WALL;
    const c = this.wrapCol(col);
    return this.grid[row][c];
  }

  isWall(row, col) {
    return this.tileAt(row, col) === TILE_WALL;
  }

  // Ghosts may pass through the pen door; the player may not.
  isPassable(row, col, { allowDoor = false } = {}) {
    const t = this.tileAt(row, col);
    if (t === TILE_WALL) return false;
    if (t === TILE_DOOR && !allowDoor) return false;
    return true;
  }

  eatAt(row, col) {
    const c = this.wrapCol(col);
    const ch = this.grid[row][c];
    if (ch === TILE_PELLET) {
      this.grid[row][c] = TILE_EMPTY;
      this.pelletsRemaining--;
      return 'pellet';
    }
    if (ch === TILE_POWER) {
      this.grid[row][c] = TILE_EMPTY;
      this.pelletsRemaining--;
      return 'power';
    }
    return null;
  }

  cleared() {
    return this.pelletsRemaining <= 0;
  }

  // Valid step directions from a tile, used by ghost AI and player
  // input buffering. Returns array of {dr,dc,row,col}.
  neighbors(row, col, opts = {}) {
    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];
    const out = [];
    for (const d of dirs) {
      const nr = row + d.dr;
      const nc = this.wrapCol(col + d.dc);
      if (this.isPassable(nr, nc, opts)) {
        out.push({ dr: d.dr, dc: d.dc, row: nr, col: nc });
      }
    }
    return out;
  }

  draw(ctx, tile) {
    // Walls: soft neon-indigo blocks with a glow, drawn as rounded
    // segments rather than a grid of squares so corridors read cleanly.
    ctx.save();
    ctx.shadowColor = 'rgba(123, 92, 255, 0.55)';
    ctx.shadowBlur = tile * 0.5;
    ctx.fillStyle = '#241b4d';
    ctx.strokeStyle = '#7b5cff';
    ctx.lineWidth = Math.max(2, tile * 0.09);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === TILE_WALL) {
          const x = c * tile;
          const y = r * tile;
          const inset = tile * 0.12;
          ctx.beginPath();
          ctx.roundRect(x + inset, y + inset, tile - inset * 2, tile - inset * 2, tile * 0.22);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Pellets + power pellets
    ctx.save();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.grid[r][c];
        const cx = c * tile + tile / 2;
        const cy = r * tile + tile / 2;
        if (ch === TILE_PELLET) {
          ctx.fillStyle = '#f2c14e';
          ctx.shadowColor = 'rgba(242, 193, 78, 0.7)';
          ctx.shadowBlur = tile * 0.3;
          ctx.beginPath();
          ctx.arc(cx, cy, tile * 0.09, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === TILE_POWER) {
          const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 180);
          ctx.fillStyle = '#f2c14e';
          ctx.shadowColor = 'rgba(242, 193, 78, 0.9)';
          ctx.shadowBlur = tile * 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, tile * 0.24 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}
